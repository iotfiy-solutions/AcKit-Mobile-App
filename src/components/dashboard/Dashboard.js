import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Building2 } from '@hugeicons/core-free-icons';
import { useAppContext } from '../../context/AppContext';
import { useConsole } from '../../context/ConsoleContext';
import { setDevicePower, setDeviceTemperature, setDeviceRemote } from '../../api/deviceApi';
import {
  createScheduleEvent,
  listScheduleEvents,
  scheduleEventToACEvent,
  setScheduleEventEnabled,
} from '../../api/eventApi';
import { getAppSocket } from '../../api/brandSocket';
import { withEventOverrideGuard } from '../../utils/eventOverride';
import {
  TEMP_DEBOUNCE_MS,
  TEMP_ECO,
  TEMP_MAX,
  TEMP_MIN,
  filterPowerTempTargets,
  isDeviceOnline,
  offlineBulkToastMessage,
  resolveLockState,
} from '../../utils/dashboardHelpers';
import { Select } from '../ui/Select';
import { EventOverrideModal } from '../ui/EventOverrideModal';
import { MetricsRow } from './MetricsRow';
import { ClimateSection } from './ClimateSection';
import { EventsSection } from './EventsSection';
import { DeviceStatusSheet } from './DeviceStatusSheet';
import { MaintenanceDrawer } from './MaintenanceDrawer';
import { ScheduleModal } from './ScheduleModal';

/**
 * Mobile dashboard — port of the `xl:hidden` "MOBILE FIGMA-MATCHING VIEW"
 * block in ackitFrontend/src/components/dashboard/Dashboard.tsx.
 *
 * Venue / device selection is NOT on this screen: it lives in the header
 * hamburger → OrgOverlayPage (same as web).
 */
export function Dashboard() {
  const {
    dashboardOrgs: orgs,
    dashboardVenues: venues,
    dashboardUnits: liveUnits,
    venuesLoading,
    devicesLoading,
    updateUnit,
    selectedOrgId: globalOrgId,
    setSelectedOrgId: setGlobalOrgId,
    selectedVenueId: globalVenueId,
    setSelectedVenueId: setGlobalVenueId,
    selectedUnitId: globalUnitId,
    setSelectedUnitId: setGlobalUnitId,
    setActiveTab,
  } = useAppContext();
  const { openOrgOverlay } = useConsole();

  const selectedVenueId = globalVenueId || 'all';

  // ---- transient UI state ----
  const [draftTemps, setDraftTemps] = useState({});
  const tempDebounceTimers = useRef({});
  const [bulkToast, setBulkToast] = useState(null);
  const bulkToastTimer = useRef(null);
  const [bulkPowerPending, setBulkPowerPending] = useState(false);
  const [bulkLockPending, setBulkLockPending] = useState(false);
  const [eventOverridePending, setEventOverridePending] = useState(null);
  const [scopeEvents, setScopeEvents] = useState([]);
  const [showMaintenanceDrawer, setShowMaintenanceDrawer] = useState(false);
  const [expandedMaintenanceVenueId, setExpandedMaintenanceVenueId] =
    useState(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);

  const showBulkToast = useCallback((message, type = 'error') => {
    if (bulkToastTimer.current) clearTimeout(bulkToastTimer.current);
    setBulkToast({ message, type });
    bulkToastTimer.current = setTimeout(() => {
      setBulkToast(null);
      bulkToastTimer.current = null;
    }, 2500);
  }, []);

  useEffect(
    () => () => {
      if (bulkToastTimer.current) clearTimeout(bulkToastTimer.current);
      Object.values(tempDebounceTimers.current).forEach((id) =>
        clearTimeout(id)
      );
    },
    []
  );

  // ---- derived scope ----
  const activeOrg = useMemo(
    () =>
      orgs.find((o) => o.id === globalOrgId) ||
      orgs[0] || { id: '', name: 'Organization' },
    [orgs, globalOrgId]
  );

  const orgVenues = useMemo(
    () => (globalOrgId ? venues.filter((v) => v.orgId === globalOrgId) : venues),
    [venues, globalOrgId]
  );

  const selectedUnits = useMemo(() => {
    const orgVenueIds = new Set(orgVenues.map((v) => v.id));
    const orgScoped = liveUnits.filter((u) => orgVenueIds.has(u.venueId));
    if (globalUnitId) {
      const fromOrg = orgScoped.filter((u) => u.id === globalUnitId);
      if (fromOrg.length > 0) return fromOrg;
      return liveUnits.filter((u) => u.id === globalUnitId);
    }
    if (selectedVenueId === 'all') return orgScoped;
    return orgScoped.filter((u) => u.venueId === selectedVenueId);
  }, [liveUnits, globalUnitId, selectedVenueId, orgVenues]);

  // Metrics use org/venue scope (web `frameMetricUnits` ignores single-device)
  const frameMetricUnits = useMemo(() => {
    const orgVenueIds = new Set(orgVenues.map((v) => v.id));
    const orgScoped = liveUnits.filter((u) => orgVenueIds.has(u.venueId));
    if (selectedVenueId === 'all') return orgScoped;
    return orgScoped.filter((u) => u.venueId === selectedVenueId);
  }, [liveUnits, selectedVenueId, orgVenues]);

  const totalUnitsCount = frameMetricUnits.length;
  const faultUnitsCount = frameMetricUnits.filter((u) => u.hasFault).length;
  const framePowerKw = useMemo(
    () =>
      Number(
        frameMetricUnits
          .reduce((acc, u) => acc + (Number(u.powerConsumption) || 0), 0)
          .toFixed(2)
      ),
    [frameMetricUnits]
  );

  const frameTempScopeKey = globalUnitId
    ? `device:${globalUnitId}`
    : selectedVenueId === 'all'
      ? `org:${globalOrgId || 'none'}`
      : `venue:${selectedVenueId}`;

  const resolveDisplayTemp = useCallback(
    (units, scopeKey) => {
      if (draftTemps[scopeKey] != null) return draftTemps[scopeKey];
      if (units.length === 0) return TEMP_ECO;
      const firstTemp = units[0].targetTemp;
      const allSame = units.every((u) => u.targetTemp === firstTemp);
      return allSame ? firstTemp : 'Mixed';
    },
    [draftTemps]
  );

  const targetTempState = resolveDisplayTemp(selectedUnits, frameTempScopeKey);
  const lockState = resolveLockState(selectedUnits);

  // Org/venue: skip superlock. Single device: allow direct control.
  const skipSuperlockForFrame = !globalUnitId;
  const ignoreAllForFrame = !globalUnitId;
  const framePowerTargets = filterPowerTempTargets(
    selectedUnits,
    skipSuperlockForFrame
  );
  const allUnitsOn =
    framePowerTargets.length > 0 && framePowerTargets.every((u) => u.isOn);

  // Clear drafts when selection changes
  useEffect(() => {
    setDraftTemps({});
    Object.values(tempDebounceTimers.current).forEach((id) => clearTimeout(id));
    tempDebounceTimers.current = {};
  }, [globalOrgId, selectedVenueId, globalUnitId]);

  // ---- org / venue schedules for the EVENTS panel ----
  useEffect(() => {
    let active = true;
    if (!globalOrgId) {
      setScopeEvents([]);
      return undefined;
    }
    const params =
      selectedVenueId === 'all'
        ? { organizationId: globalOrgId, scope: 'organization' }
        : {
            organizationId: globalOrgId,
            venueId: selectedVenueId,
            scope: 'venue',
          };
    listScheduleEvents(params)
      .then((events) => {
        if (active) setScopeEvents(events.map(scheduleEventToACEvent));
      })
      .catch(() => {
        if (active) setScopeEvents([]);
      });
    return () => {
      active = false;
    };
  }, [globalOrgId, selectedVenueId]);

  // Remove one-time / deleted events live
  useEffect(() => {
    let cancelled = false;
    let socket = null;
    const onEventDeleted = (payload) => {
      if (!payload?.id) return;
      setScopeEvents((prev) => prev.filter((e) => e.id !== payload.id));
    };
    (async () => {
      socket = await getAppSocket();
      if (cancelled) return;
      socket.on('event:deleted', onEventDeleted);
    })();
    return () => {
      cancelled = true;
      if (socket) socket.off('event:deleted', onEventDeleted);
    };
  }, []);

  const handleOrgChange = useCallback(
    (orgId) => {
      setGlobalOrgId(orgId);
      setGlobalVenueId(null);
      setGlobalUnitId(null);
    },
    [setGlobalOrgId, setGlobalVenueId, setGlobalUnitId]
  );

  // ---- controls (ported 1:1 from web) ----
  const applyBulkPower = useCallback(
    async (units, turnOn, skipSuperlock = true, ignoreAllTargets = true) => {
      const targets = filterPowerTempTargets(units, skipSuperlock);
      if (targets.length === 0) {
        showBulkToast(
          offlineBulkToastMessage(units, skipSuperlock, 'power'),
          'error'
        );
        return;
      }
      setBulkPowerPending(true);
      const state = turnOn ? 'on' : 'off';
      // Snapshot for rollback if every request fails (online power API does
      // not emit device:state — UI must update locally like temperature).
      const previousById = new Map(targets.map((u) => [u.id, Boolean(u.isOn)]));
      try {
        await withEventOverrideGuard({
          deviceIds: targets.map((u) => u.id),
          ignoreAllTargets,
          onNeedConfirm: (pending) => setEventOverridePending(pending),
          apply: async () => {
            targets.forEach((u) => updateUnit(u.id, { isOn: turnOn }));

            const results = await Promise.allSettled(
              targets.map((u) => setDevicePower(u.id, state))
            );
            results.forEach((result, index) => {
              if (result.status === 'rejected') {
                const id = targets[index].id;
                updateUnit(id, { isOn: previousById.get(id) });
              }
            });
            const failed = results.filter((r) => r.status === 'rejected').length;
            if (failed > 0) {
              showBulkToast(
                failed === results.length
                  ? 'Failed to send power command'
                  : `Power sent to ${results.length - failed}/${results.length} devices`,
                failed === results.length ? 'error' : 'info'
              );
            }
          },
        });
      } finally {
        setBulkPowerPending(false);
      }
    },
    [showBulkToast, updateUnit]
  );

  const applyBulkTemperature = useCallback(
    async (units, temperature, skipSuperlock = true, ignoreAllTargets = true) => {
      const clamped = Math.max(
        TEMP_MIN,
        Math.min(TEMP_MAX, Math.round(temperature))
      );
      const targets = filterPowerTempTargets(units, skipSuperlock);
      if (targets.length === 0) {
        showBulkToast(
          offlineBulkToastMessage(units, skipSuperlock, 'temperature'),
          'error'
        );
        return;
      }

      await withEventOverrideGuard({
        deviceIds: targets.map((u) => u.id),
        ignoreAllTargets,
        onNeedConfirm: (pending) => setEventOverridePending(pending),
        apply: async () => {
          // Optimistic local update while ESP confirms over socket
          targets.forEach((u) =>
            updateUnit(u.id, { targetTemp: clamped, currentTemp: clamped })
          );
          const results = await Promise.allSettled(
            targets.map((u) => setDeviceTemperature(u.id, clamped))
          );
          const failed = results.filter((r) => r.status === 'rejected').length;
          if (failed > 0) {
            showBulkToast(
              failed === results.length
                ? 'Failed to send temperature command'
                : `Temp sent to ${results.length - failed}/${results.length} devices`,
              failed === results.length ? 'error' : 'info'
            );
          }
        },
      });
    },
    [showBulkToast, updateUnit]
  );

  const clearDraft = useCallback((scopeKey) => {
    setDraftTemps((prev) => {
      const next = { ...prev };
      delete next[scopeKey];
      return next;
    });
  }, []);

  const scheduleBulkTemperature = useCallback(
    (
      scopeKey,
      units,
      temperature,
      skipSuperlock = true,
      ignoreAllTargets = true
    ) => {
      const existing = tempDebounceTimers.current[scopeKey];
      if (existing) clearTimeout(existing);

      tempDebounceTimers.current[scopeKey] = setTimeout(() => {
        void applyBulkTemperature(
          units,
          temperature,
          skipSuperlock,
          ignoreAllTargets
        ).finally(() => {
          delete tempDebounceTimers.current[scopeKey];
          clearDraft(scopeKey);
        });
      }, TEMP_DEBOUNCE_MS);
    },
    [applyBulkTemperature, clearDraft]
  );

  const handleScopeTempAdjust = useCallback(
    (
      scopeKey,
      units,
      increment,
      skipSuperlock = true,
      ignoreAllTargets = true
    ) => {
      if (units.length === 0) return;
      if (filterPowerTempTargets(units, skipSuperlock).length === 0) {
        showBulkToast(
          offlineBulkToastMessage(units, skipSuperlock, 'temperature'),
          'error'
        );
        return;
      }
      const current = resolveDisplayTemp(units, scopeKey);

      // Mixed → first snap UI to eco 24; further +/- apply via debounce
      if (current === 'Mixed') {
        setDraftTemps((prev) => ({ ...prev, [scopeKey]: TEMP_ECO }));
        scheduleBulkTemperature(
          scopeKey,
          units,
          TEMP_ECO,
          skipSuperlock,
          ignoreAllTargets
        );
        return;
      }

      const next = Math.max(TEMP_MIN, Math.min(TEMP_MAX, current + increment));
      setDraftTemps((prev) => ({ ...prev, [scopeKey]: next }));
      scheduleBulkTemperature(
        scopeKey,
        units,
        next,
        skipSuperlock,
        ignoreAllTargets
      );
    },
    [resolveDisplayTemp, scheduleBulkTemperature, showBulkToast]
  );

  const handleScopeTempSet = useCallback(
    (
      scopeKey,
      units,
      temperature,
      skipSuperlock = true,
      ignoreAllTargets = true
    ) => {
      if (units.length === 0) return;
      if (filterPowerTempTargets(units, skipSuperlock).length === 0) {
        showBulkToast(
          offlineBulkToastMessage(units, skipSuperlock, 'temperature'),
          'error'
        );
        return;
      }
      const clamped = Math.max(
        TEMP_MIN,
        Math.min(TEMP_MAX, Math.round(temperature))
      );
      setDraftTemps((prev) => ({ ...prev, [scopeKey]: clamped }));
      scheduleBulkTemperature(
        scopeKey,
        units,
        clamped,
        skipSuperlock,
        ignoreAllTargets
      );
    },
    [scheduleBulkTemperature, showBulkToast]
  );

  const handleScopeEco = useCallback(
    (scopeKey, units, skipSuperlock = true, ignoreAllTargets = true) => {
      if (units.length === 0) return;
      if (filterPowerTempTargets(units, skipSuperlock).length === 0) {
        showBulkToast(
          offlineBulkToastMessage(units, skipSuperlock, 'temperature'),
          'error'
        );
        return;
      }
      const existing = tempDebounceTimers.current[scopeKey];
      if (existing) {
        clearTimeout(existing);
        delete tempDebounceTimers.current[scopeKey];
      }
      setDraftTemps((prev) => ({ ...prev, [scopeKey]: TEMP_ECO }));
      void applyBulkTemperature(
        units,
        TEMP_ECO,
        skipSuperlock,
        ignoreAllTargets
      ).finally(() => clearDraft(scopeKey));
    },
    [applyBulkTemperature, clearDraft, showBulkToast]
  );

  const handleBulkPowerToggle = (forceState) => {
    if (bulkPowerPending) return;
    const targets = filterPowerTempTargets(
      selectedUnits,
      skipSuperlockForFrame
    );
    const newState =
      forceState !== undefined ? forceState : !targets.every((u) => u.isOn);
    void applyBulkPower(
      selectedUnits,
      newState,
      skipSuperlockForFrame,
      ignoreAllForFrame
    );
  };

  const handleBulkTempAdjust = (increment) =>
    handleScopeTempAdjust(
      frameTempScopeKey,
      selectedUnits,
      increment,
      skipSuperlockForFrame,
      ignoreAllForFrame
    );

  const handleBulkTempSet = (temp) =>
    handleScopeTempSet(
      frameTempScopeKey,
      selectedUnits,
      temp,
      skipSuperlockForFrame,
      ignoreAllForFrame
    );

  const handleBulkEco = () =>
    handleScopeEco(
      frameTempScopeKey,
      selectedUnits,
      skipSuperlockForFrame,
      ignoreAllForFrame
    );

  // Lock: same API as web Devices/ACDetail (PUT /api/device/remote/:id).
  // Web dashboard desktop card is local-only — mobile hits the real endpoint.
  const handleBulkLockChange = useCallback(
    async (status) => {
      if (bulkLockPending) return;
      const targets = selectedUnits.filter(isDeviceOnline);
      if (targets.length === 0) {
        showBulkToast(
          selectedUnits.length === 0
            ? 'No devices in this scope'
            : selectedUnits.length <= 1
              ? 'Device is offline'
              : 'All devices are offline',
          'error'
        );
        return;
      }

      const remote =
        status === 'Super Locked'
          ? 'superlock'
          : status === 'Locked'
            ? 'lock'
            : 'unlock';
      const isLocked = remote === 'lock' || remote === 'superlock';
      const eventLocked = remote === 'superlock';

      const previousById = new Map(
        targets.map((u) => [
          u.id,
          { isLocked: Boolean(u.isLocked), eventLocked: Boolean(u.eventLocked) },
        ])
      );

      setBulkLockPending(true);
      targets.forEach((u) => updateUnit(u.id, { isLocked, eventLocked }));

      try {
        const results = await Promise.allSettled(
          targets.map((u) => setDeviceRemote(u.id, remote))
        );
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const id = targets[index].id;
            const prev = previousById.get(id);
            if (prev) updateUnit(id, prev);
          }
        });
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed > 0) {
          showBulkToast(
            failed === results.length
              ? 'Failed to update lock mode'
              : `Lock updated on ${results.length - failed}/${results.length} devices`,
            failed === results.length ? 'error' : 'info'
          );
        }
      } finally {
        setBulkLockPending(false);
      }
    },
    [bulkLockPending, selectedUnits, showBulkToast, updateUnit]
  );

  // ---- schedules ----
  const handleToggleSchedule = (eventId, currentEnabled) => {
    const nextEnabled = !currentEnabled;
    setScopeEvents((prev) =>
      prev.map((evt) =>
        evt.id === eventId ? { ...evt, enabled: nextEnabled } : evt
      )
    );
    void setScheduleEventEnabled(eventId, nextEnabled).catch(() => {
      setScopeEvents((prev) =>
        prev.map((evt) =>
          evt.id === eventId ? { ...evt, enabled: currentEnabled } : evt
        )
      );
      showBulkToast('Failed to update event', 'error');
    });
  };

  const scheduleModalTitle = globalUnitId
    ? 'Add New Device Event'
    : selectedVenueId === 'all'
      ? 'Add New Organization Event'
      : 'Add New Venue Event';

  const scheduleModalSubtitle = globalUnitId
    ? selectedUnits[0]?.name || 'Selected device'
    : selectedVenueId === 'all'
      ? `${activeOrg.name} · All venues · ${totalUnitsCount} unit${totalUnitsCount === 1 ? '' : 's'}`
      : `${orgVenues.find((v) => v.id === selectedVenueId)?.name || 'Venue'} · ${totalUnitsCount} unit${totalUnitsCount === 1 ? '' : 's'}`;

  const handleAddSchedule = async (form) => {
    if (!globalOrgId) {
      showBulkToast('Select an organization first', 'error');
      return;
    }
    const scope = globalUnitId
      ? 'device'
      : selectedVenueId === 'all'
        ? 'organization'
        : 'venue';

    try {
      const saved = await createScheduleEvent({
        name: form.name,
        scope,
        organizationId: globalOrgId,
        venueId:
          scope === 'venue'
            ? selectedVenueId
            : scope === 'device'
              ? selectedUnits[0]?.venueId || null
              : null,
        deviceId: scope === 'device' ? globalUnitId : null,
        action: form.action,
        targetTemp: form.action === 'ON' ? form.temp : null,
        startTime: form.startTime,
        endTime: form.endTime,
        days: form.days,
        remote: form.action === 'OFF' ? 'lock' : form.remote,
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      });

      const newEvent = scheduleEventToACEvent(saved);
      if (scope === 'organization' || scope === 'venue') {
        setScopeEvents((prev) => [newEvent, ...prev]);
      }
      showBulkToast('Event scheduled', 'info');
      setShowScheduleForm(false);
    } catch (error) {
      showBulkToast(
        error?.response?.data?.message || 'Failed to create event',
        'error'
      );
    }
  };

  const aggregatedEvents = useMemo(
    () =>
      scopeEvents.map((evt) => ({
        id: evt.id,
        name: evt.name,
        time: evt.time,
        endTime: evt.endTime,
        action: evt.action,
        temp: evt.targetTemp,
        days: evt.days,
        enabled: evt.enabled,
      })),
    [scopeEvents]
  );

  // ---- maintenance drawer ----
  const openMaintenanceDrawer = () => {
    const firstFaulty = orgVenues.find((v) =>
      liveUnits.some((u) => u.venueId === v.id && u.hasFault)
    );
    setExpandedMaintenanceVenueId(firstFaulty?.id ?? orgVenues[0]?.id ?? null);
    setShowMaintenanceDrawer(true);
  };

  const handleViewFaultUnit = (unitId) => {
    setShowMaintenanceDrawer(false);
    const unit = liveUnits.find((u) => u.id === unitId);
    if (unit) setGlobalVenueId(unit.venueId);
    setGlobalUnitId(unitId);
  };

  const handleOpenDevices = () => {
    const expandVenueId =
      globalVenueId ||
      liveUnits.find((u) => u.id === globalUnitId)?.venueId ||
      null;
    openOrgOverlay(expandVenueId);
  };

  // ---- render ----
  const titleClass =
    'text-[11px] font-extrabold uppercase tracking-widest text-slate-400';

  const renderEntityTitle = () => {
    if (globalUnitId) {
      return (
        <Text className={`text-center ${titleClass}`} numberOfLines={1}>
          Device:{' '}
          <Text className="text-blue-600">
            {selectedUnits[0]?.name || 'Device'}
          </Text>
        </Text>
      );
    }
    if (globalVenueId) {
      return (
        <Text className={`text-center ${titleClass}`} numberOfLines={1}>
          Venue:{' '}
          <Text className="text-blue-600">
            {orgVenues.find((v) => v.id === globalVenueId)?.name || 'Venue'}
          </Text>
        </Text>
      );
    }
    if (orgs.length > 1) {
      return (
        <View className="w-full">
          <Select
            variant="compact"
            icon={Building2}
            value={activeOrg.id || ''}
            onChange={handleOrgChange}
            placeholder="Select organization"
            options={orgs.map((org) => ({ value: org.id, label: org.name }))}
          />
        </View>
      );
    }
    return (
      <Text className={`text-center ${titleClass}`} numberOfLines={1}>
        <Text className="text-blue-600">{activeOrg.name}</Text>
      </Text>
    );
  };

  const initialLoading =
    orgs.length === 0 && (venuesLoading || devicesLoading);

  return (
    <View className="relative flex-1">
      {bulkToast ? (
        <View
          pointerEvents="none"
          className="absolute left-4 right-4 top-2 z-50 flex-row items-center gap-3 rounded-2xl border px-4 py-3"
          style={{
            backgroundColor:
              bulkToast.type === 'error' ? '#fef2f2' : '#eff6ff',
            borderColor: bulkToast.type === 'error' ? '#fecaca' : '#bfdbfe',
            elevation: 8,
          }}
        >
          <Text
            className={`text-xs font-bold ${
              bulkToast.type === 'error' ? 'text-red-800' : 'text-blue-800'
            }`}
          >
            {bulkToast.message}
          </Text>
        </View>
      ) : null}

      {initialLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#2563eb" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 16,
            paddingTop: 4,
            gap: 8,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top entity name */}
          <View className="mb-2 mt-1 min-w-0 items-center justify-center px-1">
            {renderEntityTitle()}
          </View>

          <MetricsRow
            framePowerKw={framePowerKw}
            totalUnitsCount={totalUnitsCount}
            faultUnitsCount={faultUnitsCount}
            lockState={lockState}
            lockPending={bulkLockPending}
            onOpenReports={() => setActiveTab('reports')}
            onOpenDevices={handleOpenDevices}
            onOpenMaintenance={openMaintenanceDrawer}
            onLockPick={handleBulkLockChange}
          />

          <ClimateSection
            targetTempState={targetTempState}
            allUnitsOn={allUnitsOn}
            powerPending={bulkPowerPending}
            onAdjust={(inc) => {
              if (!allUnitsOn) return;
              handleBulkTempAdjust(inc);
            }}
            onSetTemp={handleBulkTempSet}
            onEco={handleBulkEco}
            onPower={handleBulkPowerToggle}
          />

          <EventsSection
            events={aggregatedEvents}
            onAdd={() => setShowScheduleForm(true)}
            onToggle={handleToggleSchedule}
          />

          <DeviceStatusSheet />
        </ScrollView>
      )}

      <MaintenanceDrawer
        visible={showMaintenanceDrawer}
        onClose={() => setShowMaintenanceDrawer(false)}
        venues={orgVenues}
        units={liveUnits}
        faultCount={faultUnitsCount}
        expandedVenueId={expandedMaintenanceVenueId}
        onToggleVenue={(id) =>
          setExpandedMaintenanceVenueId(
            expandedMaintenanceVenueId === id ? null : id
          )
        }
        onViewUnit={handleViewFaultUnit}
      />

      <ScheduleModal
        isOpen={showScheduleForm}
        onClose={() => setShowScheduleForm(false)}
        title={scheduleModalTitle}
        subtitle={scheduleModalSubtitle}
        hasTargets={selectedUnits.length > 0}
        onSubmit={handleAddSchedule}
      />

      <EventOverrideModal
        pending={eventOverridePending}
        onClose={() => setEventOverridePending(null)}
      />
    </View>
  );
}
