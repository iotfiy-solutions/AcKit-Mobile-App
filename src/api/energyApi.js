import api from './axios';

/**
 * Fetch energy (kWh) + power for devices from DeviceCurrent time-series.
 * GET /api/device/energy?deviceIds=&period=
 */
export async function getDeviceEnergy(deviceIds, period) {
  if (!deviceIds?.length) {
    return {
      success: true,
      period,
      totalKwh: 0,
      series: [],
      devices: [],
    };
  }

  const { data } = await api.get('/api/device/energy', {
    params: {
      deviceIds: deviceIds.join(','),
      period,
    },
  });

  return {
    ...data,
    devices: Array.isArray(data.devices) ? data.devices : [],
    series: Array.isArray(data.series) ? data.series : [],
  };
}
