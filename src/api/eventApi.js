import api from './axios';

/** Mirrors ackitFrontend/src/api/eventApi.ts */

export function scheduleEventToACEvent(saved) {
  const isRecurring =
    saved.isRecurring !== false &&
    Array.isArray(saved.days) &&
    saved.days.length > 0;
  return {
    id: saved.id,
    name: saved.name,
    time: saved.localStartTime || saved.startTime,
    endTime: saved.localEndTime || saved.endTime,
    action: saved.action,
    targetTemp: saved.targetTemp ?? undefined,
    isRecurring,
    days:
      saved.localDays && saved.localDays.length > 0
        ? saved.localDays
        : saved.days || [],
    enabled: saved.enabled,
    remote: saved.remote,
  };
}

export async function createScheduleEvent(payload) {
  const { data } = await api.post('/api/event/create', payload);
  return data.event;
}

export async function listScheduleEvents(params) {
  const { data } = await api.get('/api/event/list', { params });
  return data.events || [];
}

export async function setScheduleEventEnabled(id, enabled) {
  const { data } = await api.patch(`/api/event/${id}/enabled`, { enabled });
  return data.event;
}

export async function deleteScheduleEvent(id) {
  await api.delete(`/api/event/${id}`);
}

export async function getCoveringEvents(deviceIds) {
  if (!deviceIds?.length) return [];
  const { data } = await api.get('/api/event/covering', {
    params: { deviceIds: deviceIds.join(',') },
  });
  return data.events || [];
}

export async function ignoreScheduleEvent(id, opts) {
  const { data } = await api.post(`/api/event/${id}/ignore`, opts);
  return data.event;
}
