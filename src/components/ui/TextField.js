import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Eye, EyeOff } from '@hugeicons/core-free-icons';

/**
 * Form field matching the web inputs: 10px uppercase label + rounded-2xl input.
 * - readOnly: greyed, not editable (used to show the selected SSID)
 * - secure: password input with show / hide toggle
 */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secure = false,
  readOnly = false,
  autoFocus = false,
  onSubmitEditing,
  icon,
  required = false,
  className = '',
  keyboardType = 'default',
  autoCapitalize = 'none',
}) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <View className={`w-full ${className}`}>
      {label ? (
        <Text className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
          {label}
          {required ? <Text className="text-red-500"> *</Text> : null}
        </Text>
      ) : null}
      <View
        className={`flex-row items-center rounded-2xl border pl-4 pr-3 ${
          readOnly
            ? 'border-slate-200/50 bg-slate-100'
            : focused
              ? 'border-blue-500 bg-white'
              : 'border-slate-200/50 bg-slate-50/50'
        }`}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          editable={!readOnly}
          secureTextEntry={secure && !visible}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          autoFocus={autoFocus}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          className={`min-w-0 flex-1 py-3 text-xs font-bold ${
            readOnly ? 'text-slate-500' : 'text-slate-800'
          }`}
        />
        {icon && !secure ? (
          <View className="pl-2">
            <HugeiconsIcon icon={icon} size={16} color="#94a3b8" />
          </View>
        ) : null}
        {secure ? (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={8}
            className="pl-2"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          >
            <HugeiconsIcon
              icon={visible ? EyeOff : Eye}
              size={16}
              color="#94a3b8"
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
