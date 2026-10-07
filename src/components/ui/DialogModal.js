import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { X } from '@hugeicons/core-free-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Centered dialog with keyboard-safe body (KeyboardAwareScrollView).
 * Avoids edit/delete form inputs being hidden behind the soft keyboard.
 */
export function DialogModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  banner = null,
}) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: 170,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [isOpen, progress]);

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View
          className="flex-1 items-center justify-center px-5"
          style={{
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 12,
          }}
        >
          <Animated.View
            pointerEvents="none"
            className="absolute inset-0 bg-slate-900/50"
            style={{ opacity: progress }}
          />
          <Pressable className="absolute inset-0" onPress={onClose} />

          <Animated.View
            className="max-h-full w-full max-w-[420px] rounded-3xl bg-white p-5 shadow-xl"
            style={{ opacity: progress, transform: [{ translateY }, { scale }] }}
          >
            <View className="mb-4 flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text className="text-base font-black tracking-tight text-slate-900">
                  {title}
                </Text>
                {subtitle ? (
                  <Text className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                className="rounded-xl bg-slate-100 p-2 active:scale-95"
                accessibilityLabel="Close"
              >
                <HugeiconsIcon icon={X} size={16} color="#64748b" />
              </Pressable>
            </View>

            <KeyboardAwareScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
              bottomOffset={24}
            >
              {children}
            </KeyboardAwareScrollView>
          </Animated.View>

          {banner ? (
            <View
              pointerEvents="none"
              className="absolute left-4 right-4"
              style={{ top: insets.top + 8, elevation: 30, zIndex: 30 }}
            >
              {banner}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
