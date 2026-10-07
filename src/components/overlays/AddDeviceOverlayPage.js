import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Check, Refresh, X } from '@hugeicons/core-free-icons';
import { useAppContext } from '../../context/AppContext';
import { useManagerId } from '../../hooks/useManagerId';
import {
  describeDeviceConfigError,
  pingDeviceSoftAp,
  postDeviceConfig,
} from '../../api/softApApi';
import { waitForDeviceSetupStatus } from '../../api/deviceSetupSocket';
import {
  bindSoftApTraffic,
  connectToDevice,
  describeConnectError,
  describeScanError,
  ensureSoftApReady,
  ensureWifiPermissions,
  hasWifiPermissions,
  isAckitSsid,
  isWifiSetupSupported,
  openWifiSettingsPanel,
  releaseDeviceNetwork,
  scanWifi,
} from '../../services/wifiService';
import { Toast, useToast } from '../ui/Toast';
import { WifiCredentialsModal } from './WifiCredentialsModal';
import { ConfigureDeviceModal } from './ConfigureDeviceModal';
import { EmptyState, WifiRow } from './addDeviceParts';

/**
 * Add Device — SoftAP Wi-Fi provisioning wizard.
 *
 *  1. list nearby "ackit" / "ac-kit" Wi-Fi → "Connect AC Kit" modal (join the device AP)
 *  2. "Select Wifi" list (non-ackit) → "Connect Wifi" modal
 *     → POST http://192.168.4.1/configure { ssid, password, managerId }
 *  3. wait for backend status: configured → success, unconfigured → "Configure Device"
 *
 * Opened from Devices FAB → AddDrawer. `embedded` hides page chrome in the sheet.
 */
export function AddDeviceOverlayPage({ onClose, embedded = false }) {
  const { setUnits } = useAppContext();
  const managerId = useManagerId();
  const { toast, showToast } = useToast();

  const [permission, setPermission] = useState('checking'); // checking|granted|denied|blocked|unsupported
  const [networks, setNetworks] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');

  const [step, setStep] = useState('device'); // device | wifi | waiting | done
  const [deviceSsid, setDeviceSsid] = useState('');
  const [deviceModalSsid, setDeviceModalSsid] = useState('');
  const [wifiModalSsid, setWifiModalSsid] = useState('');
  const [busy, setBusy] = useState(false);
  /** After 2 SoftAP fails, prompt Off/On Wi-Fi (Android Specifier cache). */
  const [needsWifiToggle, setNeedsWifiToggle] = useState(false);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [setupDevice, setSetupDevice] = useState(null); // { macAddress, name } from backend

  const mountedRef = useRef(true);
  const boundRef = useRef(false); // phone currently pinned to the device AP
  const softApPasswordRef = useRef(''); // SoftAP password — needed to rejoin after a failed home-Wi-Fi send
  const waiterRef = useRef(null);
  const closeTimerRef = useRef(null);

  const runScan = useCallback(async () => {
    setScanning(true);
    setScanError('');
    try {
      const list = await scanWifi();
      if (mountedRef.current) setNetworks(list);
    } catch (err) {
      if (mountedRef.current) setScanError(describeScanError(err));
    } finally {
      if (mountedRef.current) setScanning(false);
    }
  }, []);

  const requestAccess = useCallback(async () => {
    if (!isWifiSetupSupported) {
      setPermission('unsupported');
      return;
    }
    // Only prompts when not already granted (Grant button / fallback).
    const status = await ensureWifiPermissions();
    if (!mountedRef.current) return;
    setPermission(status);
    if (status === 'granted') await runScan();
  }, [runScan]);

  useEffect(() => {
    mountedRef.current = true;
    // Silent check only on mount — do NOT open the OS permission dialog here.
    // Permissions are requested on the Devices tab (and again before the FAB
    // opens this drawer) so the system sheet never races the drawer layout.
    (async () => {
      if (!isWifiSetupSupported) {
        if (mountedRef.current) setPermission('unsupported');
        return;
      }
      const ok = await hasWifiPermissions();
      if (!mountedRef.current) return;
      if (ok) {
        setPermission('granted');
        await runScan();
      } else {
        setPermission('denied');
      }
    })();
    return () => {
      mountedRef.current = false;
      waiterRef.current?.cancel();
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (boundRef.current) {
        boundRef.current = false;
        void releaseDeviceNetwork();
      }
    };
  }, [runScan]);

  const deviceNetworks = useMemo(
    () => networks.filter((n) => isAckitSsid(n.ssid)),
    [networks]
  );
  const homeNetworks = useMemo(
    () => networks.filter((n) => !isAckitSsid(n.ssid)),
    [networks]
  );

  const releaseNetwork = useCallback(async () => {
    boundRef.current = false;
    await releaseDeviceNetwork();
  }, []);

  const restart = useCallback(async () => {
    await releaseNetwork();
    softApPasswordRef.current = '';
    if (!mountedRef.current) return;
    setDeviceSsid('');
    setStep('device');
    void runScan();
  }, [releaseNetwork, runScan]);

  // ---- Step 1: join the device AP ----
  const handleConnectDevice = async (password) => {
    const ssid = deviceModalSsid;
    setBusy(true);
    try {
      console.log('[AddDevice] Connecting to SoftAP…', ssid);
      await connectToDevice(ssid, password);
      if (!mountedRef.current) return;
      boundRef.current = true;
      softApPasswordRef.current = password || '';
      setNeedsWifiToggle(false);
      setDeviceSsid(ssid);
      setDeviceModalSsid('');
      setStep('wifi');
      console.log('[AddDevice] SoftAP connected + bound:', ssid);
      showToast(`Connected to ${ssid}`, 'success', 2500);
      // Scan can take several seconds; Android dual-STA may prefer home Wi-Fi /
      // cellular meanwhile — rebind SoftAP traffic when the list is ready.
      void runScan().then(() => {
        if (mountedRef.current && boundRef.current) {
          void bindSoftApTraffic();
        }
      });
    } catch (err) {
      boundRef.current = false;
      console.warn('[AddDevice] connect device failed:', {
        code: err?.code,
        message: err?.message,
      });
      if (mountedRef.current) {
        if (/needsWifiToggle/i.test(String(err?.code || ''))) {
          setNeedsWifiToggle(true);
        }
        showToast(describeConnectError(err));
      }
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  // ---- Step 3: wait for backend status after the device got its Wi-Fi ----
  const waitForBackend = async (alreadyConfigured = false) => {
    setStep('waiting');
    softApPasswordRef.current = '';
    await releaseNetwork(); // give the phone its normal internet back first
    if (!mountedRef.current) return;

    console.log('[AddDevice] waiting for backend', {
      deviceSsid,
      managerId,
      espSaidAlreadyConfigured: alreadyConfigured,
    });
    const waiter = waitForDeviceSetupStatus({
      managerId,
      deviceName: deviceSsid,
      alreadyConfigured,
    });
    waiterRef.current = waiter;
    try {
      const { status, device } = await waiter.promise;
      if (!mountedRef.current) return;
      if (status === 'unconfigured') {
        setSetupDevice(device);
        setConfigureOpen(true);
      } else {
        setStep('done');
        showToast('Device configured successfully', 'success', 3000);
        closeTimerRef.current = setTimeout(onClose, 2000);
      }
    } catch (err) {
      if (!mountedRef.current || err?.message === 'cancelled') return;
      if (__DEV__) console.warn('[AddDevice] wait for backend failed:', err);
      showToast(err?.message || 'Could not get the device status. Please try again.');
      setDeviceSsid('');
      setStep('device');
      void runScan();
    } finally {
      waiterRef.current = null;
    }
  };

  // ---- Step 2: send home Wi-Fi to the device ----
  const handleSendConfig = async (password) => {
    if (!managerId) {
      showToast('Could not determine the manager for this account.');
      return;
    }
    const ssid = wifiModalSsid;
    let espAlreadyConfigured = false;
    setBusy(true);
    try {
      console.log('[AddDevice] Sending home Wi-Fi to SoftAP…', {
        homeSsid: ssid,
        deviceSsid,
        managerId,
      });

      // Android 12+ often keeps internet Wi-Fi preferred while SoftAP is still
      // joined. Re-bind (or rejoin SoftAP) right before HTTP or ping fails.
      const ready = await ensureSoftApReady({
        ssid: deviceSsid,
        password: softApPasswordRef.current || null,
        ping: () => pingDeviceSoftAp(),
      });
      if (!mountedRef.current) return;
      if (ready.ok) {
        boundRef.current = true;
      } else {
        const err = new Error(
          'Could not reach the AC Kit SoftAP. Stay on the device Wi-Fi and try again.'
        );
        err.code = 'SOFTAP_UNREACHABLE';
        err.isSoftApReachability = true;
        throw err;
      }

      const cfg = await postDeviceConfig({ ssid, password, managerId });
      // ESP replies "WiFi updated Successfully" when its flash already has a
      // DEVICE_ID, and "Configuration saved" for a first-time device.
      espAlreadyConfigured = /updated/i.test(String(cfg?.message || ''));
      console.log('[AddDevice] SoftAP configure accepted — waiting for backend', {
        espMessage: cfg?.message,
        espAlreadyConfigured,
      });
      if (mountedRef.current) {
        showToast('Wi-Fi details sent to AC Kit', 'success', 2500);
      }
    } catch (err) {
      console.warn('[AddDevice] SoftAP configure failed:', {
        message: err?.message,
        code: err?.code,
        status: err?.response?.status,
      });
      // SoftAP link may be sticky/broken after a failed send — clear and rejoin
      // so the user can retry the home Wi-Fi password on the same modal.
      boundRef.current = false;
      let rejoined = false;
      if (deviceSsid) {
        try {
          await connectToDevice(deviceSsid, softApPasswordRef.current || null);
          if (mountedRef.current) {
            boundRef.current = true;
            rejoined = true;
          }
        } catch (_) {
          // SoftAP gone (e.g. ESP already rebooted) — start over
        }
      }
      if (mountedRef.current) {
        if (rejoined) {
          showToast(
            `${describeDeviceConfigError(err)} Check the Wi-Fi password and try again.`
          );
        } else {
          showToast(
            'Lost connection to the AC Kit. Connect to the device again, then retry.'
          );
          setWifiModalSsid('');
          softApPasswordRef.current = '';
          setDeviceSsid('');
          setStep('device');
          void runScan();
        }
        setBusy(false);
      }
      return;
    }
    if (!mountedRef.current) return;
    setBusy(false);
    setWifiModalSsid('');
    await waitForBackend(espAlreadyConfigured);
  };

  const handleCreated = (device, { confirmed = true } = {}) => {
    setUnits((prev) => [...prev.filter((u) => u.id !== device.id), device]);
    setConfigureOpen(false);
    setStep('done');
    showToast(
      confirmed
        ? 'Device configured successfully'
        : 'Device saved. The AC Kit is still confirming — it will show as online shortly.',
      confirmed ? 'success' : 'info',
      confirmed ? 3000 : 4500
    );
    closeTimerRef.current = setTimeout(onClose, 2000);
  };

  const handleConfigureCancel = () => {
    setConfigureOpen(false);
    setDeviceSsid('');
    setStep('device');
    void runScan();
  };

  // ---- UI ----
  const isListStep = step === 'device' || step === 'wifi';
  const stepLabel =
    step === 'device'
      ? 'Step 1 of 2'
      : step === 'wifi'
        ? 'Step 2 of 2'
        : step === 'waiting'
          ? 'Please wait'
          : 'Add Device';
  const title =
    step === 'device'
      ? 'Nearby AC Kits'
      : step === 'wifi'
        ? 'Select Wifi'
        : step === 'waiting'
          ? 'Setting Up Device'
          : 'New Device';

  const list = step === 'wifi' ? homeNetworks : deviceNetworks;
  const countLabel =
    step === 'wifi'
      ? `${list.length} network${list.length === 1 ? '' : 's'} found`
      : `${list.length} device${list.length === 1 ? '' : 's'} found`;

  const renderListBody = () => {
    if (permission === 'checking') {
      return <EmptyState loading title="Checking access" />;
    }
    if (permission === 'unsupported') {
      return (
        <EmptyState
          title="Not supported"
          message="Wi-Fi setup for AC Kit is available on Android only."
        />
      );
    }
    if (permission === 'denied' || permission === 'blocked') {
      return (
        <EmptyState
          error
          title="Permission required"
          message="Allow Location / Nearby devices permission so the app can list nearby Wi-Fi networks."
          actionLabel={permission === 'blocked' ? 'Open Settings' : 'Grant Permission'}
          onAction={
            permission === 'blocked' ? () => Linking.openSettings() : requestAccess
          }
        />
      );
    }
    if (scanError) {
      return (
        <EmptyState
          error
          title="Scan failed"
          message={scanError}
          actionLabel="Try Again"
          onAction={runScan}
        />
      );
    }
    if (scanning && list.length === 0) {
      return <EmptyState loading title="Scanning" message="Looking for nearby Wi-Fi…" />;
    }
    if (list.length === 0) {
      return (
        <EmptyState
          title={step === 'wifi' ? 'No Networks Found' : 'No AC Kit Found'}
          message={
            step === 'wifi'
              ? 'Tap refresh to scan again.'
              : 'Make sure the device is powered on and in setup mode, then refresh.'
          }
          actionLabel="Refresh"
          onAction={runScan}
        />
      );
    }
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={runScan} />}
      >
        {list.map((n, i) => (
          <WifiRow
            key={n.ssid}
            first={i === 0}
            ssid={n.ssid}
            level={n.level}
            secured={n.secured}
            actionLabel={step === 'wifi' ? 'Connect' : 'Connect to Device'}
            onPress={() =>
              step === 'wifi'
                ? setWifiModalSsid(n.ssid)
                : (setNeedsWifiToggle(false), setDeviceModalSsid(n.ssid))
            }
          />
        ))}
      </ScrollView>
    );
  };

  return (
    <View className={embedded ? 'min-h-0 flex-1 pb-2' : 'flex-1 bg-[#f8fafc] px-5 pb-6 pt-4'}>
      {!embedded ? (
        <View className="mb-4 flex-row items-center justify-between">
          <View className="min-w-0 flex-1 pr-3">
            <Text className="mb-1 text-[10px] font-black uppercase tracking-widest text-blue-600">
              {stepLabel}
            </Text>
            <Text className="text-xl font-black leading-none tracking-tight text-slate-900">
              {title}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 active:scale-90"
            accessibilityLabel="Close"
          >
            <HugeiconsIcon icon={X} size={20} color="#64748b" strokeWidth={2.5} />
          </Pressable>
        </View>
      ) : null}

      {isListStep ? (
        <>
          {step === 'wifi' ? (
            <View className="mb-3 flex-row items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-3.5 py-3">
              <View className="min-w-0 flex-1 flex-row items-center gap-2 pr-2">
                <HugeiconsIcon icon={Check} size={14} color="#059669" />
                <Text
                  numberOfLines={1}
                  className="min-w-0 flex-1 text-xs font-bold text-emerald-700"
                >
                  Connected to {deviceSsid}
                </Text>
              </View>
              <Pressable onPress={restart} hitSlop={8}>
                <Text className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                  Change
                </Text>
              </Pressable>
            </View>
          ) : null}

          <Text className="mb-3 text-xs font-semibold leading-relaxed text-slate-500">
            {step === 'wifi'
              ? 'Choose the Wi-Fi your AC Kit should use. AC Kit works with 2.4 GHz networks only.'
              : 'Turn on your AC Kit and keep your phone close to it.'}
          </Text>

          {/* List card */}
          <View className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            {permission === 'granted' && !scanError ? (
              <View className="flex-row items-center justify-between border-b border-slate-100 px-5 py-2.5">
                <Text className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {countLabel}
                </Text>
                <Pressable
                  onPress={runScan}
                  disabled={scanning}
                  hitSlop={8}
                  className="h-8 w-8 items-center justify-center rounded-full bg-slate-50 active:scale-90"
                  accessibilityLabel="Refresh"
                >
                  {scanning ? (
                    <ActivityIndicator size="small" color="#2563eb" />
                  ) : (
                    <HugeiconsIcon icon={Refresh} size={16} color="#94a3b8" />
                  )}
                </Pressable>
              </View>
            ) : null}
            <View className="min-h-0 flex-1">{renderListBody()}</View>
          </View>
        </>
      ) : step === 'waiting' ? (
        <View className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <View className="flex-row items-center gap-3">
            <View className="h-6 w-6 items-center justify-center rounded-full bg-emerald-500">
              <HugeiconsIcon icon={Check} size={12} color="#ffffff" />
            </View>
            <Text className="text-xs font-bold text-slate-700">
              Wi-Fi details sent to your AC Kit
            </Text>
          </View>
          <View className="ml-3 h-4 w-0.5 bg-slate-200" />
          <View className="flex-row items-center gap-3">
            <View className="h-6 w-6 items-center justify-center">
              <ActivityIndicator size="small" color="#2563eb" />
            </View>
            <Text className="text-xs font-black text-slate-900">
              Waiting for your AC Kit to come online
            </Text>
          </View>
          <Text className="mt-4 text-xs font-semibold leading-relaxed text-slate-500">
            This can take up to a minute. Keep the app open.
          </Text>
        </View>
      ) : (
        <View className="flex-1 items-center justify-center px-4 pb-10">
          <View
            className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-emerald-50"
            style={{
              shadowColor: '#10b981',
              shadowOpacity: 0.25,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            }}
          >
            <HugeiconsIcon icon={Check} size={40} color="#059669" strokeWidth={2.5} />
          </View>
          <Text className="mb-2 text-xl font-black text-slate-900">
            Device Configured!
          </Text>
          <Text className="max-w-[240px] text-center text-xs font-semibold leading-relaxed text-slate-500">
            Your AC Kit has been set up successfully.
          </Text>
        </View>
      )}

      {/* Page-level toast. While a modal is open it shows its own copy on top,
          so hide this one — otherwise the same message appears twice. */}
      {!deviceModalSsid && !wifiModalSsid && !configureOpen ? (
        <View pointerEvents="none" className="absolute left-4 right-4 top-2 z-50">
          <Toast toast={toast} />
        </View>
      ) : null}

      <WifiCredentialsModal
        ssid={deviceModalSsid}
        title="Connect AC Kit"
        subtitle="Enter the device Wi-Fi password to connect."
        hint={
          needsWifiToggle
            ? 'Android cached a bad attempt. Open Wi-Fi settings, turn Wi-Fi Off then On, come back, and Connect with the correct password.'
            : 'Android may show its own sheet — tap the AC Kit there to allow the connection.'
        }
        settingsActionLabel={needsWifiToggle ? 'Open Wi-Fi settings' : undefined}
        onSettingsAction={
          needsWifiToggle
            ? () => {
                void openWifiSettingsPanel();
              }
            : undefined
        }
        submitLabel="Connect"
        busyLabel="Connecting…"
        busy={busy}
        toast={toast}
        onSubmit={handleConnectDevice}
        onClose={() => {
          setNeedsWifiToggle(false);
          setDeviceModalSsid('');
        }}
      />

      <WifiCredentialsModal
        ssid={wifiModalSsid}
        title="Connect Wifi"
        subtitle="Enter the Wi-Fi password. This can take up to 2 minutes."
        hint="Passwords are case-sensitive. Keep your phone close to the AC Kit."
        submitLabel="Connect"
        busyLabel="Sending…"
        busy={busy}
        toast={toast}
        onSubmit={handleSendConfig}
        onClose={() => setWifiModalSsid('')}
      />

      <ConfigureDeviceModal
        isOpen={configureOpen}
        device={setupDevice}
        toast={toast}
        showToast={showToast}
        onCancel={handleConfigureCancel}
        onCreated={handleCreated}
      />
    </View>
  );
}
