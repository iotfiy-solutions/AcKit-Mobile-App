import NetInfo from '@react-native-community/netinfo';
import { getAppSocket } from './brandSocket';
import { getConfiguredDevicesByManager, getUnconfiguredDevices } from './deviceApi';

/**
 * Waits until the ESP that just received Wi-Fi credentials shows up on the
 * backend (it announces itself over MQTT → backend emits "Unconfigured").
 *
 * Two sources, whichever answers first wins:
 *  1. websocket event `Unconfigured` (room manager:{id}, joined via JWT)
 *  2. REST poll GET /api/device/by-manager/:id/unconfigured
 *     → covers the case where the event fired while the phone was still
 *       reconnecting to the internet, and sub-users (not in the manager room).
 *
 * The device is matched by name: SoftAP SSID "Ac-Kit-46EC" ↔ backend name
 * "Ac-Kit-46EC" (both = last 4 hex of the MAC).
 *
 * The 2-minute device-online timer starts ONLY after the phone has internet
 * again (SoftAP leave / home Wi-Fi reconnect time does not burn that budget).
 */
export const DEVICE_SETUP_EVENT = 'Unconfigured';
export const DEVICE_WIFI_UPDATED_EVENT = 'device:wifiUpdated';
export const DEVICE_PROVISIONED_EVENT = 'device:provisioned';
export const DEVICE_SETUP_WAIT_MS = 120000;
export const DEVICE_PROVISION_WAIT_MS = 20000;
/** Max time to wait for the phone itself to regain internet after SoftAP. */
export const INTERNET_READY_WAIT_MS = 300000;
const POLL_INTERVAL_MS = 4000;

const TIMEOUT_MESSAGE =
  'Your AC Kit did not come online. Check the Wi-Fi password and try again.';

const INTERNET_TIMEOUT_MESSAGE =
  'Your phone did not reconnect to the internet in time. Join your home Wi-Fi and try again.';

/**
 * The ESP answered "WiFi updated" (not "Configuration saved"): its flash still
 * holds an old DEVICE_ID, so it skips first-time registration and only
 * publishes status for that ID. If this account's backend has no Device with
 * that ID, nothing ever appears here — a password retry will not help.
 */
const ALREADY_CONFIGURED_TIMEOUT_MESSAGE =
  'The AC Kit joined Wi-Fi but is not registered on this server (it still holds an old device ID). Factory-reset or erase the AC Kit flash, then add it again.';

// Always on (not only __DEV__) so release builds can be diagnosed via logcat.
const setupLog = (...args) => console.log('[SetupWait]', ...args);

/** "Ac-Kit-42C7" → "42C7" (last 4 hex of the device MAC), else '' */
const macSuffixFromName = (name) => {
  const m = String(name || '').match(/ac-?kit-?([0-9a-f]{4})$/i);
  return m ? m[1].toUpperCase() : '';
};
const macHex = (mac) => String(mac || '').replace(/[^0-9a-f]/gi, '').toUpperCase();

const sameName = (a, b) =>
  String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/** Phone has a usable path to the backend (not SoftAP-only / offline). */
function isInternetReady(state) {
  if (!state?.isConnected) return false;
  // null = unknown (common briefly on Android) — treat as not ready yet
  if (state.isInternetReachable === false || state.isInternetReachable == null) {
    return false;
  }
  return true;
}

/**
 * Resolves when NetInfo reports internet, or rejects on cancel / max wait.
 * @returns {{ promise: Promise<void>, cancel: () => void }}
 */
function waitForPhoneInternet({ timeoutMs = INTERNET_READY_WAIT_MS } = {}) {
  let cancelFn = () => {};
  const promise = new Promise((resolve, reject) => {
    let done = false;
    let unsub = null;
    let timer = null;

    const finish = (fn) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (typeof unsub === 'function') unsub();
      fn();
    };

    cancelFn = () => finish(() => reject(new Error('cancelled')));

    timer = setTimeout(
      () => finish(() => reject(new Error(INTERNET_TIMEOUT_MESSAGE))),
      timeoutMs
    );

    const onReady = () => {
      setupLog('phone internet ready — starting device online wait timer');
      finish(() => resolve());
    };

    NetInfo.fetch()
      .then((state) => {
        if (done) return;
        if (isInternetReady(state)) {
          onReady();
          return;
        }
        setupLog('waiting for phone internet before starting setup timer…', {
          isConnected: state?.isConnected,
          isInternetReachable: state?.isInternetReachable,
          type: state?.type,
        });
        unsub = NetInfo.addEventListener((next) => {
          if (done || !isInternetReady(next)) return;
          onReady();
        });
      })
      .catch(() => {
        // If NetInfo fails, fall through: start wait anyway so setup is not stuck.
        if (done) return;
        setupLog('NetInfo.fetch failed — starting setup wait without internet gate');
        finish(() => resolve());
      });
  });

  return { promise, cancel: () => cancelFn() };
}

/**
 * @param {{ managerId: string, deviceName?: string, timeoutMs?: number }} opts
 * @returns {{ promise: Promise<{status: 'configured'|'unconfigured', device: any}>, cancel: () => void }}
 */
export function waitForDeviceSetupStatus({
  managerId,
  deviceName = '',
  timeoutMs = DEVICE_SETUP_WAIT_MS,
  alreadyConfigured = false,
} = {}) {
  let cancelFn = () => {};

  const promise = new Promise((resolve, reject) => {
    let socket = null;
    let timer = null;
    let pollTimer = null;
    let internetWaiter = null;
    let done = false;

    const isOurs = (d) =>
      d &&
      String(d.managerId) === String(managerId) &&
      (!deviceName || sameName(d.name, deviceName));

    const finish = (fn) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (pollTimer) clearTimeout(pollTimer);
      internetWaiter?.cancel();
      internetWaiter = null;
      if (socket) {
        socket.off(DEVICE_SETUP_EVENT, onEvent);
        socket.off(DEVICE_WIFI_UPDATED_EVENT, onWifiUpdated);
      }
      fn();
    };

    function onEvent(payload) {
      if (__DEV__) console.log('[SetupSocket IN Event]', payload);
      if (!isOurs(payload)) return;
      const device = {
        id: String(payload._id || ''),
        macAddress: payload.macAddress,
        name: payload.name,
        managerId: String(payload.managerId),
        status: payload.status,
        configured: Boolean(payload.configured),
      };
      if (__DEV__) console.log('[SetupSocket Matched Device]', device);
      finish(() =>
        resolve({ status: device.configured ? 'configured' : 'unconfigured', device })
      );
    }

    const poll = async () => {
      if (done) return;
      try {
        const list = await getUnconfiguredDevices(managerId);
        setupLog(
          `poll unconfigured: ${list.length} for manager=${managerId}, want name=${deviceName}`,
          list.map((d) => `${d.name}:${d.status}:${d.configured ? 'cfg' : 'uncfg'}`)
        );
        const found = list.find(
          (d) => d.status === 'online' && !d.configured && isOurs(d)
        );
        if (found) {
          if (__DEV__) console.log('[SetupPoll Matched Device]', found);
          finish(() => resolve({ status: 'unconfigured', device: found }));
          return;
        }
      } catch (e) {
        setupLog('poll unconfigured error (retrying):', e?.message, e?.response?.status);
        // network may still be coming back after leaving the device AP — retry
      }

      // Device was already added earlier (only its Wi-Fi changed): the backend
      // sends no "Unconfigured" event for it, so look for it among the added
      // devices — matched by the MAC suffix in its AP name — and wait for it
      // to report online again.
      const suffix = macSuffixFromName(deviceName);
      if (!done && suffix) {
        try {
          const added = await getConfiguredDevicesByManager(managerId);
          setupLog(
            `poll configured: ${added.length} devices, want mac suffix=${suffix}`,
            added.map((d) => `${d.name}:${d.status}:${d.macAddress || 'no-mac'}`)
          );
          const hit = added.find(
            (d) => d.status === 'online' && macHex(d.macAddress).endsWith(suffix)
          );
          if (hit) {
            if (__DEV__) console.log('[SetupPoll Matched Added Device]', hit);
            finish(() => resolve({ status: 'configured', device: hit }));
            return;
          }
        } catch {
          // retry on next tick
        }
      }
      if (!done) pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    // Already-added device whose Wi-Fi was changed: after reboot the ESP sends
    // wifiUpdated → backend emits `device:wifiUpdated` to the manager room.
    function onWifiUpdated(payload) {
      if (__DEV__) console.log('[SetupSocket IN wifiUpdated]', payload);
      const suffix = macSuffixFromName(deviceName);
      if (!suffix || !macHex(payload?.macAddress).endsWith(suffix)) return;
      finish(() =>
        resolve({
          status: 'configured',
          device: {
            id: '',
            macAddress: payload.macAddress || '',
            name: payload.deviceName || deviceName,
            status: 'online',
          },
        })
      );
    }

    const startDeviceWait = () => {
      if (done) return;

      timer = setTimeout(
        () =>
          finish(() =>
            reject(
              new Error(
                alreadyConfigured ? ALREADY_CONFIGURED_TIMEOUT_MESSAGE : TIMEOUT_MESSAGE
              )
            )
          ),
        timeoutMs
      );

      getAppSocket()
        .then((s) => {
          if (done) return;
          socket = s;
          socket.on(DEVICE_SETUP_EVENT, onEvent);
          socket.on(DEVICE_WIFI_UPDATED_EVENT, onWifiUpdated);
        })
        .catch(() => {
          // polling still works without the socket
        });

      pollTimer = setTimeout(poll, 500);
    };

    cancelFn = () => finish(() => reject(new Error('cancelled')));

    internetWaiter = waitForPhoneInternet();
    internetWaiter.promise
      .then(() => {
        internetWaiter = null;
        startDeviceWait();
      })
      .catch((err) => {
        internetWaiter = null;
        if (done) return;
        finish(() =>
          reject(
            err?.message === 'cancelled'
              ? err
              : new Error(err?.message || INTERNET_TIMEOUT_MESSAGE)
          )
        );
      });
  });

  return { promise, cancel: () => cancelFn() };
}

/**
 * After POST /api/device/create the backend sends the API key to the ESP and
 * only marks the unit configured once the ESP confirms (`device:provisioned`).
 * Resolves true as soon as that is confirmed, false on timeout.
 *
 * Sources: websocket `device:provisioned` (matched by MAC) and a REST poll —
 * once the MAC is gone from the unconfigured list, the ESP has confirmed.
 */
export function waitForDeviceProvisioned({
  managerId,
  macAddress,
  timeoutMs = DEVICE_PROVISION_WAIT_MS,
} = {}) {
  let cancelFn = () => {};
  const mac = macHex(macAddress);

  const promise = new Promise((resolve) => {
    let socket = null;
    let timer = null;
    let pollTimer = null;
    let done = false;

    const finish = (value) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (pollTimer) clearTimeout(pollTimer);
      if (socket) socket.off(DEVICE_PROVISIONED_EVENT, onProvisioned);
      resolve(value);
    };

    function onProvisioned(payload) {
      if (__DEV__) console.log('[Provision IN Event]', payload);
      if (mac && macHex(payload?.macAddress) === mac) finish(true);
    }

    const poll = async () => {
      if (done) return;
      try {
        const list = await getUnconfiguredDevices(managerId);
        if (!list.some((d) => macHex(d.macAddress) === mac)) {
          if (__DEV__) console.log('[Provision Poll] MAC no longer unconfigured');
          finish(true);
          return;
        }
      } catch {
        // retry on next tick
      }
      if (!done) pollTimer = setTimeout(poll, 2000);
    };

    cancelFn = () => finish(false);
    timer = setTimeout(() => finish(false), timeoutMs);

    getAppSocket()
      .then((s) => {
        if (done) return;
        socket = s;
        socket.on(DEVICE_PROVISIONED_EVENT, onProvisioned);
      })
      .catch(() => {});

    pollTimer = setTimeout(poll, 1500);
  });

  return { promise, cancel: () => cancelFn() };
}
