import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
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
import { TextField } from '../ui/TextField';
import { Toast, useToast } from '../ui/Toast';
import { ConfigureDeviceModal } from './ConfigureDeviceModal';
import {
  BackLink,
  EmptyState,
  PrimaryButton,
  ProgressChecklist,
  SecondaryButton,
  SelectableRow,
  SetupStepper,
  StatusPill,
  TroubleshootingModal,
  WizardCard,
  stepIndexFor,
  wifiSignalSubtitle,
} from './addDeviceParts';

const VERIFY_LABELS = [
  'Connecting to Wi-Fi',
  'Authenticating',
  'Obtaining network address',
  'Establishing connection',
  'Connecting to IoTify',
  'Wi-Fi Connected',
];

/**
 * Add Device — SoftAP Wi-Fi provisioning wizard (step UI).
 *
 * Same SoftAP / backend flow as before; screens are step pages instead of
 * credential / configure modals.
 *
 *  Discover → Connect (device AP) → Network (home Wi-Fi) → Verify → Configure → Complete
 */
export function AddDeviceOverlayPage({ onClose, embedded = false }) {
  const { setUnits } = useAppContext();
  const managerId = useManagerId();
  const { toast, showToast } = useToast();

  const [permission, setPermission] = useState('checking');
  const [networks, setNetworks] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');

  /** discover | connect | network | wifiPassword | verify | configure | complete */
  const [uiStep, setUiStep] = useState('discover');
  const [selectedDeviceSsid, setSelectedDeviceSsid] = useState('');
  const [deviceSsid, setDeviceSsid] = useState('');
  const [devicePassword, setDevicePassword] = useState('');
  const [selectedHomeSsid, setSelectedHomeSsid] = useState('');
  const [homePassword, setHomePassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsWifiToggle, setNeedsWifiToggle] = useState(false);
  const [troubleOpen, setTroubleOpen] = useState(false);
  const [setupDevice, setSetupDevice] = useState(null);
  /** Visual checklist cursor during verify (UI only). */
  const [verifyCursor, setVerifyCursor] = useState(0);
  const [localConnLabel, setLocalConnLabel] = useState('Idle');
  const [iotifyConnLabel, setIotifyConnLabel] = useState('Idle');

  const mountedRef = useRef(true);
  const boundRef = useRef(false);
  const softApPasswordRef = useRef('');
  const waiterRef = useRef(null);
  const closeTimerRef = useRef(null);
  const verifyTimerRef = useRef(null);

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
    const status = await ensureWifiPermissions();
    if (!mountedRef.current) return;
    setPermission(status);
    if (status === 'granted') await runScan();
  }, [runScan]);

  useEffect(() => {
    mountedRef.current = true;
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
      if (verifyTimerRef.current) clearInterval(verifyTimerRef.current);
      if (boundRef.current) {
        boundRef.current = false;
        void releaseDeviceNetwork();
      }
    };
  }, [runScan]);

  // UI-only: advance verify checklist while SoftAP send / backend wait runs
  useEffect(() => {
    if (uiStep !== 'verify') {
      if (verifyTimerRef.current) clearInterval(verifyTimerRef.current);
      return undefined;
    }
    verifyTimerRef.current = setInterval(() => {
      setVerifyCursor((c) => Math.min(c + 1, VERIFY_LABELS.length - 2));
    }, 2200);
    return () => {
      if (verifyTimerRef.current) clearInterval(verifyTimerRef.current);
    };
  }, [uiStep]);

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

  const goDiscover = useCallback(async () => {
    await releaseNetwork();
    softApPasswordRef.current = '';
    if (!mountedRef.current) return;
    setDeviceSsid('');
    setSelectedDeviceSsid('');
    setDevicePassword('');
    setSelectedHomeSsid('');
    setHomePassword('');
    setNeedsWifiToggle(false);
    setSetupDevice(null);
    setLocalConnLabel('Idle');
    setIotifyConnLabel('Idle');
    setVerifyCursor(0);
    setUiStep('discover');
    void runScan();
  }, [releaseNetwork, runScan]);

  // ---- Step 1: join the device AP ----
  const handleConnectDevice = async (password) => {
    const ssid = selectedDeviceSsid;
    setBusy(true);
    setLocalConnLabel('Connecting…');
    try {
      console.log('[AddDevice] Connecting to SoftAP…', ssid);
      await connectToDevice(ssid, password);
      if (!mountedRef.current) return;
      boundRef.current = true;
      softApPasswordRef.current = password || '';
      setNeedsWifiToggle(false);
      setDeviceSsid(ssid);
      setLocalConnLabel('Connected');
      setUiStep('network');
      setSelectedHomeSsid('');
      console.log('[AddDevice] SoftAP connected + bound:', ssid);
      showToast(`Connected to ${ssid}`, 'success', 2500);
      void runScan().then(() => {
        if (mountedRef.current && boundRef.current) {
          void bindSoftApTraffic();
        }
      });
    } catch (err) {
      boundRef.current = false;
      setLocalConnLabel('Idle');
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
    setUiStep('verify');
    setIotifyConnLabel('Connecting…');
    softApPasswordRef.current = '';
    await releaseNetwork();
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
      setVerifyCursor(VERIFY_LABELS.length - 1);
      setIotifyConnLabel('Connected');
      if (status === 'unconfigured') {
        setSetupDevice(device);
        setUiStep('configure');
      } else {
        setUiStep('complete');
        showToast('Device configured successfully', 'success', 3000);
        closeTimerRef.current = setTimeout(onClose, 2000);
      }
    } catch (err) {
      if (!mountedRef.current || err?.message === 'cancelled') return;
      if (__DEV__) console.warn('[AddDevice] wait for backend failed:', err);
      showToast(err?.message || 'Could not get the device status. Please try again.');
      setIotifyConnLabel('Idle');
      await goDiscover();
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
    const ssid = selectedHomeSsid;
    let espAlreadyConfigured = false;
    setBusy(true);
    setVerifyCursor(0);
    setUiStep('verify');
    setIotifyConnLabel('Idle');
    try {
      console.log('[AddDevice] Sending home Wi-Fi to SoftAP…', {
        homeSsid: ssid,
        deviceSsid,
        managerId,
      });

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
      espAlreadyConfigured = /updated/i.test(String(cfg?.message || ''));
      console.log('[AddDevice] SoftAP configure accepted — waiting for backend', {
        espMessage: cfg?.message,
        espAlreadyConfigured,
      });
      if (mountedRef.current) {
        setVerifyCursor(3);
        showToast('Wi-Fi details sent to AC Kit', 'success', 2500);
      }
    } catch (err) {
      console.warn('[AddDevice] SoftAP configure failed:', {
        message: err?.message,
        code: err?.code,
        status: err?.response?.status,
      });
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
          // SoftAP gone — start over
        }
      }
      if (mountedRef.current) {
        if (rejoined) {
          showToast(
            `${describeDeviceConfigError(err)} Check the Wi-Fi password and try again.`
          );
          setUiStep('wifiPassword');
          setHomePassword('');
        } else {
          showToast(
            'Lost connection to the AC Kit. Connect to the device again, then retry.'
          );
          await goDiscover();
        }
        setBusy(false);
      }
      return;
    }
    if (!mountedRef.current) return;
    setBusy(false);
    setHomePassword('');
    await waitForBackend(espAlreadyConfigured);
  };

  const handleCreated = (device, { confirmed = true } = {}) => {
    setUnits((prev) => [...prev.filter((u) => u.id !== device.id), device]);
    setUiStep('complete');
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
    void goDiscover();
  };

  const verifyItems = useMemo(
    () =>
      VERIFY_LABELS.map((label, i) => {
        if (i < verifyCursor) return { label, status: 'done' };
        if (i === verifyCursor) return { label, status: 'active' };
        return { label, status: 'pending' };
      }),
    [verifyCursor]
  );

  const stepperIndex = stepIndexFor(uiStep);

  const renderPermissionOrScanGate = () => {
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
    if (scanning && deviceNetworks.length === 0 && homeNetworks.length === 0) {
      return <EmptyState loading title="Scanning" message="Looking for nearby Wi-Fi…" />;
    }
    return null;
  };

  const renderDiscover = () => {
    const gate = renderPermissionOrScanGate();
    return (
      <WizardCard>
        <Text className="text-xl font-black tracking-tight text-slate-900">
          Nearby ACKit Devices
        </Text>
        <Text className="mt-1.5 text-sm font-medium leading-5 text-slate-500">
          Select an ACKit device near you to begin setup.
        </Text>
        <Text className="mb-3 mt-3 text-xs font-semibold text-slate-400">
          Locally discovered
        </Text>

        <View className="min-h-0 flex-1">
          {gate ||
            (deviceNetworks.length === 0 ? (
              <EmptyState
                title="No AC Kit Found"
                message="Make sure the device is powered on and in setup mode, then scan again."
                actionLabel="Scan Again"
                onAction={runScan}
              />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {deviceNetworks.map((n) => (
                  <SelectableRow
                    key={n.ssid}
                    title={n.ssid}
                    subtitle={`Available · ${wifiSignalSubtitle(n.level)}`}
                    selected={selectedDeviceSsid === n.ssid}
                    onPress={() => setSelectedDeviceSsid(n.ssid)}
                  />
                ))}
              </ScrollView>
            ))}
        </View>

        <View className="mt-3 flex-row gap-3">
          <SecondaryButton
            label="Scan Again"
            onPress={runScan}
            disabled={scanning || permission !== 'granted'}
          />
          <PrimaryButton
            label="Connect"
            disabled={!selectedDeviceSsid}
            onPress={() => {
              setDevicePassword('');
              setNeedsWifiToggle(false);
              setLocalConnLabel('Idle');
              setUiStep('connect');
            }}
          />
        </View>
      </WizardCard>
    );
  };

  const renderConnect = () => (
    <WizardCard>
      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
        contentContainerStyle={{ paddingBottom: 8 }}
      >
        <BackLink
          disabled={busy}
          onPress={() => {
            setDevicePassword('');
            setUiStep('discover');
          }}
        />
        <Text className="text-xl font-black tracking-tight text-slate-900">
          Connect to ACKit
        </Text>
        <Text className="mt-1.5 text-sm font-medium leading-5 text-slate-500">
          Connect to the local setup access point for device {selectedDeviceSsid}.
        </Text>
        <Text className="mt-4 text-sm font-bold text-slate-800">
          SSID: {selectedDeviceSsid}
        </Text>

        <View className="mt-4">
          <TextField
            label="AP Password"
            required
            value={devicePassword}
            onChangeText={setDevicePassword}
            placeholder="Enter device Wi-Fi password"
            secure
            autoFocus
            onSubmitEditing={() => {
              if (devicePassword.length >= 8 && !busy) {
                void handleConnectDevice(devicePassword);
              }
            }}
          />
        </View>

        {needsWifiToggle ? (
          <Pressable
            onPress={() => void openWifiSettingsPanel()}
            className="mt-3 items-center rounded-xl border border-slate-200 bg-white py-2.5"
          >
            <Text className="text-xs font-bold text-slate-700">
              Open Wi-Fi settings
            </Text>
          </Pressable>
        ) : null}

        <Text className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-400">
          {needsWifiToggle
            ? 'Android cached a bad attempt. Turn Wi-Fi Off then On, come back, and Connect with the correct password.'
            : 'Android may show its own sheet — tap the AC Kit there to allow the connection.'}
        </Text>

        <View className="mt-4 flex-row flex-wrap gap-2">
          <StatusPill label={`Local connection: ${localConnLabel}`} />
          <StatusPill label={`Secure IoTify connection: ${iotifyConnLabel}`} />
        </View>

        <View className="mt-6 flex-row gap-3">
          <PrimaryButton
            label="Connect"
            busy={busy}
            busyLabel="Connecting…"
            disabled={devicePassword.length < 8}
            onPress={() => void handleConnectDevice(devicePassword)}
          />
          <SecondaryButton
            label="Having trouble?"
            disabled={busy}
            onPress={() => setTroubleOpen(true)}
          />
        </View>
      </KeyboardAwareScrollView>
    </WizardCard>
  );

  const renderNetwork = () => {
    const gate = renderPermissionOrScanGate();
    return (
      <WizardCard>
        <BackLink
          disabled={busy}
          onPress={() => {
            void goDiscover();
          }}
        />
        <Text className="text-xl font-black tracking-tight text-slate-900">
          Select Wi-Fi
        </Text>
        <Text className="mt-1.5 mb-3 text-sm font-medium leading-5 text-slate-500">
          Choose the network to provision on ACKit. AC Kit works with 2.4 GHz networks only.
        </Text>

        <View className="min-h-0 flex-1">
          {gate ||
            (homeNetworks.length === 0 ? (
              <EmptyState
                title="No Networks Found"
                message="Tap Rescan to scan again."
                actionLabel="Rescan"
                onAction={runScan}
              />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {homeNetworks.map((n) => (
                  <SelectableRow
                    key={n.ssid}
                    title={n.ssid}
                    subtitle={wifiSignalSubtitle(n.level)}
                    selected={selectedHomeSsid === n.ssid}
                    secured={n.secured}
                    showWifiIcon
                    onPress={() => setSelectedHomeSsid(n.ssid)}
                  />
                ))}
              </ScrollView>
            ))}
        </View>

        <View className="mt-3 flex-row gap-3">
          <SecondaryButton
            label="Rescan"
            onPress={runScan}
            disabled={scanning || permission !== 'granted'}
          />
          <PrimaryButton
            label="Continue"
            disabled={!selectedHomeSsid}
            onPress={() => {
              setHomePassword('');
              setUiStep('wifiPassword');
            }}
          />
        </View>
      </WizardCard>
    );
  };

  const renderWifiPassword = () => (
    <WizardCard>
      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
        contentContainerStyle={{ paddingBottom: 8 }}
      >
        <BackLink
          disabled={busy}
          onPress={() => {
            setHomePassword('');
            setUiStep('network');
          }}
        />
        <Text className="text-xl font-black tracking-tight text-slate-900">
          Connect Wi-Fi
        </Text>
        <Text className="mt-2 text-sm font-semibold text-slate-500">
          Network selected: {selectedHomeSsid}
        </Text>

        <View className="mt-4">
          <TextField
            label="Password"
            required
            value={homePassword}
            onChangeText={setHomePassword}
            placeholder="Enter Wi-Fi password"
            secure
            autoFocus
            onSubmitEditing={() => {
              if (homePassword.length >= 8 && !busy) {
                void handleSendConfig(homePassword);
              }
            }}
          />
        </View>

        <Text className="mt-3 text-sm font-medium leading-5 text-slate-500">
          This may take up to 2 minutes. Please keep ACKit powered on.
        </Text>

        <View className="mt-6">
          <PrimaryButton
            label="Connect ACKit"
            busy={busy}
            disabled={homePassword.length < 8}
            onPress={() => void handleSendConfig(homePassword)}
          />
        </View>
      </KeyboardAwareScrollView>
    </WizardCard>
  );

  const renderVerify = () => (
    <WizardCard>
      <Text className="text-xl font-black tracking-tight text-slate-900">
        Connecting ACKit to Wi-Fi
      </Text>
      <Text className="mt-1.5 text-sm font-medium leading-5 text-slate-500">
        This may take up to 2 minutes. Please keep ACKit powered on.
      </Text>
      <View className="mt-5">
        <ProgressChecklist items={verifyItems} />
      </View>
    </WizardCard>
  );

  const renderConfigure = () => (
    <WizardCard>
      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
        contentContainerStyle={{ paddingBottom: 8 }}
      >
        <BackLink disabled={false} onPress={handleConfigureCancel} />
        <ConfigureDeviceModal
          asPage
          isOpen
          device={setupDevice}
          toast={toast}
          showToast={showToast}
          onCancel={handleConfigureCancel}
          onCreated={handleCreated}
        />
      </KeyboardAwareScrollView>
    </WizardCard>
  );

  const renderComplete = () => (
    <WizardCard>
      <View className="flex-1 items-center justify-center px-4 py-8">
        <View className="mb-5 h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <Text className="text-3xl font-black text-emerald-600">✓</Text>
        </View>
        <Text className="mb-2 text-center text-xl font-black text-slate-900">
          Device Configured!
        </Text>
        <Text className="max-w-[260px] text-center text-sm font-medium leading-5 text-slate-500">
          Your AC Kit has been set up successfully.
        </Text>
      </View>
    </WizardCard>
  );

  const body = (() => {
    switch (uiStep) {
      case 'connect':
        return renderConnect();
      case 'network':
        return renderNetwork();
      case 'wifiPassword':
        return renderWifiPassword();
      case 'verify':
        return renderVerify();
      case 'configure':
        return renderConfigure();
      case 'complete':
        return renderComplete();
      case 'discover':
      default:
        return renderDiscover();
    }
  })();

  return (
    <View className={embedded ? 'min-h-0 flex-1' : 'flex-1 bg-[#f8fafc] px-5 pb-6 pt-4'}>
      <SetupStepper activeIndex={stepperIndex} />

      {uiStep !== 'configure' && toast?.message ? (
        <View pointerEvents="none" className="mb-2">
          <Toast toast={toast} />
        </View>
      ) : null}

      {body}

      <TroubleshootingModal
        isOpen={troubleOpen}
        onClose={() => setTroubleOpen(false)}
      />
    </View>
  );
}
