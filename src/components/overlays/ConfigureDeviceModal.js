import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import axios from 'axios';
import { Building2, Cpu, MapPin, Wind } from '@hugeicons/core-free-icons';
import { useAppContext } from '../../context/AppContext';
import { useManagerId } from '../../hooks/useManagerId';
import {
  createDevice,
  findAddedDeviceByMac,
  getDeviceBrandOptions,
} from '../../api/deviceApi';
import { waitForDeviceProvisioned } from '../../api/deviceSetupSocket';
import { getVenuesByOrganization } from '../../api/venueApi';
import { DialogModal } from '../ui/DialogModal';
import { Select } from '../ui/Select';
import { TextField } from '../ui/TextField';
import { Toast } from '../ui/Toast';

const CAPACITY_OPTIONS = [
  { value: '1', label: '1.0 Ton' },
  { value: '1.5', label: '1.5 Ton' },
  { value: '2', label: '2.0 Ton' },
  { value: '2.5', label: '2.5 Ton' },
  { value: '3', label: '3.0 Ton' },
  { value: '3.5', label: '3.5 Ton' },
];

const Label = ({ children, required = false }) => (
  <Text className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
    {children}
    {required ? <Text className="text-red-500"> *</Text> : null}
  </Text>
);

/**
 * "Configure Device" — same fields and API as the web Add Device form
 * (name, organization, venue, brand, capacity → POST /api/device/create).
 */
export function ConfigureDeviceModal({
  isOpen,
  device: setupDevice,
  toast,
  showToast,
  onCancel,
  onCreated,
}) {
  const { dashboardOrgs: orgs } = useAppContext();

  const [name, setName] = useState('');
  const [orgId, setOrgId] = useState('');
  const [venueId, setVenueId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [capacity, setCapacity] = useState('1.5');
  const [venues, setVenues] = useState([]);
  const [brands, setBrands] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const managerId = useManagerId();
  const mountedRef = useRef(true);
  const waiterRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      waiterRef.current?.cancel();
    };
  }, []);

  // Reset + defaults every time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setName(setupDevice?.name || '');
    setCapacity('1.5');
    setOrgId((prev) => (orgs.some((o) => o.id === prev) ? prev : orgs[0]?.id || ''));
  }, [isOpen, orgs, setupDevice?.name]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;
    setIsLoading(true);
    getDeviceBrandOptions()
      .then((list) => {
        if (!active) return;
        setBrands(list);
        setBrandId(list[0]?.id || '');
      })
      .catch(() => active && showToast('Failed to load AC brands'))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [isOpen, showToast]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;
    setVenueId('');
    setVenues([]);
    if (!orgId) return undefined;
    getVenuesByOrganization(orgId)
      .then((list) => {
        if (!active) return;
        setVenues(list);
        setVenueId(list[0]?.id || '');
      })
      .catch(() => active && showToast('Failed to load venues for this organization'));
    return () => {
      active = false;
    };
  }, [isOpen, orgId, showToast]);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!setupDevice?.macAddress) return showToast('Device MAC address is missing. Please retry setup.');
    if (!name.trim()) return showToast('Device Name is required');
    if (!orgId) return showToast('Organization is required');
    if (!venueId) {
      return showToast('Venue is required. Please create a venue first if none exist.');
    }
    if (!brandId) {
      return showToast('AC Brand is required. Please create a brand profile first.');
    }

    setIsSubmitting(true);
    let created = null;
    try {
      created = await createDevice({
        name: name.trim(),
        organization: String(orgId),
        venue: String(venueId),
        brand: String(brandId),
        capacity: Number(capacity),
        macAddress: setupDevice.macAddress,
      });
    } catch (err) {
      // The server may have created the device even though the response never
      // reached the phone (network switch) — or the MAC is already ours.
      created = await recoverCreatedDevice(err);
      if (!created) {
        showCreateError(err);
        if (mountedRef.current) setIsSubmitting(false);
        return;
      }
    }

    // The device exists now; the backend marks it configured only after the
    // ESP confirms it saved the API key.
    if (mountedRef.current) setIsConfirming(true);
    const waiter = waitForDeviceProvisioned({
      managerId,
      macAddress: setupDevice.macAddress,
    });
    waiterRef.current = waiter;
    const confirmed = await waiter.promise;
    waiterRef.current = null;
    if (!mountedRef.current) return;

    setIsConfirming(false);
    setIsSubmitting(false);
    onCreated(created, { confirmed });
  };

  const recoverCreatedDevice = async (err) => {
    if (!axios.isAxiosError(err)) return null;
    const noResponse = !err.response;
    const macTaken =
      err.response?.status === 409 &&
      /\bMAC\b/i.test(err.response?.data?.message || '');
    if (!noResponse && !macTaken) return null;
    return findAddedDeviceByMac(managerId, setupDevice.macAddress, {
      attempts: noResponse ? 4 : 1,
    });
  };

  const showCreateError = (err) => {
    if (!axios.isAxiosError(err)) {
      showToast(err instanceof Error ? err.message : 'Failed to create device');
      return;
    }
    const status = err.response?.status;
    const data = err.response?.data || {};
    const details = (data.errors || [])
      .map((e) => e.message)
      .filter(Boolean)
      .join(' · ');
    const apiMessage = err.response
      ? data.message || ''
      : 'Could not reach the server. Check your connection and try again.';

    // Same MAC already has a device → it is not a name problem
    const macTaken = status === 409 && /\bMAC\b/i.test(apiMessage);
    const offline = status === 409 && /offline/i.test(apiMessage);
    const notRegistered = status === 404 && /physical device/i.test(apiMessage);
    const keyNotSent = status === 503;
    const nameTaken =
      !macTaken &&
      !offline &&
      status === 409 &&
      (/already exists/i.test(apiMessage) ||
        /name is already/i.test(apiMessage) ||
        /duplicate/i.test(apiMessage));

    if (macTaken) {
      showToast('This AC Kit is already added to your account. Check your devices list.');
    } else if (offline) {
      showToast('This AC Kit is offline. Power it on, check its Wi-Fi and try again.');
    } else if (notRegistered) {
      showToast('We could not find this AC Kit. Make sure it is powered on and online, then try again.');
    } else if (keyNotSent) {
      showToast('Could not send the setup key to the AC Kit. Make sure it is online and try again.');
    } else if (nameTaken) {
      showToast('This name is already present in this venue');
    } else {
      showToast(details || apiMessage || err.message);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) onCancel();
  };

  const orgOptions = orgs.map((o) => ({ value: o.id, label: o.name }));
  const venueOptions = venues.map((v) => ({ value: v.id, label: v.name }));
  const brandOptions = brands.map((b) => ({ value: b.id, label: b.name }));

  return (
    <DialogModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Configure Device"
      subtitle="Your AC Kit is online. Add its details to finish setup."
      banner={<Toast toast={toast} />}
    >
      <View className="gap-4">
        <TextField
          label="Device Name"
          required
          icon={Cpu}
          value={name}
          onChangeText={setName}
          placeholder="e.g. SSUET Seminar Hall AC"
        />

        <View>
          <Label required>Select Organization</Label>
          <Select
            value={orgId}
            onChange={setOrgId}
            options={orgOptions}
            placeholder="Select organization"
            icon={Building2}
            disabled={orgs.length === 0}
          />
        </View>

        <View>
          <Label required>Select Venue</Label>
          <Select
            value={venueId}
            onChange={setVenueId}
            options={venueOptions}
            placeholder="No venues available"
            icon={MapPin}
            disabled={!orgId}
          />
        </View>

        <View className="flex-row gap-4">
          <View className="min-w-0 flex-1">
            <Label>AC Brand</Label>
            <Select
              value={brandId}
              onChange={setBrandId}
              options={brandOptions}
              placeholder={isLoading ? 'Loading…' : 'No brands'}
              icon={Wind}
              disabled={isLoading || brands.length === 0}
            />
          </View>
          <View className="min-w-0 flex-1">
            <Label>AC Capacity</Label>
            <Select
              value={capacity}
              onChange={setCapacity}
              options={CAPACITY_OPTIONS}
              icon={Wind}
            />
          </View>
        </View>

        <View className="mt-1 flex-row gap-3">
          <Pressable
            onPress={handleClose}
            disabled={isSubmitting}
            className={`flex-1 items-center justify-center rounded-full bg-slate-100 py-3.5 active:scale-95 ${
              isSubmitting ? 'opacity-50' : ''
            }`}
          >
            <Text className="text-xs font-black uppercase tracking-wider text-slate-700">
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting || isLoading}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-full py-3.5 shadow-lg active:scale-95 ${
              isSubmitting || isLoading ? 'bg-blue-300' : 'bg-blue-600'
            }`}
          >
            {isSubmitting ? <ActivityIndicator size="small" color="#ffffff" /> : null}
            <Text className="text-xs font-black uppercase tracking-wider text-white">
              {isConfirming
                ? 'Finishing setup…'
                : isSubmitting
                  ? 'Saving…'
                  : 'Save Device'}
            </Text>
          </Pressable>
        </View>
      </View>
    </DialogModal>
  );
}
