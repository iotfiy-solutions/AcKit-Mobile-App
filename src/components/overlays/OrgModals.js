import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { AlertCircle, Building2, MapPin } from '@hugeicons/core-free-icons';
import { DialogModal } from '../ui/DialogModal';
import { TextField } from '../ui/TextField';

/** Edit Organization — name + optional address (web ManagerModals parity). */
export function EditOrgModal({
  org,
  onClose,
  onSave,
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const open = Boolean(org);

  useEffect(() => {
    if (org) {
      setName(org.name || '');
      setAddress(org.address || '');
      setError('');
      setSaving(false);
    }
  }, [org]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Organization Name is required');
      return;
    }
    if (trimmed.length < 3) {
      setError('Organization name must be at least 3 characters');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(org.id, trimmed, address.trim() || undefined);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to update organization');
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
      title="Edit Organization"
      subtitle="Update the organization name or address."
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
          label="Organization Name"
          required
          icon={Building2}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Acme Corp"
          autoFocus
        />

        <View>
          <Text className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
            Address{' '}
            <Text className="font-bold normal-case tracking-normal text-slate-300">
              (Optional)
            </Text>
          </Text>
          <TextField
            icon={MapPin}
            value={address}
            onChangeText={setAddress}
            placeholder="Optional street / city"
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
            disabled={saving || !name.trim()}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-full py-3.5 active:scale-95 ${
              saving || !name.trim() ? 'bg-blue-300' : 'bg-blue-600'
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

/** Confirm delete — reusable for org / venue / user / device later. */
export function ConfirmDeleteModal({
  isOpen,
  entityLabel = 'item',
  onClose,
  onConfirm,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const busyRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setBusy(false);
      setError('');
      busyRef.current = false;
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err?.message || `Failed to delete ${entityLabel}`);
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <DialogModal
      isOpen={isOpen}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Confirm Deletion"
    >
      <View className="gap-4">
        <View className="flex-row items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <HugeiconsIcon icon={AlertCircle} size={20} color="#d97706" />
          <Text className="min-w-0 flex-1 text-sm font-semibold leading-relaxed text-amber-800">
            Are you sure you want to delete this {entityLabel}? This action
            cannot be undone.
          </Text>
        </View>

        {error ? (
          <View className="flex-row items-center gap-2 rounded-2xl border border-red-100 bg-red-50 p-3">
            <HugeiconsIcon icon={AlertCircle} size={16} color="#dc2626" />
            <Text className="min-w-0 flex-1 text-xs font-bold text-red-600">
              {error}
            </Text>
          </View>
        ) : null}

        <View className="flex-row gap-3">
          <Pressable
            onPress={onClose}
            disabled={busy}
            className={`flex-1 items-center justify-center rounded-full bg-slate-100 py-3.5 active:scale-95 ${
              busy ? 'opacity-50' : ''
            }`}
          >
            <Text className="text-xs font-black uppercase tracking-wider text-slate-700">
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            disabled={busy}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-full py-3.5 active:scale-95 ${
              busy ? 'bg-red-300' : 'bg-red-600'
            }`}
          >
            {busy ? <ActivityIndicator size="small" color="#ffffff" /> : null}
            <Text className="text-xs font-black uppercase tracking-wider text-white">
              {busy ? 'Deleting…' : 'Delete'}
            </Text>
          </Pressable>
        </View>
      </View>
    </DialogModal>
  );
}
