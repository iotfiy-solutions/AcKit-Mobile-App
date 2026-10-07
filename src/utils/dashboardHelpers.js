/** Mirrors helpers inside ackitFrontend/src/components/dashboard/Dashboard.tsx */

export const TEMP_MIN = 16;
export const TEMP_MAX = 30;
export const TEMP_ECO = 24;
export const TEMP_DEBOUNCE_MS = 2000;

export function isDeviceOnline(unit) {
  // After device:status (Socket.IO), only explicit "online" counts.
  if (unit._statusLive) {
    return unit.status === 'online';
  }
  // Bootstrap before first status event: API row (may be stale until MQTT connects).
  return unit.status !== 'offline';
}

export function isOrgVenueBulkTarget(unit) {
  return isDeviceOnline(unit) && !unit.eventLocked;
}

export function filterPowerTempTargets(units, skipSuperlock) {
  return units.filter(
    (u) => isDeviceOnline(u) && !(skipSuperlock && u.eventLocked)
  );
}

export function offlineBulkToastMessage(units, skipSuperlock, action) {
  const online = units.filter(isDeviceOnline);
  if (online.length === 0) {
    return units.length <= 1 ? 'Device is offline' : 'All devices are offline';
  }
  const onlySuper =
    skipSuperlock && online.length > 0 && online.every((u) => u.eventLocked);
  if (onlySuper) return 'Super-locked devices were skipped';
  if (action === 'temperature') return 'No online devices available to set temperature';
  if (action === 'mode') return 'No online devices available for mode control';
  if (action === 'fan') return 'No online devices available for fan control';
  return 'No online devices available to control';
}

/** Energy sparkline path (same math as web buildEnergyWave) */
export function buildEnergyWave(powerKw, deviceCount) {
  const scale = Math.max(deviceCount * 1.5, 2);
  const t = Math.min(1, Math.max(0, powerKw) / scale);
  const width = 120;
  const height = 40;
  const baseline = 34;
  const amp = 6 + t * 16;
  const pts = [];
  for (let x = 0; x <= width; x += 3) {
    const p = x / width;
    const fadeIn = Math.min(1, p / 0.18);
    const y =
      baseline -
      amp *
        fadeIn *
        (0.18 * Math.sin(p * Math.PI * 1.15) +
          0.22 * Math.sin(p * Math.PI * 2.4 + 0.4) +
          0.55 *
            Math.pow(p, 1.35) *
            (0.55 + 0.45 * Math.sin(p * Math.PI * 1.8)));
    pts.push({ x, y: Math.max(4, y) });
  }
  const line = `M${pts.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' L')}`;
  const last = pts[pts.length - 1];
  const area = `${line} L${last.x.toFixed(1)},${height} L0,${height} Z`;
  return { line, area };
}

export function formatTimeAMPM(timeStr) {
  if (!timeStr) return '';
  const parts = String(timeStr).split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].slice(0, 2);
  if (Number.isNaN(hours)) return timeStr;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

export function calculateDefaultEndTime(startTime) {
  if (!startTime) return '04:00';
  const [h, m] = String(startTime).split(':').map(Number);
  const endH = ((h || 0) + 6) % 24;
  return `${String(endH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
}

export function formatDays(days) {
  if (!days || days.length === 0) return 'One-time';
  if (days.length === 7) return 'Mon Tue ... Sun';
  if (days.length === 5 && days.includes('Mon') && days.includes('Fri')) {
    return 'Mon Tue ... Fri';
  }
  return days.join(' ');
}

/** Lock state label for a group of units (same rules as web `lockState`) */
export function resolveLockState(units) {
  if (units.length === 0) return 'Unlocked';
  const allSuperLocked = units.every((u) => u.isLocked && u.eventLocked);
  if (allSuperLocked) return 'Super Locked';
  const allLocked = units.every((u) => u.isLocked);
  if (allLocked) return 'Locked';
  const allUnlocked = units.every((u) => !u.isLocked);
  if (allUnlocked) return 'Unlocked';
  return 'Mixed';
}
