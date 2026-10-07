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
  Delete02Icon,
  Edit02Icon,
  Search01Icon,
  UserIcon,
  UserMultipleIcon,
} from '@hugeicons/core-free-icons';
import { useAppContext } from '../../context/AppContext';
import { getApiErrorMessage } from '../../api/authApi';
import { Toast, useToast } from '../ui/Toast';
import { ConfirmDeleteModal } from '../overlays/OrgModals';
import { EditUserModal } from '../overlays/UserModals';

/**
 * Mobile Users list — mirrors web UsersPage mobile:
 * Name · Venue · Devices · Edit/Delete (add via FAB drawer).
 */
export function UsersPage() {
  const {
    dashboardOrgs: orgs,
    dashboardVenues: venues,
    dashboardUnits: units,
    users,
    usersLoading,
    fetchMyUsers,
    fetchMyVenues,
    loadDevicesForVenues,
    updateSubUser,
    deleteSubUser,
  } = useAppContext();
  const { toast, showToast } = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);

  useEffect(() => {
    void Promise.allSettled([fetchMyUsers(), fetchMyVenues()]);
  }, [fetchMyUsers, fetchMyVenues]);

  useEffect(() => {
    if (!venues.length) return;
    void loadDevicesForVenues(venues.map((v) => v.id)).catch(() => {});
  }, [venues, loadDevicesForVenues]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [users, search]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchMyUsers(), fetchMyVenues()]);
    } catch {
      showToast('Could not refresh users');
    } finally {
      setRefreshing(false);
    }
  }, [fetchMyUsers, fetchMyVenues, showToast]);

  const handleSave = async (id, payload) => {
    try {
      await updateSubUser(id, {
        organizations: payload.organizationIds,
        venues: payload.assignedVenueIds || [],
      });
      showToast('User access updated', 'success');
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.errors?.[0]?.message ||
          err.response?.data?.message ||
          getApiErrorMessage(err)
        : getApiErrorMessage(err);
      throw new Error(message || 'Failed to update user access');
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    try {
      await deleteSubUser(deletingUser.id);
      showToast('User deleted', 'success');
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.errors?.[0]?.message ||
          err.response?.data?.message ||
          getApiErrorMessage(err)
        : getApiErrorMessage(err);
      throw new Error(message || 'Failed to delete user');
    }
  };

  return (
    <View className="min-h-0 flex-1 px-4 pb-2 pt-1">
      <View className="mb-3 flex-row items-center justify-between px-1">
        <View className="min-w-0 flex-1 flex-row items-center gap-2 pr-2">
          <HugeiconsIcon icon={UserMultipleIcon} size={20} color="#2563eb" />
          <Text
            numberOfLines={1}
            className="min-w-0 flex-1 text-lg font-black tracking-tight text-slate-900"
          >
            Users
          </Text>
        </View>
        <View className="rounded-full bg-slate-100 px-2.5 py-1">
          <Text className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            {filtered.length} shown
          </Text>
        </View>
      </View>

      <View className="mb-3 flex-row items-center gap-2 rounded-full border border-blue-500 bg-white py-2.5 pl-3.5 pr-3">
        <HugeiconsIcon icon={Search01Icon} size={16} color="#3b82f6" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search users…"
          placeholderTextColor="#94a3b8"
          className="min-w-0 flex-1 py-0 text-xs font-black text-slate-800"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-slate-100 bg-white">
        <View className="flex-row items-center border-b border-slate-100 bg-slate-50/95 px-4 py-3">
          <Text className="w-[46%] text-[10px] font-black uppercase tracking-wider text-slate-400">
            Name
          </Text>
          <Text className="w-[16%] text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
            Venue
          </Text>
          <Text className="w-[18%] text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
            Devices
          </Text>
          <Text className="w-[20%] text-right text-[10px] font-black uppercase tracking-wider text-slate-400">
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
          {usersLoading && users.length === 0 ? (
            <View className="flex-1 items-center justify-center gap-2 py-16">
              <ActivityIndicator color="#2563eb" />
              <Text className="text-xs font-semibold text-slate-400">
                Loading users…
              </Text>
            </View>
          ) : users.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8 py-16">
              <HugeiconsIcon icon={UserMultipleIcon} size={40} color="#cbd5e1" />
              <Text className="mt-3 text-center text-sm font-black uppercase tracking-widest text-slate-400">
                No Users Found
              </Text>
              <Text className="mt-1 max-w-[220px] text-center text-xs font-semibold text-slate-400">
                Tap + to invite a user and assign organizations & venues
              </Text>
            </View>
          ) : filtered.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8 py-16">
              <HugeiconsIcon icon={UserMultipleIcon} size={40} color="#cbd5e1" />
              <Text className="mt-3 text-center text-sm font-black uppercase tracking-widest text-slate-400">
                No Matching Users
              </Text>
              <Text className="mt-1 max-w-[220px] text-center text-xs font-semibold text-slate-400">
                No users matched your current search
              </Text>
            </View>
          ) : (
            filtered.map((user) => {
              const venueCount = venues.filter((v) =>
                user.assignedVenueIds?.includes(v.id)
              ).length;
              const deviceCount = units.filter((u) =>
                user.assignedVenueIds?.includes(u.venueId)
              ).length;
              const statusLabel =
                user.status === 'pending' ? 'Pending' : user.status;

              return (
                <View
                  key={user.id}
                  className="flex-row items-center border-b border-slate-50 px-4 py-2.5"
                >
                  <View className="w-[46%] flex-row items-center gap-2 pr-1">
                    <View className="h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                      <HugeiconsIcon icon={UserIcon} size={16} color="#2563eb" />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text
                        numberOfLines={1}
                        className="text-[11px] font-extrabold text-slate-900"
                      >
                        {user.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        className="text-[9px] font-semibold uppercase tracking-wider text-slate-400"
                      >
                        {statusLabel}
                      </Text>
                    </View>
                  </View>
                  <Text className="w-[16%] text-center text-[11px] font-black tabular-nums text-blue-600">
                    {venueCount}
                  </Text>
                  <Text className="w-[18%] text-center text-[11px] font-black tabular-nums text-emerald-600">
                    {deviceCount}
                  </Text>
                  <View className="w-[20%] flex-row items-center justify-end gap-1">
                    <Pressable
                      onPress={() => setEditingUser(user)}
                      hitSlop={6}
                      className="rounded-lg p-1.5 active:bg-blue-50"
                      accessibilityLabel="Edit user"
                    >
                      <HugeiconsIcon
                        icon={Edit02Icon}
                        size={16}
                        color="#2563eb"
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => setDeletingUser(user)}
                      hitSlop={6}
                      className="rounded-lg p-1.5 active:bg-red-50"
                      accessibilityLabel="Delete user"
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
        {!editingUser && !deletingUser ? <Toast toast={toast} /> : null}
      </View>

      <EditUserModal
        user={editingUser}
        orgs={orgs}
        venues={venues}
        onClose={() => setEditingUser(null)}
        onSave={handleSave}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(deletingUser)}
        entityLabel="user"
        onClose={() => setDeletingUser(null)}
        onConfirm={handleDelete}
      />
    </View>
  );
}
