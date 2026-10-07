/**
 * Merge REST device rows with in-memory live patches (Socket.IO).
 * Web reference: DevicesManagementPage device:state + device:status;
 * dashboard should keep WS fields when API reloads.
 */

/** Fields updated by device:state | device:alert | device:remote (and app optimistic patches). */
export const LIVE_DEVICE_PATCH_KEYS = [
  'isOn',
  'targetTemp',
  'currentTemp',
  'current',
  'voltage',
  'powerConsumption',
  'ventTemperature',
  'hasFault',
  'healthAlert',
  'isLocked',
  'eventLocked',
  'mode',
  'fanSpeed',
];

/**
 * @param {object} apiDevice — from getDevicesByVenue
 * @param {object | undefined} liveDevice — previous unit in AppContext state
 */
export function mergeApiDeviceWithLive(apiDevice, liveDevice) {
  if (!liveDevice) {
    return { ...apiDevice, _statusLive: false };
  }

  const merged = { ...apiDevice };

  for (const key of LIVE_DEVICE_PATCH_KEYS) {
    if (liveDevice[key] !== undefined) {
      merged[key] = liveDevice[key];
    }
  }

  // Online/offline: after first device:status, never revert to stale API status.
  if (liveDevice._statusLive) {
    merged.status = liveDevice.status;
    merged._statusLive = true;
  } else {
    merged._statusLive = false;
  }

  return merged;
}

export function applyLiveStatusPatch(prevUnit, status) {
  if (status !== 'online' && status !== 'offline') return prevUnit;
  return {
    ...prevUnit,
    status,
    _statusLive: true,
  };
}
