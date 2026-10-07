import axios from 'axios';

/**
 * Talks directly to the AC Kit while the phone is joined to its SoftAP.
 * Uses plain axios on purpose: the shared `api` instance points at the cloud
 * backend and attaches the user's JWT, which must never be sent to the device.
 *
 * SoftAP logs are always printed (not only __DEV__) so production APKs can be
 * diagnosed with: adb logcat *:S ReactNativeJS:V
 */

export const DEVICE_AP_BASE_URL = 'http://192.168.4.1';
export const DEVICE_CONFIG_TIMEOUT_MS = 120000; // 2 minutes

function softApLog(...args) {
  console.log('[SoftAP]', ...args);
}

function softApWarn(...args) {
  console.warn('[SoftAP]', ...args);
}

/** Lightweight reachability check before sending home Wi-Fi credentials. */
export async function pingDeviceSoftAp(timeoutMs = 8000) {
  softApLog(`PING ${DEVICE_AP_BASE_URL}/ (timeout ${timeoutMs}ms)`);
  try {
    const res = await axios.get(`${DEVICE_AP_BASE_URL}/`, {
      timeout: timeoutMs,
      // Device may return 404 on `/` — any HTTP response means we can reach it.
      validateStatus: () => true,
    });
    softApLog(`PING OK status=${res.status}`);
    return { ok: true, status: res.status };
  } catch (err) {
    softApWarn('PING FAIL', {
      message: err?.message,
      code: err?.code,
    });
    return {
      ok: false,
      message: err?.message || 'unreachable',
      code: err?.code || null,
    };
  }
}

function softApUnreachableError(ping) {
  const err = new Error(
    'Could not reach the AC Kit SoftAP. Stay on the device Wi-Fi and try again.'
  );
  err.code = ping?.code || 'SOFTAP_UNREACHABLE';
  err.isSoftApReachability = true;
  return err;
}

/**
 * POST home Wi-Fi credentials to the device SoftAP.
 * Caller should run ensureSoftApReady() first (rebind / SoftAP rejoin).
 * We still ping here; if ping fails we attempt configure once anyway —
 * some OEM dual-STA paths answer POST after a failed GET.
 */
export async function postDeviceConfig({ ssid, password, managerId }) {
  softApLog(`OUT POST ${DEVICE_AP_BASE_URL}/configure`, {
    ssid,
    password: password ? '***' : '',
    managerId,
  });

  let ping = await pingDeviceSoftAp();
  if (!ping.ok) {
    softApWarn('PING failed — retry once after short wait');
    await new Promise((r) => setTimeout(r, 600));
    ping = await pingDeviceSoftAp(10000);
  }

  try {
    const { data } = await axios.post(
      `${DEVICE_AP_BASE_URL}/configure`,
      { ssid, password, managerId },
      {
        timeout: DEVICE_CONFIG_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    softApLog('IN 200 configure OK', data);
    return data;
  } catch (err) {
    softApWarn('ERR configure', {
      message: err?.message,
      code: err?.code,
      status: err?.response?.status,
      data: err?.response?.data,
      pingOk: ping?.ok,
    });
    // Prefer SoftAP reachability wording when we never got a ping and
    // configure also had no HTTP response (network error, not 4xx/5xx).
    if (!ping?.ok && axios.isAxiosError(err) && !err.response) {
      throw softApUnreachableError(ping);
    }
    throw err;
  }
}

export function describeDeviceConfigError(err) {
  if (err?.isSoftApReachability) {
    return err.message;
  }
  if (axios.isAxiosError(err)) {
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return 'The device did not respond within 2 minutes. Please try again.';
    }
    if (err.response) {
      const apiMessage = err.response.data?.message;
      return apiMessage || `Device rejected the request (${err.response.status}).`;
    }
    // Cleartext blocked / no route to SoftAP — common on release APKs without
    // usesCleartextTraffic / networkSecurityConfig for 192.168.4.1
    return 'Could not reach the device. Make sure your phone is connected to the AC Kit Wi-Fi.';
  }
  return err?.message || 'Failed to send Wi-Fi details to the device.';
}
