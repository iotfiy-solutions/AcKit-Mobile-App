import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { AlertCircle, Lock } from '@hugeicons/core-free-icons';

/**
 * Small presentational pieces for the Add Device wizard, styled like the rest
 * of the app (white rounded-3xl card, divided rows, blue pill buttons).
 */

const signalLabel = (level) => {
  if (level >= -60) return 'Strong';
  if (level >= -75) return 'Good';
  return 'Weak';
};

/** 4-bar signal indicator (dBm → bars). */
function SignalBars({ level }) {
  const active = level >= -55 ? 4 : level >= -65 ? 3 : level >= -75 ? 2 : 1;
  return (
    <View className="h-4 flex-row items-end gap-[2px]">
      {[5, 8, 11, 14].map((h, i) => (
        <View
          key={h}
          style={{
            width: 3,
            height: h,
            borderRadius: 2,
            backgroundColor: i < active ? '#2563eb' : '#cbd5e1',
          }}
        />
      ))}
    </View>
  );
}

/** Blue pill (same look as the "Filter" pill in the org overlay). */
export function PillButton({ label, onPress, disabled = false, small = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`rounded-full shadow-md active:scale-95 ${
        small ? 'px-3.5 py-2.5' : 'px-5 py-3'
      } ${disabled ? 'bg-blue-300' : 'bg-blue-600 active:bg-blue-700'}`}
    >
      <Text className="text-[10px] font-black uppercase tracking-wider text-white">
        {label}
      </Text>
    </Pressable>
  );
}

/** One row of the list card: signal icon, SSID, security · signal, action pill. */
export function WifiRow({ ssid, level, secured, actionLabel, onPress, first }) {
  return (
    <View
      className={`flex-row items-center gap-3 px-5 py-4 ${
        first ? '' : 'border-t border-slate-100'
      }`}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full border border-blue-100/30 bg-blue-50">
        <SignalBars level={level} />
      </View>
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-[13px] font-bold text-slate-800">
          {ssid}
        </Text>
        <View className="mt-0.5 flex-row items-center gap-1">
          {secured ? <HugeiconsIcon icon={Lock} size={10} color="#94a3b8" /> : null}
          <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {secured ? 'Secured' : 'Open'} · {signalLabel(level)}
          </Text>
        </View>
      </View>
      <PillButton label={actionLabel} onPress={onPress} small />
    </View>
  );
}

/** Centered empty / error state (same as "No Venues Found" in the org overlay). */
export function EmptyState({
  title,
  message,
  error = false,
  loading = false,
  actionLabel,
  onAction,
}) {
  return (
    <View className="flex-1 items-center justify-center p-8">
      {loading ? (
        <ActivityIndicator color="#2563eb" />
      ) : error ? (
        <HugeiconsIcon icon={AlertCircle} size={24} color="#dc2626" />
      ) : null}
      <Text
        className={`text-sm font-black uppercase tracking-widest ${
          loading || error ? 'mt-3' : ''
        } ${error ? 'text-red-600' : 'text-slate-400'}`}
      >
        {title}
      </Text>
      {message ? (
        <Text className="mt-1 max-w-[240px] text-center text-xs text-slate-400">
          {message}
        </Text>
      ) : null}
      {actionLabel ? (
        <View className="mt-4">
          <PillButton label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}
