import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  createOrganization as createOrganizationRequest,
  updateOrganization as updateOrganizationRequest,
  deleteOrganization as deleteOrganizationRequest,
  getMyOrganizations,
} from '../api/orgApi';
import { createVenue as createVenueRequest, getMyVenues, updateVenue as updateVenueRequest, deleteVenue as deleteVenueRequest } from '../api/venueApi';
import {
  createSubUser as createSubUserRequest,
  getUsersByManager as getUsersByManagerRequest,
  updateSubUser as updateSubUserRequest,
  deleteSubUser as deleteSubUserRequest,
} from '../api/userApi';
import {
  getDevicesByVenue,
  updateDevice as updateDeviceRequest,
  deleteDevice as deleteDeviceRequest,
  respondDeviceReset as respondDeviceResetRequest,
  getPendingDeviceResets,
} from '../api/deviceApi';
import { getAppSocket, disconnectBrandSocket } from '../api/brandSocket';
import { getApiErrorMessage } from '../api/authApi';
import {
  applyLiveStatusPatch,
  mergeApiDeviceWithLive,
} from '../utils/deviceLiveMerge';
import { useAuth } from './AuthContext';

const AppContext = createContext(undefined);

/**
 * Lean mirror of web AppContext (dashboard slice only):
 * - fetchMyVenues → orgs + venues
 * - units + loadDevicesForVenues
 * - selectedOrg / venue / unit
 * - socket: device:state | device:status | device:alert | device:remote
 */
export function AppProvider({ children }) {
  const { user, token, logout: authLogout } = useAuth();
  const role = user?.role || null;

  const [orgs, setOrgs] = useState([]);
  const [venues, setVenues] = useState([]);
  const [units, setUnits] = useState([]);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [venuesError, setVenuesError] = useState(null);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(null);
  /** Currently open reset approval modal (null when dismissed). */
  const [pendingResetRequest, setPendingResetRequest] = useState(null);
  /** All open reset requests for this manager (survives modal dismiss). */
  const [pendingResetRequests, setPendingResetRequests] = useState([]);

  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [selectedVenueId, setSelectedVenueId] = useState(null);
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  const fetchMyVenues = useCallback(async () => {
    setVenuesLoading(true);
    setVenuesError(null);
    try {
      const nextOrgs = await getMyOrganizations();
      // Sub-users must keep org.owner as managerId — never fall back to their own id.
      const withOwner = nextOrgs.map((org) => ({
        ...org,
        managerId:
          org.managerId ||
          (role === 'manager' || role === 'admin'
            ? user?.id || ''
            : user?.creatorId || ''),
      }));
      setOrgs(withOwner);
      const nextVenues = await getMyVenues(withOwner.map((org) => org.id));
      setVenues(nextVenues);
    } catch (err) {
      setVenuesError(getApiErrorMessage(err, 'Failed to load venues'));
      throw err;
    } finally {
      setVenuesLoading(false);
    }
  }, [user?.id, user?.creatorId, role]);

  /** Load / merge devices for given venue ids (same as Dashboard effect). */
  const loadDevicesForVenues = useCallback(async (venueIds) => {
    const ids = (venueIds || []).filter(Boolean);
    if (!ids.length) {
      setUnits([]);
      return [];
    }
    setDevicesLoading(true);
    try {
      const lists = await Promise.all(
        ids.map((id) => getDevicesByVenue(id).catch(() => []))
      );
      const next = lists.flat();
      setUnits((prev) => {
        const prevById = new Map(prev.map((u) => [u.id, u]));
        return next.map((d) => mergeApiDeviceWithLive(d, prevById.get(d.id)));
      });
      return next;
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  const updateUnit = useCallback((id, patch) => {
    setUnits((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...patch } : u))
    );
  }, []);

  /** Same as web: create org then prepend into local orgs list. */
  const createOrganization = useCallback(
    async (name, address) => {
      const org = await createOrganizationRequest(name, address);
      const withOwner = {
        ...org,
        managerId: org.managerId || user?.id || '',
      };
      setOrgs((prev) => {
        if (prev.some((item) => item.id === withOwner.id)) return prev;
        return [withOwner, ...prev];
      });
      return withOwner;
    },
    [user?.id]
  );

  const updateOrganization = useCallback(async (id, name, address) => {
    const updated = await updateOrganizationRequest(id, name, address);
    setOrgs((prev) =>
      prev.map((org) =>
        org.id === id
          ? {
              ...org,
              name: updated.name,
              address: updated.address,
              managerId: updated.managerId || org.managerId,
            }
          : org
      )
    );
    return updated;
  }, []);

  const deleteOrganization = useCallback(async (id) => {
    await deleteOrganizationRequest(id);
    setOrgs((prev) => prev.filter((org) => org.id !== id));
    setVenues((prev) => prev.filter((venue) => venue.orgId !== id));
    setSelectedOrgId((prev) => (prev === id ? null : prev));
  }, []);

  /** Same as web: create venue then prepend into local venues list. */
  const createVenue = useCallback(async (name, organizationId) => {
    const venue = await createVenueRequest(name, organizationId);
    setVenues((prev) => {
      if (prev.some((item) => item.id === venue.id)) return prev;
      return [venue, ...prev];
    });
    return venue;
  }, []);

  const updateVenue = useCallback(async (id, payload) => {
    const updated = await updateVenueRequest(id, payload);
    setVenues((prev) =>
      prev.map((venue) => (venue.id === id ? { ...venue, ...updated } : venue))
    );
    return updated;
  }, []);

  const deleteVenue = useCallback(async (id) => {
    await deleteVenueRequest(id);
    setVenues((prev) => prev.filter((venue) => venue.id !== id));
    setUnits((prev) => prev.filter((u) => u.venueId !== id));
    setSelectedVenueId((prev) => (prev === id ? null : prev));
  }, []);

  const updateDevice = useCallback(async (id, payload) => {
    const updated = await updateDeviceRequest(id, payload);
    setUnits((prev) =>
      prev.map((unit) => (unit.id === id ? { ...unit, ...updated } : unit))
    );
    return updated;
  }, []);

  const deleteDevice = useCallback(async (id) => {
    await deleteDeviceRequest(id);
    setUnits((prev) => prev.filter((unit) => unit.id !== id));
    setSelectedUnitId((prev) => (prev === id ? null : prev));
  }, []);

  const fetchMyUsers = useCallback(async () => {
    if (!user?.id) {
      setUsers([]);
      return;
    }
    setUsersLoading(true);
    setUsersError(null);
    try {
      const nextUsers = await getUsersByManagerRequest(user.id);
      setUsers(
        nextUsers.map((item) => ({
          ...item,
          managerId: item.managerId || user.id,
        }))
      );
    } catch (err) {
      setUsersError(getApiErrorMessage(err, 'Failed to load users'));
      throw err;
    } finally {
      setUsersLoading(false);
    }
  }, [user?.id]);

  const createSubUser = useCallback(
    async (payload) => {
      const created = await createSubUserRequest(payload);
      const withManager = {
        ...created,
        managerId: created.managerId || user?.id || '',
      };
      setUsers((prev) => {
        if (prev.some((item) => item.id === withManager.id)) return prev;
        return [withManager, ...prev];
      });
      return withManager;
    },
    [user?.id]
  );

  const updateSubUser = useCallback(async (id, payload) => {
    const updated = await updateSubUserRequest(id, payload);
    setUsers((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              ...updated,
              managerId: updated.managerId || item.managerId,
            }
          : item
      )
    );
    return updated;
  }, []);

  const deleteSubUser = useCallback(async (id) => {
    await deleteSubUserRequest(id);
    setUsers((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const upsertPendingResetRequest = useCallback((payload) => {
    if (!payload?.requestId) return;
    setPendingResetRequests((prev) => {
      const next = prev.filter(
        (r) =>
          r.requestId !== payload.requestId &&
          !(
            payload.deviceMongoId &&
            r.deviceMongoId &&
            r.deviceMongoId === String(payload.deviceMongoId)
          ) &&
          !(
            payload.deviceId &&
            r.deviceId &&
            String(r.deviceId).toUpperCase() ===
              String(payload.deviceId).toUpperCase()
          )
      );
      return [
        ...next,
        {
          ...payload,
          deviceMongoId: payload.deviceMongoId
            ? String(payload.deviceMongoId)
            : '',
          deviceId: payload.deviceId || '',
          status:
            payload.status === 'approved' ||
            payload.status === 'approved_waiting'
              ? 'approved_waiting'
              : 'pending',
        },
      ];
    });
  }, []);

  const removePendingResetRequest = useCallback(
    ({ requestId, deviceMongoId, deviceId } = {}) => {
      setPendingResetRequests((prev) =>
        prev.filter((r) => {
          if (requestId && r.requestId === requestId) return false;
          if (
            deviceMongoId &&
            r.deviceMongoId &&
            r.deviceMongoId === String(deviceMongoId)
          ) {
            return false;
          }
          if (
            deviceId &&
            r.deviceId &&
            String(r.deviceId).toUpperCase() === String(deviceId).toUpperCase()
          ) {
            return false;
          }
          return true;
        })
      );
    },
    []
  );

  const fetchPendingDeviceResets = useCallback(async () => {
    if (role !== 'manager') {
      setPendingResetRequests([]);
      return [];
    }
    try {
      const list = await getPendingDeviceResets();
      setPendingResetRequests(list);
      return list;
    } catch {
      return [];
    }
  }, [role]);

  const deviceHasPendingReset = useCallback(
    (device) => {
      if (!device) return false;
      return pendingResetRequests.some(
        (r) =>
          (r.deviceMongoId && r.deviceMongoId === device.id) ||
          (r.deviceId &&
            device.deviceId &&
            String(r.deviceId).toUpperCase() ===
              String(device.deviceId).toUpperCase())
      );
    },
    [pendingResetRequests]
  );

  const openPendingResetForDevice = useCallback(
    (device) => {
      if (!device) return false;
      const hit = pendingResetRequests.find(
        (r) =>
          (r.deviceMongoId && r.deviceMongoId === device.id) ||
          (r.deviceId &&
            device.deviceId &&
            String(r.deviceId).toUpperCase() ===
              String(device.deviceId).toUpperCase())
      );
      if (!hit) return false;
      setPendingResetRequest({ ...hit });
      return true;
    },
    [pendingResetRequests]
  );

  const respondToDeviceReset = useCallback(async (approved) => {
    const pending = pendingResetRequest;
    if (!pending?.requestId) {
      throw new Error('No pending reset request');
    }
    const data = await respondDeviceResetRequest(
      pending.requestId,
      Boolean(approved)
    );
    if (data && data.success === false) {
      throw new Error(data.message || 'Reset response failed');
    }
    if (!approved) {
      setPendingResetRequest(null);
      removePendingResetRequest({
        requestId: pending.requestId,
        deviceMongoId: pending.deviceMongoId,
        deviceId: pending.deviceId,
      });
    } else {
      setPendingResetRequest((prev) =>
        prev && prev.requestId === pending.requestId
          ? { ...prev, status: 'approved_waiting' }
          : prev
      );
      upsertPendingResetRequest({
        ...pending,
        status: 'approved_waiting',
      });
    }
    return data;
  }, [pendingResetRequest, removePendingResetRequest, upsertPendingResetRequest]);

  /** Dismiss modal only — keep request in list so Edit stays red / reopenable. */
  const clearPendingResetRequest = useCallback(() => {
    setPendingResetRequest(null);
  }, []);

  const logout = useCallback(async () => {
    disconnectBrandSocket();
    setOrgs([]);
    setVenues([]);
    setUnits([]);
    setUsers([]);
    setPendingResetRequest(null);
    setPendingResetRequests([]);
    setSelectedOrgId(null);
    setSelectedVenueId(null);
    setSelectedUnitId(null);
    await authLogout();
  }, [authLogout]);

  // Live device patches — mirrors AppContext.tsx socket effect
  useEffect(() => {
    if (!token || (role !== 'manager' && role !== 'user' && role !== 'admin')) {
      return undefined;
    }

    let cancelled = false;
    let socket = null;

    const onDeviceState = (payload) => {
      if (!payload?.id) return;

      const patch = {};
      if (typeof payload.isOn === 'boolean') {
        patch.isOn = payload.isOn;
      } else if (payload.state === 'on' || payload.state === 'off') {
        patch.isOn = payload.state === 'on';
      }
      if (
        typeof payload.temperature === 'number' &&
        payload.temperature >= 16 &&
        payload.temperature <= 30
      ) {
        patch.targetTemp = payload.temperature;
        patch.currentTemp = payload.temperature;
      }
      if (typeof payload.current === 'number' && payload.current >= 0) {
        patch.current = payload.current;
      }
      if (typeof payload.voltage === 'number' && payload.voltage > 0) {
        patch.voltage = payload.voltage;
      }
      if (
        typeof payload.powerConsumption === 'number' &&
        payload.powerConsumption >= 0
      ) {
        patch.powerConsumption = payload.powerConsumption;
      }
      if (typeof payload.ventTemperature === 'number') {
        patch.ventTemperature = payload.ventTemperature;
      }
      if (typeof payload.hasFault === 'boolean') {
        patch.hasFault = payload.hasFault;
      } else if (payload.health === 'faulty' || payload.health === 'healthy') {
        patch.hasFault = payload.health === 'faulty';
      }
      if (typeof payload.healthAlert === 'string') {
        patch.healthAlert = payload.healthAlert;
      }
      if (Object.keys(patch).length === 0) return;

      setUnits((prev) => {
        const exists = prev.some((u) => u.id === payload.id);
        if (!exists) {
          return [
            ...prev,
            {
              id: payload.id,
              name: payload.deviceId || 'Device',
              venueId: '',
              isOn: patch.isOn ?? false,
              currentTemp: patch.currentTemp ?? 16,
              targetTemp: patch.targetTemp ?? 16,
              isLocked: false,
              eventLocked: false,
              hasFault: patch.hasFault ?? false,
              healthAlert: patch.healthAlert ?? '',
              voltage: patch.voltage ?? 230,
              current: patch.current ?? 0,
              powerConsumption: patch.powerConsumption ?? 0,
              ventTemperature: patch.ventTemperature ?? null,
              energyConsumption: {
                hourly: [{ label: '00:00', kwh: 0 }],
                daily: [
                  {
                    label: new Date().toISOString().split('T')[0],
                    kwh: 0,
                  },
                ],
                weekly: [{ label: 'Week 1', kwh: 0 }],
                monthly: [
                  { label: new Date().toISOString().slice(0, 7), kwh: 0 },
                ],
                yearly: [
                  { label: new Date().getFullYear().toString(), kwh: 0 },
                ],
              },
              events: [],
            },
          ];
        }
        return prev.map((u) => (u.id === payload.id ? { ...u, ...patch } : u));
      });
    };

    const onDeviceAlert = (payload) => {
      if (!payload?.id) return;
      const patch = {};
      if (typeof payload.hasFault === 'boolean') {
        patch.hasFault = payload.hasFault;
      } else if (payload.health === 'faulty' || payload.health === 'healthy') {
        patch.hasFault = payload.health === 'faulty';
      }
      if (typeof payload.healthAlert === 'string') {
        patch.healthAlert = payload.healthAlert;
      }
      if (typeof payload.ventTemperature === 'number') {
        patch.ventTemperature = payload.ventTemperature;
      }
      if (Object.keys(patch).length === 0) return;
      setUnits((prev) =>
        prev.map((u) => (u.id === payload.id ? { ...u, ...patch } : u))
      );
    };

    const onDeviceStatus = (payload) => {
      if (!payload?.id) return;
      if (payload.status !== 'online' && payload.status !== 'offline') return;
      setUnits((prev) =>
        prev.map((u) =>
          u.id === payload.id
            ? applyLiveStatusPatch(u, payload.status)
            : u
        )
      );
    };

    const onDeviceRemote = (payload) => {
      if (!payload?.id) return;
      const patch = {
        isLocked: Boolean(payload.isLocked),
        eventLocked: Boolean(payload.eventLocked),
      };
      if (payload.remote === 'unlock') {
        patch.isLocked = false;
        patch.eventLocked = false;
      } else if (payload.remote === 'lock') {
        patch.isLocked = true;
        patch.eventLocked = false;
      } else if (payload.remote === 'superlock') {
        patch.isLocked = true;
        patch.eventLocked = true;
      }
      setUnits((prev) =>
        prev.map((u) => (u.id === payload.id ? { ...u, ...patch } : u))
      );
    };

    const onDeviceResetRequest = (payload) => {
      if (!payload?.requestId) return;
      const next = {
        ...payload,
        deviceMongoId: payload.deviceMongoId
          ? String(payload.deviceMongoId)
          : '',
        status: 'pending',
      };
      upsertPendingResetRequest(next);
      setPendingResetRequest(next);
    };

    const onDeviceResetDenied = (payload) => {
      removePendingResetRequest({
        requestId: payload?.requestId,
        deviceMongoId: payload?.deviceMongoId,
        deviceId: payload?.deviceId,
      });
      setPendingResetRequest((prev) => {
        if (!prev) return null;
        if (payload?.requestId && prev.requestId !== payload.requestId) {
          return prev;
        }
        return null;
      });
    };

    const onDeviceResetComplete = (payload) => {
      const mongoId = payload?.deviceMongoId || payload?.id;
      const shortId = payload?.deviceId;
      if (mongoId || shortId) {
        setUnits((prev) =>
          prev.filter((u) => {
            if (mongoId && u.id === mongoId) return false;
            if (shortId && u.deviceId === shortId) return false;
            return true;
          })
        );
        setSelectedUnitId((prev) => (prev && mongoId && prev === mongoId ? null : prev));
      }
      removePendingResetRequest({
        requestId: payload?.requestId,
        deviceMongoId: mongoId,
        deviceId: shortId,
      });
      setPendingResetRequest((prev) => {
        if (!prev) return null;
        if (payload?.requestId && prev.requestId !== payload.requestId) {
          return prev;
        }
        return null;
      });
    };

    (async () => {
      socket = await getAppSocket();
      if (cancelled) return;
      socket.on('device:state', onDeviceState);
      socket.on('device:status', onDeviceStatus);
      socket.on('device:alert', onDeviceAlert);
      socket.on('device:remote', onDeviceRemote);
      if (role === 'manager') {
        socket.on('device:resetRequest', onDeviceResetRequest);
        socket.on('device:resetDenied', onDeviceResetDenied);
        socket.on('device:resetComplete', onDeviceResetComplete);
      }
    })();

    return () => {
      cancelled = true;
      if (socket) {
        socket.off('device:state', onDeviceState);
        socket.off('device:status', onDeviceStatus);
        socket.off('device:alert', onDeviceAlert);
        socket.off('device:remote', onDeviceRemote);
        socket.off('device:resetRequest', onDeviceResetRequest);
        socket.off('device:resetDenied', onDeviceResetDenied);
        socket.off('device:resetComplete', onDeviceResetComplete);
      }
    };
  }, [token, role, upsertPendingResetRequest, removePendingResetRequest]);

  // Hydrate pending reset requests (so red Edit works after app reopen / ignore)
  useEffect(() => {
    if (!token || role !== 'manager') {
      setPendingResetRequests([]);
      return undefined;
    }
    void fetchPendingDeviceResets();
    return undefined;
  }, [token, role, fetchPendingDeviceResets]);

  // Clear workspace when logged out
  useEffect(() => {
    if (!token) {
      disconnectBrandSocket();
      setOrgs([]);
      setVenues([]);
      setUnits([]);
      setUsers([]);
      setPendingResetRequest(null);
      setPendingResetRequests([]);
      setSelectedOrgId(null);
      setSelectedVenueId(null);
      setSelectedUnitId(null);
    }
  }, [token]);

  /** UserWorkspaceContext-style scope for dashboard (web UserDashboardPage) */
  // Separate memos so orgs/venues keep a stable identity when only units change
  const scopedOrgs = useMemo(() => {
    const organizationIds = user?.organizationIds || [];
    if (role !== 'user' || organizationIds.length === 0) return orgs;
    return orgs.filter((o) => organizationIds.includes(o.id));
  }, [role, orgs, user?.organizationIds]);

  const scopedVenues = useMemo(() => {
    const assignedVenueIds = user?.assignedVenueIds || [];
    if (role !== 'user' || assignedVenueIds.length === 0) return venues;
    return venues.filter((v) => assignedVenueIds.includes(v.id));
  }, [role, venues, user?.assignedVenueIds]);

  const scopedUnits = useMemo(() => {
    const assignedVenueIds = user?.assignedVenueIds || [];
    if (role !== 'user' || assignedVenueIds.length === 0) return units;
    return units.filter((u) => assignedVenueIds.includes(u.venueId));
  }, [role, units, user?.assignedVenueIds]);

  const dashboardScope = useMemo(
    () => ({ orgs: scopedOrgs, venues: scopedVenues, units: scopedUnits }),
    [scopedOrgs, scopedVenues, scopedUnits]
  );

  const value = useMemo(
    () => ({
      role,
      orgs,
      setOrgs,
      venues,
      setVenues,
      units,
      setUnits,
      dashboardOrgs: dashboardScope.orgs,
      dashboardVenues: dashboardScope.venues,
      dashboardUnits: dashboardScope.units,
      venuesLoading,
      venuesError,
      devicesLoading,
      users,
      usersLoading,
      usersError,
      fetchMyVenues,
      fetchMyUsers,
      loadDevicesForVenues,
      updateUnit,
      createOrganization,
      updateOrganization,
      deleteOrganization,
      createVenue,
      updateVenue,
      deleteVenue,
      updateDevice,
      deleteDevice,
      createSubUser,
      updateSubUser,
      deleteSubUser,
      pendingResetRequest,
      pendingResetRequests,
      respondToDeviceReset,
      clearPendingResetRequest,
      fetchPendingDeviceResets,
      deviceHasPendingReset,
      openPendingResetForDevice,
      selectedOrgId,
      setSelectedOrgId,
      selectedVenueId,
      setSelectedVenueId,
      selectedUnitId,
      setSelectedUnitId,
      activeTab,
      setActiveTab,
      logout,
    }),
    [
      role,
      orgs,
      venues,
      units,
      dashboardScope,
      venuesLoading,
      venuesError,
      devicesLoading,
      users,
      usersLoading,
      usersError,
      fetchMyVenues,
      fetchMyUsers,
      loadDevicesForVenues,
      updateUnit,
      createOrganization,
      updateOrganization,
      deleteOrganization,
      createVenue,
      updateVenue,
      deleteVenue,
      updateDevice,
      deleteDevice,
      createSubUser,
      updateSubUser,
      deleteSubUser,
      pendingResetRequest,
      pendingResetRequests,
      respondToDeviceReset,
      clearPendingResetRequest,
      fetchPendingDeviceResets,
      deviceHasPendingReset,
      openPendingResetForDevice,
      selectedOrgId,
      selectedVenueId,
      selectedUnitId,
      activeTab,
      logout,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
