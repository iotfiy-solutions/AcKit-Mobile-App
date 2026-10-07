import { Linking, PermissionsAndroid, Platform } from 'react-native';
import WifiManager from 'react-native-wifi-reborn';

/**
 * Native Wi-Fi helper for the AC Kit SoftAP setup flow (Android only).
 *
 * Android 10+ WifiNetworkSpecifier can cache a failed SoftAP passphrase
 * (Google 158610374). Apps cannot toggle Wi-Fi with setEnabled(). After a
 * second fail for the same SSID we surface `needsWifiToggle` so the UI can
 * open Settings for a manual Off/On — the only reliable OS workaround.
 */

export const isWifiSetupSupported = Platform.OS === 'android';

/** SSID that last failed SoftAP connect — next retry gets extra teardown cooldown. */
let stickyAuthFailSsid = '';

function wifiLog(...args) {
  if (__DEV__) console.log('[Wifi]', ...args);
}

function wifiWarn(...args) {
  if (__DEV__) console.warn('[Wifi]', ...args);
}

/**
 * Any SSID containing "ackit" or "ac-kit" (any letter case) is an AC Kit
 * device AP — shown in Nearby AC Kits, hidden from Select Wifi.
 */
export const isAckitSsid = (ssid) => /ac-?kit/i.test(String(ssid || ''));

function requiredPermissions() {
  const list = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  if (Platform.Version >= 33) {
    list.push(PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES);
  }
  return list;
}

/** Silent check — never shows a system prompt. */
export async function hasWifiPermissions() {
  if (!isWifiSetupSupported) return false;
  const checks = await Promise.all(
    requiredPermissions().map((p) => PermissionsAndroid.check(p))
  );
  return checks.every(Boolean);
}

/**
 * Returns 'granted' | 'denied' | 'blocked'.
 * If already granted, no prompt is shown.
 */
export async function ensureWifiPermissions() {
  if (!isWifiSetupSupported) return 'denied';
  if (await hasWifiPermissions()) return 'granted';

  const perms = requiredPermissions();
  const result = await PermissionsAndroid.requestMultiple(perms);
  const values = perms.map((p) => result[p]);
  if (values.every((v) => v === PermissionsAndroid.RESULTS.GRANTED)) {
    return 'granted';
  }
  if (values.some((v) => v === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)) {
    return 'blocked';
  }
  return 'denied';
}

function errorCode(err) {
  return String(err?.code || err?.message || '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAuthLikeError(err) {
  const code = errorCode(err);
  return /authenticationErrorOccurred|couldNotConnect|unableToConnect|failedToConnect|wrong.?password|auth|could not connect/i.test(
    code
  );
}

/**
 * SoftAP connect fails that should enter the sticky-retry / Wi-Fi-toggle path.
 * Wrong SoftAP password often surfaces as didNotFindNetwork / timeoutOccurred.
 */
function isStickyRetryError(err) {
  const code = errorCode(err);
  if (/userDenied|userRejected|cancelled|canceled/i.test(code)) return false;
  if (isAuthLikeError(err)) return true;
  return /didNotFindNetwork|timeoutOccurred|unableToConnect|couldNotConnect|failedToConnect|needsWifiToggle/i.test(
    code
  );
}

export function describeScanError(err) {
  const code = errorCode(err);
  if (/wifiDisabled/i.test(code)) {
    return 'Wi-Fi is turned off. Please turn on Wi-Fi and try again.';
  }
  if (/locationServicesOff/i.test(code)) {
    return 'Location is turned off. Please turn on Location (GPS) to scan nearby Wi-Fi.';
  }
  if (/locationPermissionMissing/i.test(code)) {
    return 'Location permission is required to scan nearby Wi-Fi.';
  }
  return 'Could not scan Wi-Fi networks. Please try again.';
}

function normalizeList(list) {
  const bySsid = new Map();
  (list || []).forEach((entry) => {
    const ssid = String(entry?.SSID || '').trim();
    if (!ssid) return;
    const level = typeof entry.level === 'number' ? entry.level : -100;
    const existing = bySsid.get(ssid);
    if (!existing || level > existing.level) {
      bySsid.set(ssid, {
        ssid,
        level,
        secured: /WPA|WEP|PSK|SAE|EAP/i.test(String(entry?.capabilities || '')),
      });
    }
  });
  return Array.from(bySsid.values()).sort((a, b) => b.level - a.level);
}

/**
 * Scan nearby networks. Android throttles active scans, so if a fresh scan is
 * refused we fall back to the OS' last cached results.
 */
export async function scanWifi() {
  const enabled = await WifiManager.isEnabled();
  if (!enabled) {
    const err = new Error('Wi-Fi is disabled');
    err.code = 'wifiDisabled';
    throw err;
  }

  try {
    return normalizeList(await WifiManager.reScanAndLoadWifiList());
  } catch (err) {
    const code = errorCode(err);
    if (/locationServicesOff|locationPermissionMissing/i.test(code)) {
      throw err;
    }
    return normalizeList(await WifiManager.loadWifiList());
  }
}

export function describeConnectError(err) {
  const code = errorCode(err);
  if (/needsWifiToggle/i.test(code)) {
    return (
      err?.message ||
      'Android cached the failed connection. Turn Wi-Fi Off then On, then retry with the correct password.'
    );
  }
  if (/authenticationErrorOccurred/i.test(code)) {
    return 'Wrong password or authentication failed. Please check and try again.';
  }
  if (/timeoutOccurred/i.test(code)) {
    return 'Timed out. When the Android sheet appears, tap the AC Kit quickly to allow the connection.';
  }
  if (/didNotFindNetwork/i.test(code)) {
    return 'Could not join the AC Kit. Check the password, and when Android shows its sheet tap the AC Kit to allow.';
  }
  if (/userDenied|userRejected/i.test(code)) {
    return 'Connection request was cancelled.';
  }
  if (/couldNotEnableWifi/i.test(code)) {
    return 'Please turn on Wi-Fi and try again.';
  }
  if (/couldNotConnect|unableToConnect|failedToConnect/i.test(code)) {
    return 'Could not connect to Wi-Fi. Check password or toggle Wi-Fi if retrying.';
  }
  return err?.message || 'Could not connect to the device Wi-Fi.';
}

/**
 * Unbind app traffic from a previous SoftAP NetworkCallback.
 * Does NOT disconnect the phone's current Wi-Fi — that races SoftAP join.
 */
async function unbindSoftApOnly() {
  if (!isWifiSetupSupported) return;
  wifiLog('unbindSoftApOnly');
  try {
    await WifiManager.forceWifiUsageWithOptions(false, { noInternet: false });
  } catch (e) {
    wifiWarn('forceWifiUsage off error:', e?.message || e);
  }
  await sleep(300);
}

/**
 * Pin process traffic to the SoftAP again.
 * Android 12+ dual-STA keeps home Wi-Fi / cellular preferred, so a bind
 * done at SoftAP join often expires by the time the user picks home Wi-Fi.
 */
export async function bindSoftApTraffic() {
  if (!isWifiSetupSupported) return;
  wifiLog('bindSoftApTraffic (noInternet)');
  try {
    await WifiManager.forceWifiUsageWithOptions(true, { noInternet: true });
  } catch (e) {
    wifiWarn('bindSoftApTraffic error:', e?.message || e);
  }
  await sleep(500);
}

/**
 * Before SoftAP HTTP: re-pin process traffic to the SoftAP and ping it.
 *
 * NOTE: we deliberately do NOT compare getCurrentWifiSSID() with the device
 * SSID. On Android 10+ the SoftAP is joined through WifiNetworkSpecifier (a
 * separate local-only network), so WifiInfo keeps reporting the phone's
 * primary Wi-Fi / "<unknown ssid>" and a comparison would wrongly trigger a
 * pointless rejoin. react-native-wifi-reborn already holds the joined Network
 * and forceWifiUsageWithOptions(true) re-selects it.
 *
 * Order: bind → ping; if that fails, wait + bind → ping; only then a full
 * SoftAP rejoin (last resort) → ping.
 *
 * @param {{ ssid: string, password?: string|null, ping: () => Promise<{ok:boolean}> }} opts
 */
export async function ensureSoftApReady({ ssid, password, ping }) {
  const target = String(ssid || '');
  const doPing = async () =>
    typeof ping === 'function' ? await ping() : { ok: true };
  wifiLog('ensureSoftApReady', { target });

  await bindSoftApTraffic();
  let result = await doPing();
  if (result?.ok) return { ok: true, rejoined: false };

  wifiLog('ensureSoftApReady: ping failed — wait, rebind, retry');
  await sleep(1500);
  await bindSoftApTraffic();
  result = await doPing();
  if (result?.ok) return { ok: true, rejoined: false };

  if (target) {
    wifiLog('ensureSoftApReady: still failing — rejoin SoftAP (last resort)');
    await connectToDevice(target, password || null);
    result = await doPing();
    if (result?.ok) return { ok: true, rejoined: true };
  }

  wifiWarn('ensureSoftApReady: SoftAP still unreachable');
  return { ok: false, ping: result };
}

/**
 * Full teardown when leaving SoftAP setup (after config / cancel).
 */
export async function releaseDeviceNetwork() {
  if (!isWifiSetupSupported) return;
  wifiLog('releaseDeviceNetwork: unbind + disconnect');
  try {
    await WifiManager.forceWifiUsageWithOptions(false, { noInternet: false });
  } catch (e) {
    wifiWarn('forceWifiUsage off error:', e?.message || e);
  }
  try {
    await WifiManager.disconnect();
  } catch (e) {
    wifiWarn('disconnect error:', e?.message || e);
  }
  await sleep(400);
}

/**
 * Android 10+ quick Wi-Fi panel — only when the user taps a button (Off/On).
 */
export async function openWifiSettingsPanel() {
  if (!isWifiSetupSupported) return false;
  try {
    wifiLog('openWifiSettingsPanel (user requested)');
    await Linking.sendIntent('android.settings.panel.action.WIFI');
    return true;
  } catch (e) {
    wifiWarn('WIFI panel failed, opening full settings:', e?.message || e);
    try {
      await Linking.sendIntent('android.settings.WIFI_SETTINGS');
      return true;
    } catch (e2) {
      wifiWarn('WIFI_SETTINGS failed:', e2?.message || e2);
      return false;
    }
  }
}

/**
 * Join the device SoftAP and pin app traffic to it (no internet).
 * Android may show a system sheet to approve the join.
 */
export async function connectToDevice(ssid, password) {
  const target = String(ssid || '');
  wifiLog('connectToDevice attempt', {
    target,
    passwordLen: password ? String(password).length : 0,
    sticky: stickyAuthFailSsid || '(none)',
    api: Platform.Version,
  });

  await unbindSoftApOnly();

  if (stickyAuthFailSsid && stickyAuthFailSsid === target) {
    wifiLog('retry after failure on same SSID — extra cooldown');
    await sleep(1500);
  }

  try {
    wifiLog('connectToProtectedWifiSSID…');
    await WifiManager.connectToProtectedWifiSSID({
      ssid: target,
      password: password || null,
      isWEP: false,
      isHidden: false,
      timeout: 45,
    });

    wifiLog('connected — wait for DHCP then bind (noInternet)');
    await sleep(500);
    try {
      await WifiManager.forceWifiUsageWithOptions(true, { noInternet: true });
    } catch (e) {
      wifiWarn('forceWifiUsage on warning:', e?.message || e);
    }

    stickyAuthFailSsid = '';
    wifiLog('connectToDevice done');
  } catch (err) {
    const stickyWorthy = isStickyRetryError(err);
    wifiWarn('connectToDevice failed:', {
      code: err?.code,
      message: err?.message,
      authLike: isAuthLikeError(err),
      stickyWorthy,
      stickyBefore: stickyAuthFailSsid || '(none)',
    });
    await unbindSoftApOnly();

    if (stickyWorthy) {
      if (stickyAuthFailSsid === target) {
        stickyAuthFailSsid = '';
        wifiLog('second sticky fail — needsWifiToggle');
        const customErr = new Error(
          'Android cached the previous failed attempt. Turn Wi-Fi Off then On (use the button below), then retry with the correct password.'
        );
        customErr.code = 'needsWifiToggle';
        customErr.cause = err;
        throw customErr;
      }
      stickyAuthFailSsid = target;
      wifiLog('marked stickyAuthFailSsid =', target);
    }
    throw err;
  }
}
