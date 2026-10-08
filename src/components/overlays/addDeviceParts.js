import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  AlertCircle,
  CheckCircle,
  Lock,
  Wifi,
} from '@hugeicons/core-free-icons';
import { DialogModal } from '../ui/DialogModal';

/**
 * Presentational pieces for the Add Device SoftAP wizard (demo step UI).
 * Logic stays in AddDeviceOverlayPage — these are display-only.
 */

export const SETUP_STEPS = [
  'Discover',
  'Connect',
  'Network',
  'Verify',
  'Configure',
  'Complete',
];

/** Map wizard UI step → stepper index (0–5). */
export function stepIndexFor(uiStep) {
  switch (uiStep) {
    case 'discover':
      return 0;
    case 'connect':
      return 1;
    case 'network':
    case 'wifiPassword':
      return 2;
    case 'verify':
      return 3;
    case 'configure':
      return 4;
    case 'complete':
      return 5;
    default:
      return 0;
  }
}

export function SetupStepper({ activeIndex }) {
  return (
    <View className="mb-3 flex-row gap-1.5 px-0.5">
      {SETUP_STEPS.map((label, i) => {
        const active = i <= activeIndex;
        return (
          <View key={label} className="min-w-0 flex-1 items-center">
            <View
              className={`mb-1.5 h-[3px] w-full rounded-full ${
                active ? 'bg-blue-600' : 'bg-slate-200'
              }`}
            />
            <Text
              numberOfLines={1}
              className={`text-[9px] font-bold ${
                active ? 'text-blue-600' : 'text-slate-400'
              }`}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function WizardCard({ children, className = '' }) {
  return (
    <View
      className={`min-h-0 flex-1 overflow-hidden rounded-3xl border border-slate-100 bg-white px-4 pb-4 pt-4 shadow-sm ${className}`}
    >
      {children}
    </View>
  );
}

export function BackLink({ onPress, disabled = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      className={`mb-3 self-start active:opacity-70 ${disabled ? 'opacity-40' : ''}`}
    >
      <Text className="text-sm font-bold text-blue-600">← Back</Text>
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  busyLabel,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      className={`min-h-[44px] flex-1 flex-row items-center justify-center gap-2 rounded-xl px-4 py-3 active:scale-[0.98] ${
        disabled || busy ? 'bg-blue-300' : 'bg-blue-600'
      }`}
    >
      {busy ? <ActivityIndicator size="small" color="#ffffff" /> : null}
      <Text className="text-sm font-bold text-white">
        {busy ? busyLabel || label : label}
      </Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 active:scale-[0.98] ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <Text className="text-sm font-bold text-blue-600">{label}</Text>
    </Pressable>
  );
}

const signalLabel = (level) => {
  if (level >= -60) return 'Strong';
  if (level >= -75) return 'Good';
  if (level >= -85) return 'Fair';
  return 'Weak';
};

/** Selectable device / Wi-Fi row matching the demo cards. */
export function SelectableRow({
  title,
  subtitle,
  selected = false,
  secured = false,
  showWifiIcon = false,
  onPress,
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`mb-2 flex-row items-center rounded-xl border px-3.5 py-3.5 active:opacity-90 ${
        selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-slate-200 bg-white'
      }`}
    >
      <View className="min-w-0 flex-1 pr-2">
        <Text numberOfLines={1} className="text-[13px] font-semibold text-slate-800">
          {title}
          {subtitle ? (
            <Text className="font-medium text-slate-500"> · {subtitle}</Text>
          ) : null}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        {selected ? (
          <HugeiconsIcon icon={CheckCircle} size={18} color="#2563eb" />
        ) : null}
        {showWifiIcon ? (
          <HugeiconsIcon icon={Wifi} size={16} color="#64748b" />
        ) : null}
        {secured ? <HugeiconsIcon icon={Lock} size={14} color="#94a3b8" /> : null}
      </View>
    </Pressable>
  );
}

export function wifiSignalSubtitle(level) {
  return signalLabel(level);
}

export function StatusPill({ label }) {
  return (
    <View className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
      <Text className="text-[11px] font-semibold text-slate-600">{label}</Text>
    </View>
  );
}

/** Verify-step checklist (visual only — driven by phase index). */
export function ProgressChecklist({ items }) {
  return (
    <View className="mt-2 gap-3.5">
      {items.map((item) => {
        const done = item.status === 'done';
        const active = item.status === 'active';
        const pending = item.status === 'pending';
        return (
          <View key={item.label} className="flex-row items-center gap-3">
            {done ? (
              <HugeiconsIcon icon={CheckCircle} size={20} color="#16a34a" />
            ) : active ? (
              <View className="h-5 w-5 items-center justify-center rounded-full bg-blue-600">
                <View className="h-2 w-2 rounded-full bg-white" />
              </View>
            ) : (
              <View className="h-5 w-5 rounded-full border-2 border-slate-200" />
            )}
            <Text
              className={`text-[13px] font-semibold ${
                pending ? 'text-slate-400' : 'text-slate-800'
              }`}
            >
              {item.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function EmptyState({
  title,
  message,
  error = false,
  loading = false,
  actionLabel,
  onAction,
}) {
  return (
    <View className="flex-1 items-center justify-center p-6">
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
        <View className="mt-4 w-full max-w-[200px]">
          <PrimaryButton label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const TROUBLESHOOT_TIPS = [
  'Keep ACKit powered and nearby during setup.',
  'Confirm app permissions and valid credentials.',
  'Use a supported 2.4GHz network band.',
  'Verify device supports your network band.',
  'Internet on router is required for cloud registration.',
];

export function TroubleshootingModal({ isOpen, onClose }) {
  return (
    <DialogModal isOpen={isOpen} onClose={onClose} title="Troubleshooting">
      <View className="gap-3">
        {TROUBLESHOOT_TIPS.map((tip) => (
          <View key={tip} className="flex-row gap-2">
            <Text className="text-sm font-bold text-slate-800">•</Text>
            <Text className="flex-1 text-sm font-medium leading-5 text-slate-700">
              {tip}
            </Text>
          </View>
        ))}
        <View className="mt-2">
          <SecondaryButton label="Done" onPress={onClose} />
        </View>
      </View>
    </DialogModal>
  );
}

/** @deprecated kept for any leftover imports — prefer SelectableRow */
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

/** @deprecated prefer SelectableRow */
export function WifiRow({ ssid, level, secured, actionLabel, onPress, first }) {
  return (
    <View
      className={`flex-row items-center gap-3 px-5 py-4 ${
        first ? '' : 'border-t border-slate-100'
      }`}
    >
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-[13px] font-bold text-slate-800">
          {ssid}
        </Text>
        <Text className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {secured ? 'Secured' : 'Open'} · {signalLabel(level)}
        </Text>
      </View>
      <PillButton label={actionLabel} onPress={onPress} small />
    </View>
  );
}
