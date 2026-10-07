import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  AlertCircle,
  ArrowUp01Icon,
  Cpu,
  Refresh,
  X,
} from '@hugeicons/core-free-icons';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '../../context/AppContext';
import { useManagerId } from '../../hooks/useManagerId';
import { getUnconfiguredDevices } from '../../api/deviceApi';
import { getAppSocket } from '../../api/brandSocket';
import {
  DEVICE_PROVISIONED_EVENT,
  DEVICE_SETUP_EVENT,
} from '../../api/deviceSetupSocket';
import { ConfigureDeviceModal } from '../overlays/ConfigureDeviceModal';
import { Toast, useToast } from '../ui/Toast';

const SNAP_POINTS = ['58%', '90%'];

const macKey = (mac) =>
  String(mac || '').replace(/[^0-9a-f]/gi, '').toUpperCase();

function StatusPill({ online }) {
  return (
    <View
      className={`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${
        online ? 'bg-emerald-50' : 'bg-slate-100'
      }`}
    >
      <View
        className={`h-1.5 w-1.5 rounded-full ${
          online ? 'bg-emerald-500' : 'bg-slate-400'
        }`}
      />
      <Text
        className={`text-[9px] font-black uppercase tracking-wider ${
          online ? 'text-emerald-700' : 'text-slate-500'
        }`}
      >
        {online ? 'Online' : 'Offline'}
      </Text>
    </View>
  );
}

function UnconfiguredRow({ device, onPress }) {
  const online = device.status === 'online';
  return (
    <Pressable
      onPress={() => onPress(device)}
      className="mb-2 flex-row items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50/40 p-3 active:scale-[0.99]"
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
        <HugeiconsIcon icon={Cpu} size={18} color="#d97706" />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          numberOfLines={1}
          className="text-sm font-black tracking-tight text-slate-900"
        >
          {device.name}
        </Text>
        <Text
          numberOfLines={1}
          className="mt-0.5 text-[11px] font-semibold text-amber-700"
        >
          Not configured
        </Text>
      </View>
      <StatusPill online={online} />
    </Pressable>
  );
}

/**
 * Dashboard "Devices" row (below Events) + sheet of unconfigured ESP units
 * waiting to be set up. Tapping an online unit opens Configure Device.
 */
export function DeviceStatusSheet() {
  const managerId = useManagerId();
  const { setUnits } = useAppContext();
  const insets = useSafeAreaInsets();
  const { toast, showToast } = useToast();

  const sheetRef = useRef(null);
  const [unconfigured, setUnconfigured] = useState([]);
  /** MACs just saved locally — hide until the next ESP list refresh drops them. */
  const [doneMacs, setDoneMacs] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [target, setTarget] = useState(null);
  const mountedRef = useRef(true);

  const visible = useMemo(
    () => unconfigured.filter((d) => !doneMacs.has(macKey(d.macAddress))),
    [unconfigured, doneMacs]
  );

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!managerId) return;
      if (!silent) setLoading(true);
      try {
        const list = await getUnconfiguredDevices(managerId);
        if (!mountedRef.current) return;
        setUnconfigured(list);
        setLoadError('');
      } catch {
        if (!mountedRef.current) return;
        setLoadError('Could not load devices. Please try again.');
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [managerId]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void load({ silent: true });
  }, [load]);

  useEffect(() => {
    if (!managerId) return undefined;
    let socket = null;
    let cancelled = false;
    const refresh = () => void load({ silent: true });
    const events = [DEVICE_SETUP_EVENT, DEVICE_PROVISIONED_EVENT];
    getAppSocket()
      .then((s) => {
        if (cancelled) return;
        socket = s;
        events.forEach((evt) => socket.on(evt, refresh));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (socket) events.forEach((evt) => socket.off(evt, refresh));
    };
  }, [managerId, load]);

  const openSheet = () => {
    sheetRef.current?.present();
    void load({ silent: false });
  };

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.45}
      />
    ),
    []
  );

  const handleUnconfiguredPress = (device) => {
    if (device.status !== 'online') {
      showToast(
        'This AC Kit is offline. Power it on and connect it to Wi-Fi first.'
      );
      return;
    }
    setTarget(device);
  };

  const handleCreated = (device, { confirmed = true } = {}) => {
    setUnits((prev) => [...prev.filter((u) => u.id !== device.id), device]);
    const key = macKey(device.macAddress || target?.macAddress);
    if (key) {
      setDoneMacs((prev) => new Set([...prev, key]));
    }
    setTarget(null);
    showToast(
      confirmed
        ? 'Device configured successfully'
        : 'Device saved. The AC Kit is still confirming — it will show as online shortly.',
      confirmed ? 'success' : 'info',
      confirmed ? 3000 : 4500
    );
    void load({ silent: true });
  };

  const modalDevice = useMemo(
    () =>
      target ? { macAddress: target.macAddress, name: target.name } : null,
    [target]
  );

  if (!managerId) return null;

  return (
    <>
      <Pressable
        onPress={openSheet}
        accessibilityLabel="Open devices to configure"
        className="flex-row items-center justify-between rounded-[2rem] border border-slate-100 bg-white px-5 py-3.5 active:scale-[0.99]"
      >
        <View className="min-w-0 flex-1 pr-3">
          <Text className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            DEVICES
          </Text>
          <Text
            numberOfLines={1}
            className="mt-0.5 text-xs font-bold text-slate-700"
          >
            {visible.length > 0
              ? `${visible.length} waiting to configure`
              : 'No devices waiting'}
          </Text>
        </View>
        {visible.length > 0 ? (
          <View className="mr-3 rounded-full bg-amber-100 px-2.5 py-1">
            <Text className="text-[9px] font-black uppercase tracking-wider text-amber-700">
              {visible.length} to configure
            </Text>
          </View>
        ) : null}
        <View className="h-9 w-9 items-center justify-center rounded-full bg-blue-50">
          <HugeiconsIcon
            icon={ArrowUp01Icon}
            size={18}
            color="#2563eb"
            strokeWidth={2.5}
          />
        </View>
      </Pressable>

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={SNAP_POINTS}
        index={0}
        enablePanDownToClose
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: '#cbd5e1', width: 40 }}
        backgroundStyle={{ borderRadius: 28, backgroundColor: '#f8fafc' }}
      >
        <View className="flex-row items-center justify-between px-5 pb-2 pt-1">
          <View>
            <Text className="text-[10px] font-black uppercase tracking-widest text-blue-600">
              {visible.length} waiting
            </Text>
            <Text className="text-xl font-black leading-tight tracking-tight text-slate-900">
              Configure Devices
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => load({ silent: false })}
              disabled={loading}
              accessibilityLabel="Refresh"
              className="h-9 w-9 items-center justify-center rounded-full bg-slate-100 active:scale-90"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <HugeiconsIcon icon={Refresh} size={16} color="#64748b" />
              )}
            </Pressable>
            <Pressable
              onPress={() => sheetRef.current?.dismiss()}
              accessibilityLabel="Close"
              className="h-9 w-9 items-center justify-center rounded-full bg-slate-100 active:scale-90"
            >
              <HugeiconsIcon icon={X} size={18} color="#64748b" strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>

        {!target && toast ? (
          <View className="px-5 pb-1">
            <Toast toast={toast} />
          </View>
        ) : null}

        <BottomSheetScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 24,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {loadError ? (
            <View className="mt-4 flex-row items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-3.5 py-3">
              <HugeiconsIcon icon={AlertCircle} size={16} color="#dc2626" />
              <Text className="min-w-0 flex-1 text-xs font-bold text-red-700">
                {loadError}
              </Text>
            </View>
          ) : null}

          {visible.length > 0 ? (
            <View className="mt-2">
              {visible.map((d) => (
                <UnconfiguredRow
                  key={d.id}
                  device={d}
                  onPress={handleUnconfiguredPress}
                />
              ))}
            </View>
          ) : loading ? null : (
            <View className="mt-6 items-center rounded-2xl border border-dashed border-slate-200 bg-white py-10">
              <HugeiconsIcon icon={Cpu} size={20} color="#cbd5e1" />
              <Text className="mt-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                No devices to configure
              </Text>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>

      <ConfigureDeviceModal
        isOpen={!!target}
        device={modalDevice}
        toast={toast}
        showToast={showToast}
        onCancel={() => setTarget(null)}
        onCreated={handleCreated}
      />
    </>
  );
}
