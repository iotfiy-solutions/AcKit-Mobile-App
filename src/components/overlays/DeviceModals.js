import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Activity01Icon,
  AlertCircle,
  Building2,
  MapPin,
  Cpu,
} from '@hugeicons/core-free-icons';
import { DialogModal } from '../ui/DialogModal';
import { TextField } from '../ui/TextField';
import { Select } from '../ui/Select';

const CAPACITY_OPTIONS = [
  { value: '1', label: '1.0 Ton' },
  { value: '1.5', label: '1.5 Ton' },
  { value: '2', label: '2.0 Ton' },
  { value: '2.5', label: '2.5 Ton' },
  { value: '3', label: '3.0 Ton' },
  { value: '3.5', label: '3.5 Ton' },
];

function capacityValue(device) {
  const n = Number(String(device?.capacityTon || '1.5').replace(/ton/gi, ''));
  return String(Number.isFinite(n) && n > 0 ? n : 1.5);
}

/** Edit Device — name, org, venue, brand, capacity (+ read-only API key). */
export function EditDeviceModal({
  device,
  orgs = [],
  venues = [],
  brands = [],
  onClose,
  onSave,
}) {
  const [name, setName] = useState('');
  const [orgId, setOrgId] = useState('');
  const [venueId, setVenueId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [capacity, setCapacity] = useState('1.5');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const open = Boolean(device);

  useEffect(() => {
    if (device) {
      setName(device.name || '');
      setOrgId(device.organizationId || orgs[0]?.id || '');
      setVenueId(device.venueId || '');
      setBrandId(device.brandId || '');
      setCapacity(capacityValue(device));
      setError('');
      setSaving(false);
    }
  }, [device, orgs]);

  const orgVenues = useMemo(
    () => venues.filter((v) => v.orgId === orgId),
    [venues, orgId]
  );

  useEffect(() => {
    if (!open) return;
    if (orgVenues.some((v) => v.id === venueId)) return;
    setVenueId(orgVenues[0]?.id || '');
  }, [open, orgVenues, venueId]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Device name is required');
      return;
    }
    if (!orgId || !venueId || !brandId) {
      setError('Organization, venue, and brand are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(device.id, {
        name: trimmed,
        organization: orgId,
        venue: venueId,
        brand: brandId,
        capacity: Number(capacity),
        voltage: device.voltage || 230,
      });
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to update device');
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
      title="Edit Device"
      subtitle="Update device details for this AC Kit."
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
          label="Device Name"
          required
          icon={Cpu}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Lobby AC"
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
            options={orgs.map((o) => ({ value: o.id, label: o.name }))}
            icon={Building2}
            disabled={saving || orgs.length === 0}
          />
        </View>

        <View>
          <Text className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
            Venue
            <Text className="text-red-500"> *</Text>
          </Text>
          <Select
            value={venueId}
            onChange={setVenueId}
            options={
              orgVenues.length > 0
                ? orgVenues.map((v) => ({ value: v.id, label: v.name }))
                : [{ value: '', label: 'No venues', disabled: true }]
            }
            icon={MapPin}
            disabled={saving || orgVenues.length === 0}
          />
        </View>

        <View>
          <Text className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
            AC Brand
            <Text className="text-red-500"> *</Text>
          </Text>
          <Select
            value={brandId}
            onChange={setBrandId}
            options={
              brands.length > 0
                ? brands.map((b) => ({ value: b.id, label: b.name }))
                : [{ value: '', label: 'No brands', disabled: true }]
            }
            icon={Cpu}
            disabled={saving || brands.length === 0}
          />
        </View>

        <View>
          <Text className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
            AC Capacity
          </Text>
          <Select
            value={capacity}
            onChange={setCapacity}
            options={CAPACITY_OPTIONS}
            icon={Activity01Icon}
            disabled={saving}
          />
        </View>

        <TextField
          label="API Key"
          icon={Cpu}
          value={device?.apiKey || ''}
          readOnly
          placeholder="No API key"
        />

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
