import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { X } from '@hugeicons/core-free-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Mirrors web Modal (components/ui/Modal.tsx) — mobile = bottom sheet:
 * rounded-t-[1.75rem], drag hint, title/subtitle header + X, scrollable body.
 */
export function AppModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  banner = null,
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={Boolean(isOpen)}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior="padding"
      >
        <View className="flex-1 justify-end bg-slate-900/50">
          <Pressable className="absolute inset-0" onPress={onClose} />
          <View
            className="max-h-[92%] rounded-t-[1.75rem] border border-slate-100 bg-white shadow-xl"
            style={{ paddingBottom: insets.bottom }}
          >
            <View className="items-center pb-1 pt-2.5">
              <View className="h-1 w-10 rounded-full bg-slate-200" />
            </View>

            <View className="flex-row items-start justify-between gap-3 border-b border-slate-100 px-5 pb-4 pt-2">
              <View className="min-w-0 flex-1">
                <Text className="text-base font-black tracking-tight text-slate-900">
                  {title}
                </Text>
                {subtitle ? (
                  <Text className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-400">
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={onClose}
                className="rounded-xl bg-slate-100 p-2 active:scale-95"
                accessibilityLabel="Close"
              >
                <HugeiconsIcon icon={X} size={16} color="#64748b" />
              </Pressable>
            </View>

            <ScrollView
              contentContainerClassName="px-5 py-4"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </View>
          {/* Toast banner (a RN Modal is its own window, so page toasts can't show over it) */}
          {banner ? (
            <View
              pointerEvents="none"
              className="absolute left-4 right-4"
              style={{ top: insets.top + 8 }}
            >
              {banner}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
