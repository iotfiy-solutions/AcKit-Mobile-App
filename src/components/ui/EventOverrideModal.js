import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppModal } from './AppModal';
import { describeCoveringEvents } from '../../utils/eventOverride';

/** Mirrors web components/ui/EventOverrideModal.tsx */
export function EventOverrideModal({ pending, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleCancel = () => {
    if (busy) return;
    pending?.cancel();
    setError('');
    onClose();
  };

  const handleConfirm = async () => {
    if (!pending || busy) return;
    setBusy(true);
    setError('');
    try {
      await pending.confirm();
      onClose();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || 'Failed to ignore event'
      );
    } finally {
      setBusy(false);
    }
  };

  const subtitle = pending
    ? pending.ignoreAllTargets
      ? 'Ignore this schedule for all devices it currently covers, then apply your change?'
      : 'Ignore this schedule for this device only, then apply your change?'
    : undefined;

  return (
    <AppModal
      isOpen={!!pending}
      onClose={handleCancel}
      title="Ignore running event?"
      subtitle={subtitle}
    >
      <View className="gap-4">
        <Text className="text-sm font-medium leading-relaxed text-slate-600">
          {pending
            ? `A schedule is currently active: ${describeCoveringEvents(pending.events)}. Manual changes will not stick unless you ignore it.`
            : null}
        </Text>
        {error ? (
          <Text className="text-xs font-semibold text-red-600">{error}</Text>
        ) : null}
        <View className="flex-row justify-end gap-2 pt-1">
          <Pressable
            disabled={busy}
            onPress={handleCancel}
            className={`rounded-xl bg-slate-100 px-4 py-2 ${busy ? 'opacity-50' : ''}`}
          >
            <Text className="text-xs font-black uppercase tracking-wider text-slate-600">
              No, keep event
            </Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={() => void handleConfirm()}
            className={`rounded-xl bg-blue-600 px-4 py-2 ${busy ? 'opacity-50' : ''}`}
          >
            <Text className="text-xs font-black uppercase tracking-wider text-white">
              {busy ? 'Applying…' : 'Yes, ignore & change'}
            </Text>
          </Pressable>
        </View>
      </View>
    </AppModal>
  );
}
