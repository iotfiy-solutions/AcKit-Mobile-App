import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { AlertCircle, Building2, MapPin } from '@hugeicons/core-free-icons';
import { DialogModal } from '../ui/DialogModal';
import { TextField } from '../ui/TextField';
import { Select } from '../ui/Select';

/** Edit Venue — name + organization (web ManagerModals parity). */
export function EditVenueModal({
  venue,
  orgs = [],
  onClose,
  onSave,
}) {
  const [name, setName] = useState('');
  const [orgId, setOrgId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const open = Boolean(venue);

  useEffect(() => {
    if (venue) {
      setName(venue.name || '');
      setOrgId(venue.orgId || orgs[0]?.id || '');
      setError('');
      setSaving(false);
    }
  }, [venue, orgs]);

  const orgOptions = orgs.map((o) => ({ value: o.id, label: o.name }));

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Venue Name is required');
      return;
    }
    if (!orgId) {
      setError('Organization is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(venue.id, { name: trimmed, organizationId: orgId });
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to update venue');
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
      title="Edit Venue"
      subtitle="Update the venue name or organization."
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

        <TextField
          label="Venue Name"
          required
          icon={MapPin}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Main Auditorium"
          autoFocus
        />

        <View>
          <Text className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
            Organization
            <Text className="text-red-500"> *</Text>
          </Text>
          <Select
            value={orgId}
            onChange={setOrgId}
            options={orgOptions}
            placeholder={
              orgs.length === 0 ? 'No organizations yet' : 'Select organization'
            }
            icon={Building2}
            disabled={orgs.length === 0 || saving}
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
            disabled={saving || !name.trim() || !orgId}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-full py-3.5 active:scale-95 ${
              saving || !name.trim() || !orgId ? 'bg-blue-300' : 'bg-blue-600'
            }`}
          >
            {saving ? <ActivityIndicator size="small" color="#ffffff" /> : null}
            <Text className="text-xs font-black uppercase tracking-wider text-white">
              {saving ? 'Updating…' : 'Update'}
            </Text>
          </Pressable>
        </View>
      </View>
    </DialogModal>
  );
}
