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
  MapPin,
  X,
} from '@hugeicons/core-free-icons';
import { useAppContext } from '../../context/AppContext';
import { TextField } from '../ui/TextField';
import { Select } from '../ui/Select';

/**
 * Mobile port of web AddVenueOverlayPage — venue name + organization select.
 * Opened from Venues FAB → AddDrawer. `embedded` hides page chrome in the sheet.
 */
export function AddVenueOverlayPage({ onClose, embedded = false }) {
  const { createVenue, dashboardOrgs: orgs } = useAppContext();

  const [name, setName] = useState('');
  const [orgId, setOrgId] = useState(orgs[0]?.id || '');
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

  useEffect(() => {
    if (!orgs.length) {
      setOrgId('');
      return;
    }
    setOrgId((prev) =>
      orgs.some((o) => o.id === prev) ? prev : orgs[0].id
    );
  }, [orgs]);

  const orgOptions = useMemo(
    () => orgs.map((o) => ({ value: o.id, label: o.name })),
    [orgs]
  );

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setError('');

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Venue Name is required');
      return;
    }
    if (trimmed.length < 2) {
      setError('Venue name must be at least 2 characters');
      return;
    }
    if (!orgId) {
      setError('Organization is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await createVenue(trimmed, orgId);
      if (!mountedRef.current) return;
      setIsSuccess(true);
      closeTimerRef.current = setTimeout(onClose, 2000);
    } catch (err) {
      let message = 'Failed to create venue';
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
              New Venue
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
            Venue Created!
          </Text>
          <Text className="max-w-[240px] text-center text-xs font-semibold leading-relaxed text-slate-500">
            The new venue{' '}
            <Text className="font-black text-slate-800">{name.trim()}</Text> has
            been added successfully.
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
                label="Venue Name"
                required
                icon={MapPin}
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  if (error) setError('');
                }}
                placeholder="e.g. SSUET Auditorium"
                className="mb-5"
              />

              <View>
                <Text className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Associated Organization
                  <Text className="text-red-500"> *</Text>
                </Text>
                <Select
                  value={orgId}
                  onChange={setOrgId}
                  options={orgOptions}
                  placeholder={
                    orgs.length === 0
                      ? 'No organizations yet'
                      : 'Select organization'
                  }
                  icon={Building2}
                  disabled={orgs.length === 0 || isSubmitting}
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
                  label="Venue Name"
                  required
                  icon={MapPin}
                  value={name}
                  onChangeText={(v) => {
                    setName(v);
                    if (error) setError('');
                  }}
                  placeholder="e.g. SSUET Auditorium"
                  className="mb-5"
                />

                <View>
                  <Text className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Associated Organization
                    <Text className="text-red-500"> *</Text>
                  </Text>
                  <Select
                    value={orgId}
                    onChange={setOrgId}
                    options={orgOptions}
                    placeholder={
                      orgs.length === 0
                        ? 'No organizations yet'
                        : 'Select organization'
                    }
                    icon={Building2}
                    disabled={orgs.length === 0 || isSubmitting}
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
              disabled={isSubmitting || !name.trim() || !orgId}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-full py-3.5 active:scale-95 ${
                isSubmitting || !name.trim() || !orgId
                  ? 'bg-blue-300'
                  : 'bg-blue-600'
              }`}
              style={
                isSubmitting || !name.trim() || !orgId
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
                    Save Venue
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
