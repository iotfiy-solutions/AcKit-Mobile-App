import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import axios from 'axios';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Cpu,
  Delete02Icon,
  Edit02Icon,
  Filter,
  Search01Icon,
} from '@hugeicons/core-free-icons';
import { useAppContext } from '../../context/AppContext';
import { getApiErrorMessage } from '../../api/authApi';
import { getDeviceBrandOptions } from '../../api/deviceApi';
import { ensureWifiPermissions } from '../../services/wifiService';
import { Toast, useToast } from '../ui/Toast';
import { Select } from '../ui/Select';
import { ConfirmDeleteModal } from '../overlays/OrgModals';
import { EditDeviceModal } from '../overlays/DeviceModals';

/**
 * Mobile Devices list — mirrors web DevicesManagementPage mobile:
 * search + org/venue filters, table Name · Status · Edit/Delete.
 */
export function DevicesPage() {
  const {
    dashboardOrgs: orgs,
    dashboardVenues: venues,
    dashboardUnits: units,
    venuesLoading,
    devicesLoading,
    fetchMyVenues,
    loadDevicesForVenues,
    updateDevice,
    deleteDevice,
  } = useAppContext();
  const { toast, showToast } = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState('all');
  const [venueFilter, setVenueFilter] = useState('all');
  const [brands, setBrands] = useState([]);
  const [editingDevice, setEditingDevice] = useState(null);
  const [deletingDevice, setDeletingDevice] = useState(null);

  useEffect(() => {
    void fetchMyVenues()
      .then(() => {})
      .catch(() => {});
  }, [fetchMyVenues]);

  // SoftAP needs Location / Nearby Wi-Fi. Ask here (Devices tab), not when the
  // Add drawer opens — the system dialog racing the drawer leaves it blank
  // until the user leaves and comes back.
  useEffect(() => {
    void ensureWifiPermissions().catch(() => {});
  }, []);

  useEffect(() => {
    if (!venues.length) return;
    void loadDevicesForVenues(venues.map((v) => v.id)).catch(() => {});
  }, [venues, loadDevicesForVenues]);

  useEffect(() => {
    let active = true;
    getDeviceBrandOptions()
      .then((list) => {
        if (active) setBrands(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const venuesForOrg = useMemo(() => {
    if (orgFilter === 'all') return venues;
    return venues.filter((v) => v.orgId === orgFilter);
  }, [venues, orgFilter]);

  useEffect(() => {
    if (venueFilter === 'all') return;
    if (venuesForOrg.some((v) => v.id === venueFilter)) return;
    setVenueFilter('all');
  }, [venuesForOrg, venueFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return units.filter((u) => {
      if (orgFilter !== 'all' && u.organizationId !== orgFilter) return false;
      if (venueFilter !== 'all' && u.venueId !== venueFilter) return false;
      if (orgFilter !== 'all' && venueFilter === 'all') {
        const venueIds = new Set(venuesForOrg.map((v) => v.id));
        if (u.venueId && !venueIds.has(u.venueId)) return false;
      }
      if (!q) return true;
      const venueName = venues.find((v) => v.id === u.venueId)?.name || '';
      const orgName =
        orgs.find((o) => o.id === u.organizationId)?.name || '';
      return (
        u.name.toLowerCase().includes(q) ||
        venueName.toLowerCase().includes(q) ||
        orgName.toLowerCase().includes(q)
      );
    });
  }, [units, orgs, venues, venuesForOrg, search, orgFilter, venueFilter]);

  const orgFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All Organizations' },
      ...orgs.map((o) => ({ value: o.id, label: o.name })),
    ],
    [orgs]
  );

  const venueFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All Venues' },
      ...venuesForOrg.map((v) => ({ value: v.id, label: v.name })),
    ],
    [venuesForOrg]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchMyVenues();
    } catch {
      showToast('Could not refresh devices');
    } finally {
      setRefreshing(false);
    }
  }, [fetchMyVenues, showToast]);

  const handleSave = async (id, payload) => {
    try {
      await updateDevice(id, payload);
      showToast('Device updated', 'success');
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.errors?.[0]?.message ||
          err.response?.data?.message ||
          getApiErrorMessage(err)
        : getApiErrorMessage(err);
      throw new Error(message || 'Failed to update device');
    }
  };

  const handleDelete = async () => {
    if (!deletingDevice) return;
    try {
      await deleteDevice(deletingDevice.id);
      showToast('Device deleted', 'success');
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.errors?.[0]?.message ||
          err.response?.data?.message ||
          getApiErrorMessage(err)
        : getApiErrorMessage(err);
      throw new Error(message || 'Failed to delete device');
    }
  };

  const loading = (venuesLoading || devicesLoading) && units.length === 0;

  return (
    <View className="min-h-0 flex-1 px-4 pb-2 pt-1">
      <View className="mb-3 flex-row items-center justify-between px-1">
        <View className="min-w-0 flex-1 flex-row items-center gap-2 pr-2">
          <HugeiconsIcon icon={Cpu} size={20} color="#2563eb" />
          <Text
            numberOfLines={1}
            className="min-w-0 flex-1 text-lg font-black tracking-tight text-slate-900"
          >
            Devices
          </Text>
        </View>
        <View className="rounded-full bg-slate-100 px-2.5 py-1">
          <Text className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            {filtered.length} shown
          </Text>
        </View>
      </View>

      <View className="mb-2 flex-row items-center gap-2">
        <View className="min-w-0 flex-1 flex-row items-center gap-2 rounded-full border border-blue-500 bg-white py-2.5 pl-3.5 pr-3">
          <HugeiconsIcon icon={Search01Icon} size={16} color="#3b82f6" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search devices…"
            placeholderTextColor="#94a3b8"
            className="min-w-0 flex-1 py-0 text-xs font-black text-slate-800"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View className="mb-3 flex-row items-center gap-2">
        <View className="min-w-0 flex-1">
          <Select
            value={orgFilter}
            onChange={setOrgFilter}
            options={orgFilterOptions}
            icon={Filter}
            variant="compact"
            visibleCount={4}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Select
            value={venueFilter}
            onChange={setVenueFilter}
            options={venueFilterOptions}
            icon={Filter}
            variant="compact"
            visibleCount={4}
          />
        </View>
      </View>

      <View className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-slate-100 bg-white">
        <View className="flex-row items-center border-b border-slate-100 bg-slate-50/95 px-4 py-3">
          <Text className="w-[55%] text-[10px] font-black uppercase tracking-wider text-slate-400">
            Name
          </Text>
          <Text className="w-[20%] text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
            Status
          </Text>
          <Text className="w-[25%] text-right text-[10px] font-black uppercase tracking-wider text-slate-400">
            Actions
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <View className="flex-1 items-center justify-center gap-2 py-16">
              <ActivityIndicator color="#2563eb" />
              <Text className="text-xs font-semibold text-slate-400">
                Loading devices…
              </Text>
            </View>
          ) : units.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8 py-16">
              <HugeiconsIcon icon={Cpu} size={40} color="#cbd5e1" />
              <Text className="mt-3 text-center text-sm font-black uppercase tracking-widest text-slate-400">
                No Devices Found
              </Text>
              <Text className="mt-1 max-w-[220px] text-center text-xs font-semibold text-slate-400">
                Tap + to add a device via SoftAP setup
              </Text>
            </View>
          ) : filtered.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8 py-16">
              <HugeiconsIcon icon={Cpu} size={40} color="#cbd5e1" />
              <Text className="mt-3 text-center text-sm font-black uppercase tracking-widest text-slate-400">
                No Matching Devices
              </Text>
              <Text className="mt-1 max-w-[220px] text-center text-xs font-semibold text-slate-400">
                No devices matched your current search or filters
              </Text>
            </View>
          ) : (
            filtered.map((device) => {
              const online = device.status === 'online';
              return (
                <View
                  key={device.id}
                  className="flex-row items-center border-b border-slate-50 px-4 py-2.5"
                >
                  <View className="w-[55%] flex-row items-center gap-2 pr-1">
                    <View className="h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                      <HugeiconsIcon icon={Cpu} size={16} color="#2563eb" />
                    </View>
                    <Text
                      numberOfLines={1}
                      className="min-w-0 flex-1 text-[11px] font-extrabold text-slate-900"
                    >
                      {device.name}
                    </Text>
                  </View>
                  <Text
                    className={`w-[20%] text-center text-[10px] font-black uppercase tracking-wider ${
                      online ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {online ? 'Online' : 'Offline'}
                  </Text>
                  <View className="w-[25%] flex-row items-center justify-end gap-1">
                    <Pressable
                      onPress={() => setEditingDevice(device)}
                      hitSlop={6}
                      className="rounded-lg p-1.5 active:bg-blue-50"
                      accessibilityLabel="Edit device"
                    >
                      <HugeiconsIcon
                        icon={Edit02Icon}
                        size={16}
                        color="#2563eb"
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => setDeletingDevice(device)}
                      hitSlop={6}
                      className="rounded-lg p-1.5 active:bg-red-50"
                      accessibilityLabel="Delete device"
                    >
                      <HugeiconsIcon
                        icon={Delete02Icon}
                        size={16}
                        color="#dc2626"
                      />
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>

      <View pointerEvents="none" className="absolute left-4 right-4 top-1 z-50">
        {!editingDevice && !deletingDevice ? <Toast toast={toast} /> : null}
      </View>

      <EditDeviceModal
        device={editingDevice}
        orgs={orgs}
        venues={venues}
        brands={brands}
        onClose={() => setEditingDevice(null)}
        onSave={handleSave}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(deletingDevice)}
        entityLabel="device"
        onClose={() => setDeletingDevice(null)}
        onConfirm={handleDelete}
      />
    </View>
  );
}
