import React, { useEffect, useRef, useState } from 'react';
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

/**
 * Mobile port of web AddOrgOverlayPage — same fields, validation and success state.
 * Opened from Orgs tab FAB → AddDrawer (ConsoleLayout).
 * `embedded` hides the page chrome when shown inside the bottom sheet.
 */
export function AddOrgOverlayPage({ onClose, embedded = false }) {
  const { createOrganization } = useAppContext();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
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

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setError('');

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Organization Name is required');
      return;
    }
    if (trimmed.length < 3) {
      setError('Organization name must be at least 3 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      await createOrganization(trimmed, address.trim() || undefined);
      if (!mountedRef.current) return;
      setIsSuccess(true);
      closeTimerRef.current = setTimeout(onClose, 2000);
    } catch (err) {
      let message = 'Failed to create organization';
      if (axios.isAxiosError(err)) {
        const data = err.response?.data || {};
        message =
          data.errors?.[0]?.message || data.message || message;
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
              New Organization
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
        <View className="items-center justify-center px-4 py-10">
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
            Organization Created!
          </Text>
          <Text className="max-w-[240px] text-center text-xs font-semibold leading-relaxed text-slate-500">
            The new organization{' '}
            <Text className="font-black text-slate-800">{name.trim()}</Text> has
            been added successfully to your command directory.
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
                label="Organization Name"
                required
                icon={Building2}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Sir Syed University"
                className="mb-5"
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
                  label="Organization Name"
                  required
                  icon={Building2}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Sir Syed University"
                  className="mb-5"
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
              </View>
            </KeyboardAwareScrollView>
          )}

          <View className="shrink-0 pt-4">
            <Pressable
              onPress={handleSubmit}
              disabled={isSubmitting || !name.trim()}
              className={`flex-row items-center justify-center gap-2 rounded-2xl py-4 active:scale-[0.98] ${
                isSubmitting || !name.trim() ? 'bg-blue-300' : 'bg-blue-600'
              }`}
              style={
                isSubmitting || !name.trim()
                  ? undefined
                  : {
                      shadowColor: '#2563eb',
                      shadowOpacity: 0.2,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 4,
                    }
              }
            >
              {isSubmitting ? (
                <>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text className="text-xs font-black uppercase tracking-wider text-white">
                    Creating...
                  </Text>
                </>
              ) : (
                <>
                  <Text className="text-xs font-black uppercase tracking-wider text-white">
                    Create Organization
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
