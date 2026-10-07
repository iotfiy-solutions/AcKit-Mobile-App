import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';
import axios from 'axios';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  AlertCircle,
  ArrowRight01Icon,
  Building2,
  Check,
  Mail01Icon,
  MapPin,
  UserIcon,
  X,
} from '@hugeicons/core-free-icons';
import { useAppContext } from '../../context/AppContext';
import { TextField } from '../ui/TextField';
import { MultiSelect } from '../ui/MultiSelect';

/**
 * Mobile port of web AddUserOverlayPage.
 * Fields: name, email, organizations (multi), venues (multi, filtered by orgs).
 * Opened from Users FAB → AddDrawer. `embedded` hides page chrome in the sheet.
 */
export function AddUserOverlayPage({ onClose, embedded = false }) {
  const {
    createSubUser,
    dashboardOrgs: orgs,
    dashboardVenues: venues,
  } = useAppContext();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organizationIds, setOrganizationIds] = useState([]);
  const [assignedVenueIds, setAssignedVenueIds] = useState([]);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mountedRef = useRef(true);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

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

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setError('');

    if (!name.trim()) {
      setError('Full Name is required');
      return;
    }
    if (!email.trim()) {
      setError('Email address is required');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please provide a valid email address');
      return;
    }
    if (organizationIds.length === 0) {
      setError('Select at least one organization');
      return;
    }

    setIsSubmitting(true);
    try {
      await createSubUser({
        name: name.trim(),
        email: email.trim(),
        organizations: organizationIds,
        venues: assignedVenueIds,
      });
      if (!mountedRef.current) return;
      setIsSuccess(true);
      closeTimerRef.current = setTimeout(onClose, 2000);
    } catch (err) {
      let message = 'Failed to create user';
      if (axios.isAxiosError(err)) {
        const data = err.response?.data || {};
        message = data.errors?.[0]?.message || data.message || message;
      } else if (err instanceof Error && err.message) {
        message = err.message;
      }
      if (mountedRef.current) setError(message);
    } finally {
      if (mountedRef.current) setIsSubmitting(false);
    }
  };

  return (
    <View className={embedded ? 'pb-2' : 'flex-1 bg-slate-50 px-5 pb-2 pt-1'}>
      {!embedded ? (
        <View className="mb-4 shrink-0 flex-row items-center justify-between">
          <View className="min-w-0 flex-1 pr-3">
            <Text className="mb-1 text-[10px] font-black uppercase tracking-widest text-blue-600">
              Add Directory Record
            </Text>
            <Text className="text-xl font-black leading-none tracking-tight text-slate-900">
              New User
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            disabled={isSubmitting}
            accessibilityLabel="Close"
            className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 active:scale-90"
          >
            <HugeiconsIcon icon={X} size={20} color="#64748b" strokeWidth={2.5} />
          </Pressable>
        </View>
      ) : null}

      {isSuccess ? (
        <View className={`${embedded ? '' : 'flex-1 '}items-center justify-center px-4 py-10`}>
          <View
            className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-emerald-50"
            style={{
              shadowColor: '#10b981',
              shadowOpacity: 0.15,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }}
          >
            <HugeiconsIcon icon={Check} size={40} color="#059669" strokeWidth={2.5} />
          </View>
          <Text className="mb-2 text-center text-xl font-black text-slate-900">
            User Created!
          </Text>
          <Text className="max-w-[260px] text-center text-xs font-semibold leading-relaxed text-slate-500">
            Verification OTP sent to{' '}
            <Text className="font-black text-slate-800">{email.trim()}</Text>.
            After OTP verification they can set a password and join.
          </Text>
        </View>
      ) : (
        <View className={embedded ? '' : 'min-h-0 flex-1'}>
          {embedded ? (
            <View className="rounded-3xl border border-slate-100 bg-white p-6">
              {error ? (
                <View className="mb-5 flex-row items-center gap-2.5 rounded-2xl border border-red-100 bg-red-50 p-3">
                  <HugeiconsIcon icon={AlertCircle} size={16} color="#dc2626" />
                  <Text className="min-w-0 flex-1 text-xs font-bold text-red-600">
                    {error}
                  </Text>
                </View>
              ) : null}

              <TextField
                label="Full Name"
                required
                icon={UserIcon}
                value={name}
                onChangeText={setName}
                placeholder="e.g. John Doe"
                autoCapitalize="words"
                className="mb-5"
              />

              <TextField
                label="Email"
                required
                icon={Mail01Icon}
                value={email}
                onChangeText={setEmail}
                placeholder="user@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                className="mb-5"
              />

              <View className="mb-5">
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
                  disabled={isSubmitting || orgs.length === 0}
                />
              </View>

              <View>
                <Text className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Assign Venues
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
                  disabled={isSubmitting || organizationIds.length === 0}
                />
              </View>
            </View>
          ) : (
            <KeyboardAwareScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'center',
                paddingVertical: 16,
              }}
              bottomOffset={24}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View className="rounded-3xl border border-slate-100 bg-white p-6">
                {error ? (
                  <View className="mb-5 flex-row items-center gap-2.5 rounded-2xl border border-red-100 bg-red-50 p-3">
                    <HugeiconsIcon icon={AlertCircle} size={16} color="#dc2626" />
                    <Text className="min-w-0 flex-1 text-xs font-bold text-red-600">
                      {error}
                    </Text>
                  </View>
                ) : null}

                <TextField
                  label="Full Name"
                  required
                  icon={UserIcon}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. John Doe"
                  autoCapitalize="words"
                  className="mb-5"
                />

                <TextField
                  label="Email"
                  required
                  icon={Mail01Icon}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="user@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="mb-5"
                />

                <View className="mb-5">
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
                    disabled={isSubmitting || orgs.length === 0}
                  />
                </View>

                <View>
                  <Text className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Assign Venues
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
                    disabled={isSubmitting || organizationIds.length === 0}
                  />
                </View>
              </View>
            </KeyboardAwareScrollView>
          )}

          <View className="shrink-0 flex-row gap-4 border-t border-slate-100/50 pt-4">
            <Pressable
              onPress={onClose}
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
              disabled={
                isSubmitting ||
                !name.trim() ||
                !email.trim() ||
                organizationIds.length === 0
              }
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-full py-3.5 active:scale-95 ${
                isSubmitting ||
                !name.trim() ||
                !email.trim() ||
                organizationIds.length === 0
                  ? 'bg-blue-300'
                  : 'bg-blue-600'
              }`}
              style={
                isSubmitting ||
                !name.trim() ||
                !email.trim() ||
                organizationIds.length === 0
                  ? undefined
                  : {
                      shadowColor: '#2563eb',
                      shadowOpacity: 0.15,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 3,
                    }
              }
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Text className="text-xs font-black uppercase tracking-wider text-white">
                    Save User
                  </Text>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    size={16}
                    color="#ffffff"
                  />
                </>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
