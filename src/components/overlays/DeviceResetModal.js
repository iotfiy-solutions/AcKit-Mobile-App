import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import axios from 'axios';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { AlertCircle, Cpu } from '@hugeicons/core-free-icons';
import { useAppContext } from '../../context/AppContext';
import { getApiErrorMessage } from '../../api/authApi';
import { DialogModal } from '../ui/DialogModal';

/**
 * Manager factory-reset approval — shown when ESP holds reset 5s
 * and backend emits device:resetRequest.
 */
export function DeviceResetModal() {
  const {
    role,
    pendingResetRequest,
    respondToDeviceReset,
    clearPendingResetRequest,
  } = useAppContext();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const busyRef = useRef(false);

  const open =
    role === 'manager' &&
    Boolean(pendingResetRequest?.requestId) &&
    pendingResetRequest?.status !== 'dismissed';

  const waiting = pendingResetRequest?.status === 'approved_waiting';

  useEffect(() => {
    if (pendingResetRequest?.requestId) {
      setBusy(false);
      setError('');
      busyRef.current = false;
    }
  }, [pendingResetRequest?.requestId]);

  const handleRespond = async (approved) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await respondToDeviceReset(approved);
      if (!approved) {
        // Already cleared in context
      }
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message || getApiErrorMessage(err)
        : err?.message || getApiErrorMessage(err);
      setError(message || 'Failed to respond to reset request');
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (role !== 'manager') return null;

  const deviceLabel =
    pendingResetRequest?.deviceName ||
    pendingResetRequest?.deviceId ||
    'Device';
  const metaParts = [
    pendingResetRequest?.deviceId,
    pendingResetRequest?.venueName,
    pendingResetRequest?.organizationName,
  ].filter(Boolean);

  return (
    <DialogModal
      isOpen={open}
      onClose={() => {
        if (!busy && !waiting) clearPendingResetRequest();
      }}
      title="Factory Reset Request"
      subtitle={
        waiting
          ? 'Waiting for the device to confirm wipe…'
          : `${deviceLabel} is asking to wipe its configuration.`
      }
    >
      <View className="gap-4">
        <View className="flex-row items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <HugeiconsIcon icon={AlertCircle} size={20} color="#d97706" />
          <Text className="min-w-0 flex-1 text-sm font-semibold leading-relaxed text-amber-800">
            {waiting
              ? 'Approval sent. The device will clear its config and return to setup mode. This dialog closes when the wipe is confirmed.'
              : 'Approve to factory-reset this AC Kit (remove from your account after device confirms). Reject to keep the current configuration.'}
          </Text>
        </View>

        <View className="flex-row items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <HugeiconsIcon icon={Cpu} size={18} color="#2563eb" />
          </View>
          <View className="min-w-0 flex-1">
            <Text
              numberOfLines={1}
              className="text-sm font-black text-slate-900"
            >
              {deviceLabel}
            </Text>
            {metaParts.length > 0 ? (
              <Text
                numberOfLines={2}
                className="mt-0.5 text-[11px] font-semibold text-slate-500"
              >
                {metaParts.join(' · ')}
              </Text>
            ) : null}
          </View>
        </View>

        {error ? (
          <View className="flex-row items-center gap-2 rounded-2xl border border-red-100 bg-red-50 p-3">
            <HugeiconsIcon icon={AlertCircle} size={16} color="#dc2626" />
            <Text className="min-w-0 flex-1 text-xs font-bold text-red-600">
              {error}
            </Text>
          </View>
        ) : null}

        {waiting ? (
          <View className="flex-row items-center justify-center gap-2 py-2">
            <ActivityIndicator color="#2563eb" />
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Waiting for device…
            </Text>
          </View>
        ) : (
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => handleRespond(false)}
              disabled={busy}
              className={`flex-1 items-center justify-center rounded-full bg-slate-100 py-3.5 active:scale-95 ${
                busy ? 'opacity-50' : ''
              }`}
            >
              <Text className="text-xs font-black uppercase tracking-wider text-slate-700">
                Reject
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleRespond(true)}
              disabled={busy}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-full py-3.5 active:scale-95 ${
                busy ? 'bg-red-300' : 'bg-red-600'
              }`}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : null}
              <Text className="text-xs font-black uppercase tracking-wider text-white">
                {busy ? 'Sending…' : 'Approve'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </DialogModal>
  );
}
