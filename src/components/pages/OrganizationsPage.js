import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import axios from 'axios';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Building2,
  Edit02Icon,
  Delete02Icon,
} from '@hugeicons/core-free-icons';
import { useAppContext } from '../../context/AppContext';
import { getApiErrorMessage } from '../../api/authApi';
import { Toast, useToast } from '../ui/Toast';
import { ConfirmDeleteModal, EditOrgModal } from '../overlays/OrgModals';

/**
 * Mobile Organizations list — mirrors web OrganizationsPage mobile table:
 * Name · Venues count · Edit / Delete. Add is via FAB → drawer.
 */
export function OrganizationsPage() {
  const {
    dashboardOrgs: orgs,
    dashboardVenues: venues,
    venuesLoading,
    fetchMyVenues,
    updateOrganization,
    deleteOrganization,
  } = useAppContext();
  const { toast, showToast } = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [deletingOrg, setDeletingOrg] = useState(null);

  useEffect(() => {
    void fetchMyVenues().catch(() => {});
  }, [fetchMyVenues]);

  const venueCountByOrg = useMemo(() => {
    const map = new Map();
    venues.forEach((v) => {
      map.set(v.orgId, (map.get(v.orgId) || 0) + 1);
    });
    return map;
  }, [venues]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchMyVenues();
    } catch {
      showToast('Could not refresh organizations');
    } finally {
      setRefreshing(false);
    }
  }, [fetchMyVenues, showToast]);

  const handleSave = async (id, name, address) => {
    try {
      await updateOrganization(id, name, address);
      showToast('Organization updated', 'success');
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.errors?.[0]?.message ||
          err.response?.data?.message ||
          getApiErrorMessage(err)
        : getApiErrorMessage(err);
      const e = new Error(message || 'Failed to update organization');
      throw e;
    }
  };

  const handleDelete = async () => {
    if (!deletingOrg) return;
    try {
      await deleteOrganization(deletingOrg.id);
      showToast('Organization deleted', 'success');
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.errors?.[0]?.message ||
          err.response?.data?.message ||
          getApiErrorMessage(err)
        : getApiErrorMessage(err);
      throw new Error(message || 'Failed to delete organization');
    }
  };

  return (
    <View className="min-h-0 flex-1 px-4 pb-2 pt-1">
      <View className="mb-3 flex-row items-center justify-between px-1">
        <View className="min-w-0 flex-1 flex-row items-center gap-2 pr-2">
          <HugeiconsIcon icon={Building2} size={20} color="#2563eb" />
          <Text
            numberOfLines={1}
            className="min-w-0 flex-1 text-lg font-black tracking-tight text-slate-900"
          >
            Organizations
          </Text>
        </View>
        <View className="rounded-full bg-slate-100 px-2.5 py-1">
          <Text className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            {orgs.length} total
          </Text>
        </View>
      </View>

      <View className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-slate-100 bg-white">
        <View className="flex-row items-center border-b border-slate-100 bg-slate-50/95 px-4 py-3">
          <Text className="w-[55%] text-[10px] font-black uppercase tracking-wider text-slate-400">
            Name
          </Text>
          <Text className="w-[20%] text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
            Venues
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
        >
          {venuesLoading && orgs.length === 0 ? (
            <View className="flex-1 items-center justify-center gap-2 py-16">
              <ActivityIndicator color="#2563eb" />
              <Text className="text-xs font-semibold text-slate-400">
                Loading organizations…
              </Text>
            </View>
          ) : orgs.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8 py-16">
              <HugeiconsIcon icon={Building2} size={40} color="#cbd5e1" />
              <Text className="mt-3 text-center text-sm font-black uppercase tracking-widest text-slate-400">
                No Organizations Found
              </Text>
              <Text className="mt-1 max-w-[220px] text-center text-xs font-semibold text-slate-400">
                Tap + to create an organization and start mapping venues
              </Text>
            </View>
          ) : (
            orgs.map((org) => {
              const venueCount = venueCountByOrg.get(org.id) || 0;
              return (
                <View
                  key={org.id}
                  className="flex-row items-center border-b border-slate-50 px-4 py-2.5"
                >
                  <View className="w-[55%] flex-row items-center gap-2 pr-1">
                    <View className="h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                      <HugeiconsIcon icon={Building2} size={16} color="#2563eb" />
                    </View>
                    <Text
                      numberOfLines={1}
                      className="min-w-0 flex-1 text-[11px] font-extrabold text-slate-900"
                    >
                      {org.name}
                    </Text>
                  </View>
                  <Text className="w-[20%] text-center text-[11px] font-black tabular-nums text-blue-600">
                    {venueCount}
                  </Text>
                  <View className="w-[25%] flex-row items-center justify-end gap-1">
                    <Pressable
                      onPress={() => setEditingOrg(org)}
                      hitSlop={6}
                      className="rounded-lg p-1.5 active:bg-blue-50"
                      accessibilityLabel="Edit organization"
                    >
                      <HugeiconsIcon
                        icon={Edit02Icon}
                        size={16}
                        color="#2563eb"
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => setDeletingOrg(org)}
                      hitSlop={6}
                      className="rounded-lg p-1.5 active:bg-red-50"
                      accessibilityLabel="Delete organization"
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
        {!editingOrg && !deletingOrg ? <Toast toast={toast} /> : null}
      </View>

      <EditOrgModal
        org={editingOrg}
        onClose={() => setEditingOrg(null)}
        onSave={handleSave}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(deletingOrg)}
        entityLabel="organization"
        onClose={() => setDeletingOrg(null)}
        onConfirm={handleDelete}
      />
    </View>
  );
}
