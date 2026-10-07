import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Wifi } from '@hugeicons/core-free-icons';
import { DialogModal } from '../ui/DialogModal';
import { TextField } from '../ui/TextField';
import { Toast } from '../ui/Toast';

/**
 * Shared modal for "Connect AC Kit" (device AP) and "Connect Wifi" (home Wi-Fi):
 * read-only SSID + password + Cancel / Connect. While `busy` it can't be dismissed.
 */
export function WifiCredentialsModal({
  ssid,
  title,
  subtitle,
  submitLabel = 'Connect',
  busyLabel = 'Connecting…',
  busy = false,
  hint,
  /** When set, show a secondary action that opens Android Wi-Fi settings. */
  settingsActionLabel,
  onSettingsAction,
  toast,
  onSubmit,
  onClose,
}) {
  const [password, setPassword] = useState('');
  const isOpen = Boolean(ssid);
  // keep showing the SSID while the close animation plays
  const lastSsid = useRef('');
  if (ssid) lastSsid.current = ssid;

  useEffect(() => {
    if (isOpen) setPassword('');
  }, [isOpen, ssid]);

  const canSubmit = password.length >= 8 && !busy;
  const handleClose = () => {
    if (!busy) onClose();
  };
  const handleSubmit = () => {
    if (canSubmit) onSubmit(password);
  };

  return (
    <DialogModal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      subtitle={subtitle}
      banner={<Toast toast={toast} />}
    >
      <View className="gap-4">
        <TextField label="SSID" value={ssid || lastSsid.current} readOnly icon={Wifi} />
        <TextField
          label="Password"
          required
          value={password}
          onChangeText={setPassword}
          placeholder="Enter Wi-Fi password"
          secure
          autoFocus
          onSubmitEditing={handleSubmit}
        />
        {hint ? (
          <Text className="-mt-2 text-[11px] font-semibold leading-relaxed text-slate-400">
            {hint}
          </Text>
        ) : null}

        {settingsActionLabel && onSettingsAction ? (
          <Pressable
            onPress={onSettingsAction}
            disabled={busy}
            className={`-mt-1 items-center rounded-full border border-slate-200 bg-white py-2.5 active:scale-95 ${
              busy ? 'opacity-50' : ''
            }`}
          >
            <Text className="text-[11px] font-black uppercase tracking-wider text-slate-700">
              {settingsActionLabel}
            </Text>
          </Pressable>
        ) : null}

        <View className="mt-1 flex-row gap-3">
          <Pressable
            onPress={handleClose}
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
            onPress={handleSubmit}
            disabled={!canSubmit}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-full py-3.5 shadow-lg active:scale-95 ${
              canSubmit ? 'bg-blue-600' : 'bg-blue-300'
            }`}
          >
            {busy ? <ActivityIndicator size="small" color="#ffffff" /> : null}
            <Text className="text-xs font-black uppercase tracking-wider text-white">
              {busy ? busyLabel : submitLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </DialogModal>
  );
}
