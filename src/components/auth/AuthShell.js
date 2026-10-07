import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  AlertCircleIcon,
  ArrowRight01Icon,
  EyeIcon,
  Tick02Icon,
  ViewOffIcon,
} from '@hugeicons/core-free-icons';
import { SnowBackground } from '../ui/SnowBackground';

const logo = require('../../../assets/splash-icon.png');

/**
 * Auth pages: soft snow behind a frosted card. KeyboardAwareScrollView keeps
 * the focused input above the keyboard (works with edge-to-edge Android, where
 * RN's built-in KeyboardAvoidingView with `undefined` behavior does nothing).
 */
export function AuthShell({ children, badge }) {
  return (
    <View className="flex-1 bg-slate-50">
      <SnowBackground />
      <SafeAreaView className="flex-1">
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          bottomOffset={24}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            className="w-full max-w-md rounded-[2rem] px-6 pb-7 pt-6"
            style={{
              backgroundColor: 'rgba(255,255,255,0.66)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.9)',
            }}
          >
            <View className="mb-4 items-center justify-center">
              <Image
                source={logo}
                style={{ width: 112, height: 112 }}
                resizeMode="contain"
                accessibilityLabel="Ackit"
              />
              {badge ? (
                <View className="mt-1 rounded-full bg-indigo-50 px-3 py-1">
                  <Text className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
                    {badge}
                  </Text>
                </View>
              ) : null}
            </View>
            {children}
          </View>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
}

export function AuthTitle({ title, subtitle }) {
  return (
    <View className="mb-6 items-center">
      <Text className="text-2xl font-black tracking-tight text-slate-900">{title}</Text>
      {subtitle ? (
        <Text className="mt-1.5 max-w-[260px] text-center text-[13px] font-semibold leading-relaxed text-slate-500">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function AuthAlert({ type = 'error', message }) {
  if (!message) return null;
  const isError = type === 'error';
  return (
    <View
      className={`mb-4 flex-row items-center gap-2.5 rounded-2xl border p-3 ${
        isError
          ? 'border-red-100 bg-red-50'
          : 'border-emerald-100 bg-emerald-50'
      }`}
    >
      <HugeiconsIcon
        icon={isError ? AlertCircleIcon : Tick02Icon}
        size={16}
        color={isError ? '#dc2626' : '#047857'}
      />
      <Text
        className={`flex-1 text-xs font-semibold ${
          isError ? 'text-red-600' : 'text-emerald-700'
        }`}
      >
        {message}
      </Text>
    </View>
  );
}

export function FieldLabel({ children, right }) {
  return (
    <View className="mb-1.5 flex-row items-center justify-between px-1">
      <Text className="text-[10px] font-black uppercase tracking-wider text-slate-500">
        {children}
      </Text>
      {right}
    </View>
  );
}

/**
 * Input with a leading icon, focus highlight and optional show/hide toggle.
 * `centered` = big centered OTP style (no icon).
 */
export function AuthInput({
  icon,
  secure = false,
  centered = false,
  className = '',
  ...props
}) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <View
      className={`flex-row items-center rounded-2xl border ${
        focused ? 'border-indigo-500 bg-white' : 'border-slate-200/70 bg-white/80'
      } ${className}`}
    >
      {icon && !centered ? (
        <View className="pl-4">
          <HugeiconsIcon icon={icon} size={17} color={focused ? '#4f46e5' : '#94a3b8'} />
        </View>
      ) : null}
      <TextInput
        {...props}
        secureTextEntry={secure && !visible}
        placeholderTextColor="#94a3b8"
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        className={`min-w-0 flex-1 py-3.5 text-sm font-semibold text-slate-800 ${
          centered
            ? 'px-4 text-center text-xl font-black tracking-[0.45em]'
            : 'px-3'
        }`}
      />
      {secure ? (
        <Pressable
          onPress={() => setVisible((v) => !v)}
          hitSlop={8}
          className="pr-4"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        >
          <HugeiconsIcon icon={visible ? ViewOffIcon : EyeIcon} size={17} color="#94a3b8" />
        </Pressable>
      ) : null}
    </View>
  );
}

export function AuthButton({ label, loadingLabel, loading = false, onPress, className = '' }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      className={`flex-row items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 active:scale-[0.98] active:bg-indigo-700 ${
        loading ? 'opacity-70' : ''
      } ${className}`}
      style={{
        shadowColor: '#4f46e5',
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      }}
    >
      {loading ? <ActivityIndicator size="small" color="#fff" /> : null}
      <Text className="text-xs font-black uppercase tracking-wider text-white">
        {loading ? loadingLabel : label}
      </Text>
      {!loading ? <HugeiconsIcon icon={ArrowRight01Icon} size={15} color="#fff" /> : null}
    </Pressable>
  );
}
