import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { AlertCircle, Building2, MapPin } from '@hugeicons/core-free-icons';
import { DialogModal } from '../ui/DialogModal';
import { MultiSelect } from '../ui/MultiSelect';

/**
 * Edit User Access — organizations + venues only (web ManagerModals parity).
 * Name/email are read-only in the subtitle.
 */
export function EditUserModal({ user, orgs = [], venues = [], onClose, onSave }) {
  const [organizationIds, setOrganizationIds] = useState([]);
  const [assignedVenueIds, setAssignedVenueIds] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const open = Boolean(user);

  useEffect(() => {
    if (!user) return;
    const orgIds = user.organizationIds || [];
    setOrganizationIds(orgIds);
    setAssignedVenueIds(
      (user.assignedVenueIds || []).filter((venueId) => {
        const venue = venues.find((v) => v.id === venueId);
        return !!venue && orgIds.includes(venue.orgId);
      })
    );
    setError('');
    setSaving(false);
  }, [user, venues]);

  const orgOptions = useMemo(
    () => orgs.map((o) => ({ value: o.id, label: o.name })),
    [orgs]
  );

  const venueOptions = useMemo(
    () =>
      venues
        .filter((v) => organizationIds.includes(v.orgId))
        .map((v) => ({ value: v.id, label: v.name })),
    [venues, organizationIds]
  );

  const handleOrgsChange = (ids) => {
    setOrganizationIds(ids);
    setAssignedVenueIds((prev) =>
      prev.filter((venueId) => {
        const venue = venues.find((v) => v.id === venueId);
        return venue ? ids.includes(venue.orgId) : false;
      })
    );
  };

  const handleSave = async () => {
    if (organizationIds.length === 0) {
      setError('At least one organization is required');
      return;
    }
    const cleanVenues = assignedVenueIds.filter((venueId) => {
      const venue = venues.find((v) => v.id === venueId);
      return !!venue && organizationIds.includes(venue.orgId);
    });
    setSaving(true);
    setError('');
    try {
      await onSave(user.id, {
        organizationIds,
        assignedVenueIds: cleanVenues,
      });
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to update user access');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogModal
      isOpen={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      title="Edit User Access"
      subtitle={user ? `${user.name} · ${user.email}` : undefined}
    >
      <View className="gap-4">
        {error ? (
          <View className="flex-row items-center gap-2 rounded-2xl border border-red-100 bg-red-50 p-3">
            <HugeiconsIcon icon={AlertCircle} size={16} color="#dc2626" />
            <Text className="min-w-0 flex-1 text-xs font-bold text-red-600">
              {error}
            </Text>
          </View>
        ) : null}

        <View>
          <Text className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
            Organizations
            <Text className="text-red-500"> *</Text>
          </Text>
          <MultiSelect
            values={organizationIds}
            onChange={handleOrgsChange}
            options={orgOptions}
            placeholder="Select organizations…"
            icon={Building2}
            disabled={saving || orgs.length === 0}
          />
        </View>

        <View>
          <Text className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
            Assigned Venues
          </Text>
          <MultiSelect
            values={assignedVenueIds}
            onChange={setAssignedVenueIds}
            options={venueOptions}
            placeholder={
              organizationIds.length === 0
                ? 'Select organizations first…'
                : 'Select venues…'
            }
            icon={MapPin}
            disabled={saving || organizationIds.length === 0}
          />
        </View>

        <View className="mt-1 flex-row gap-3">
          <Pressable
            onPress={onClose}
            disabled={saving}
            className={`flex-1 items-center justify-center rounded-full bg-slate-100 py-3.5 active:scale-95 ${
              saving ? 'opacity-50' : ''
            }`}
          >
            <Text className="text-xs font-black uppercase tracking-wider text-slate-700">
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={saving || organizationIds.length === 0}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-full py-3.5 active:scale-95 ${
              saving || organizationIds.length === 0
                ? 'bg-blue-300'
                : 'bg-blue-600'
            }`}
          >
            {saving ? <ActivityIndicator size="small" color="#ffffff" /> : null}
            <Text className="text-xs font-black uppercase tracking-wider text-white">
              {saving ? 'Updating…' : 'Update Access'}
            </Text>
          </Pressable>
        </View>
      </View>
    </DialogModal>
  );
}
