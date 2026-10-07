import { getCoveringEvents, ignoreScheduleEvent } from '../api/eventApi';

export function describeCoveringEvents(events) {
  return events
    .map((ev) => {
      const scope =
        ev.scope === 'organization'
          ? 'organization'
          : ev.scope === 'venue'
            ? 'venue'
            : 'device';
      return `“${ev.name}” (${ev.action} · ${scope})`;
    })
    .join(', ');
}

/**
 * Mirrors ackitFrontend/src/utils/eventOverride.ts
 * onNeedConfirm(pending) — pending has { events, ignoreAllTargets, confirm, cancel }
 */
export async function withEventOverrideGuard({
  deviceIds,
  ignoreAllTargets,
  apply,
  onNeedConfirm,
}) {
  const uniqueIds = Array.from(new Set((deviceIds || []).filter(Boolean)));
  if (uniqueIds.length === 0) {
    await apply();
    return;
  }

  let events = [];
  try {
    events = await getCoveringEvents(uniqueIds);
  } catch {
    await apply();
    return;
  }

  if (events.length === 0) {
    await apply();
    return;
  }

  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    onNeedConfirm({
      events,
      ignoreAllTargets,
      cancel: () => finish(),
      confirm: async () => {
        try {
          await Promise.all(
            events.map(async (ev) => {
              if (
                ignoreAllTargets &&
                (ev.scope === 'organization' || ev.scope === 'venue')
              ) {
                await ignoreScheduleEvent(ev.id, { all: true });
                return;
              }
              const ids =
                ev.deviceIds && ev.deviceIds.length > 0
                  ? ev.deviceIds
                  : uniqueIds;
              await Promise.all(
                ids.map((deviceId) =>
                  ignoreScheduleEvent(ev.id, { deviceId })
                )
              );
            })
          );
          await apply();
        } finally {
          finish();
        }
      },
    });
  });
}
