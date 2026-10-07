import api from './axios';

/** Mirrors ackitFrontend/src/api/deviceApi.ts — ACUnit shape for dashboard */

const emptyEnergy = () => ({
  hourly: [{ label: '00:00', kwh: 0 }],
  daily: [{ label: new Date().toISOString().split('T')[0], kwh: 0 }],
  weekly: [{ label: 'Week 1', kwh: 0 }],
  monthly: [{ label: new Date().toISOString().slice(0, 7), kwh: 0 }],
  yearly: [{ label: new Date().getFullYear().toString(), kwh: 0 }],
});

export function mapApiDevice(device) {
  const venueId =
    typeof device.venue === 'string' ? device.venue : device.venue._id;
  const organizationId =
    typeof device.organization === 'string'
      ? device.organization
      : device.organization._id;
  const brandId =
    typeof device.brand === 'string' ? device.brand : device.brand._id;
  const brandName =
    typeof device.brand === 'string' ? '' : device.brand.brandName || '';

  const remote = device.remote || 'unlock';

  return {
    id: device._id,
    name: device.deviceName,
    venueId,
    organizationId,
    brandId,
    isOn: device.state === 'on',
    currentTemp: device.temperature ?? 16,
    targetTemp: device.temperature ?? 16,
    isLocked: remote === 'lock' || remote === 'superlock',
    eventLocked: remote === 'superlock',
    hasFault: device.health === 'faulty',
    healthAlert: device.healthAlert || '',
    brand: brandName,
    capacityTon: `${device.capacity}ton`,
    hasEnergySensor: true,
    voltage: device.voltage ?? 230,
    current: device.current ?? 0,
    powerConsumption: device.powerConsumption ?? 0,
    ventTemperature:
      typeof device.ventTemperature === 'number' ? device.ventTemperature : null,
    mode: device.mode
      ? device.mode.charAt(0).toUpperCase() + device.mode.slice(1)
      : undefined,
    fanSpeed: device.fanSpeed
      ? device.fanSpeed.charAt(0).toUpperCase() + device.fanSpeed.slice(1)
      : undefined,
    apiKey: device.apikey || '',
    status: device.status === 'online' ? 'online' : 'offline',
    energyConsumption: emptyEnergy(),
    events: [],
  };
}

export async function getDeviceBrandOptions() {
  const { data } = await api.get('/api/device/brand-options');
  return (data.brands || []).map((brand) => ({
    id: String(brand._id),
    name: brand.brandName,
  }));
}

/**
 * ESP devices that announced themselves over MQTT but are not added yet.
 * GET /api/device/by-manager/:managerId/unconfigured
 */
export async function getUnconfiguredDevices(managerId) {
  if (!managerId) return [];
  const { data } = await api.get(
    `/api/device/by-manager/${managerId}/unconfigured`,
    { timeout: 8000 }
  );
  return (data.devices || []).map((d) => ({
    id: String(d._id),
    macAddress: d.macAddress,
    name: d.name,
    managerId: String(d.managerId),
    status: d.status,
    configured: Boolean(d.configured),
  }));
}

/**
 * Devices already added by this manager (lightweight shape).
 * GET /api/device/by-manager/:managerId/configured
 */
export async function getConfiguredDevicesByManager(managerId) {
  if (!managerId) return [];
  const { data } = await api.get(
    `/api/device/by-manager/${managerId}/configured`,
    { timeout: 8000 }
  );
  return (data.devices || []).map((d) => ({
    id: String(d._id),
    macAddress: d.macAddress || '',
    name: d.deviceName,
    status: d.status,
    venueName: d.venue?.name || '',
    organizationName: d.organization?.name || '',
  }));
}

/** payload: { name, organization, venue, brand, capacity, macAddress } */
export async function createDevice(payload) {
  const { data } = await api.post('/api/device/create', payload);
  return mapApiDevice(data.device);
}

const normalizeMac = (mac) =>
  String(mac || '').replace(/[^0-9a-f]/gi, '').toUpperCase();

/**
 * Looks for an already-added device with this MAC among the manager's devices
 * and returns it as an ACUnit (or null). Used to recover when `create` actually
 * succeeded on the server but the response never reached the phone.
 * Retries a few times because the phone's network may still be recovering.
 */
export async function findAddedDeviceByMac(
  managerId,
  macAddress,
  { attempts = 1, delayMs = 1500 } = {}
) {
  const mac = normalizeMac(macAddress);
  if (!managerId || !mac) return null;

  for (let i = 0; i < attempts; i += 1) {
    try {
      const list = await getConfiguredDevicesByManager(managerId);
      const hit = list.find((d) => normalizeMac(d.macAddress) === mac);
      if (hit) return await getDeviceById(hit.id);
      return null; // list loaded and the MAC is not there
    } catch {
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  return null;
}

export async function getDevicesByVenue(venueId) {
  if (!venueId) return [];
  const { data } = await api.get(`/api/device/by-venue/${venueId}`);
  return (data.devices || []).map(mapApiDevice);
}

export async function getDeviceById(id) {
  const { data } = await api.get(`/api/device/${id}`);
  return mapApiDevice(data.device);
}

/** PUT /api/device/update/:id */
export async function updateDevice(id, payload) {
  const { data } = await api.put(`/api/device/update/${id}`, payload);
  return mapApiDevice(data.device);
}

/** DELETE /api/device/delete/:id */
export async function deleteDevice(id) {
  await api.delete(`/api/device/delete/${id}`);
}

/**
 * POST /api/device/reset/respond
 * Manager approves/rejects ESP factory-reset request.
 */
export async function respondDeviceReset(requestId, approved) {
  const { data } = await api.post('/api/device/reset/respond', {
    requestId,
    approved: Boolean(approved),
  });
  return data;
}

export async function setDevicePower(id, state) {
  const { data } = await api.post(`/api/device/power/${id}`, { state });
  return {
    requestedState: data.requestedState,
    currentState: data.currentState,
  };
}

export async function setDeviceTemperature(id, temperature) {
  const { data } = await api.post(`/api/device/temperature/${id}`, {
    temperature,
  });
  return {
    requestedTemperature: data.requestedTemperature,
    currentTemperature: data.currentTemperature,
  };
}

export async function setDeviceMode(id, mode) {
  const { data } = await api.post(`/api/device/mode/${id}`, { mode });
  return {
    applied: Boolean(data.applied),
    skipped: Boolean(data.skipped),
    mode: data.mode,
  };
}

export async function setDeviceFan(id, fan) {
  const { data } = await api.post(`/api/device/fan/${id}`, { fan });
  return {
    applied: Boolean(data.applied),
    skipped: Boolean(data.skipped),
    fan: data.fan,
  };
}

export async function setDeviceRemote(id, remote) {
  const { data } = await api.put(`/api/device/remote/${id}`, { remote });
  return { remote: data.remote };
}
