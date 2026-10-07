import React, { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Check, ChevronDown } from '@hugeicons/core-free-icons';

/**
 * Multi-select dropdown — mobile port of web MultiSelectDropdown.
 * Same floating panel pattern as Select; tap toggles checkmarks.
 *
 * values: string[]
 * onChange: (values: string[]) => void
 * options: [{ value, label, disabled? }]
 */
export function MultiSelect({
  values = [],
  onChange,
  options = [],
  placeholder = 'Select…',
  icon,
  disabled = false,
  visibleCount = 4,
  className = '',
}) {
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const { height: winH } = useWindowDimensions();

  const selectedLabels = options
    .filter((o) => values.includes(o.value))
    .map((o) => o.label);

  const displayLabel =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length === 1
        ? selectedLabels[0]
        : `${selectedLabels.length} selected`;

  const openPanel = () => {
    if (disabled) return;
    triggerRef.current?.measureInWindow((x, y, width, h) => {
      const estimatedMax = Math.min(visibleCount * 44, winH * 0.4);
      const spaceBelow = winH - (y + h);
      const openUp = spaceBelow < estimatedMax + 12 && y > spaceBelow;
      setRect({
        left: x,
        width,
        top: openUp ? undefined : y + h + 8,
        bottom: openUp ? winH - y + 8 : undefined,
      });
      setOpen(true);
    });
  };

  const toggleValue = (option) => {
    if (option.disabled) return;
    if (values.includes(option.value)) {
      onChange(values.filter((v) => v !== option.value));
    } else {
      onChange([...values, option.value]);
    }
  };

  return (
    <View className={`w-full min-w-0 ${className}`}>
      <Pressable
        ref={triggerRef}
        collapsable={false}
        onPress={openPanel}
        disabled={disabled}
        className={`w-full min-w-0 flex-row items-center gap-2 rounded-2xl border py-3 pl-4 pr-3 ${
          open
            ? 'border-blue-500 bg-white'
            : 'border-slate-200/50 bg-slate-50/50'
        } ${disabled ? 'opacity-50' : ''}`}
      >
        <Text
          numberOfLines={1}
          className={`min-w-0 flex-1 text-left text-xs font-bold ${
            selectedLabels.length > 0 ? 'text-slate-800' : 'text-slate-400'
          }`}
        >
          {displayLabel}
        </Text>
        <View className="flex-row items-center gap-1.5">
          {icon ? (
            <HugeiconsIcon icon={icon} size={16} color="#94a3b8" />
          ) : null}
          <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
            <HugeiconsIcon
              icon={ChevronDown}
              size={16}
              color={open ? '#3b82f6' : '#94a3b8'}
            />
          </View>
        </View>
      </Pressable>

      <Modal
        visible={open && !!rect}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable className="flex-1" onPress={() => setOpen(false)}>
          {rect ? (
            <Pressable
              onPress={() => {}}
              className="absolute rounded-2xl border border-slate-100 bg-white py-1.5 shadow-xl"
              style={{
                left: rect.left,
                width: Math.max(rect.width, 140),
                top: rect.top,
                bottom: rect.bottom,
                maxHeight: Math.min(visibleCount * 44 + 12, winH * 0.4),
                elevation: 8,
              }}
            >
              <ScrollView
                bounces={false}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {options.length === 0 ? (
                  <Text className="px-4 py-2.5 text-xs font-semibold italic text-slate-400">
                    No options available
                  </Text>
                ) : (
                  options.map((option) => {
                    const isChecked = values.includes(option.value);
                    return (
                      <Pressable
                        key={String(option.value)}
                        disabled={option.disabled}
                        onPress={() => toggleValue(option)}
                        className={`min-w-0 flex-row items-center justify-between gap-2 px-4 py-2.5 ${
                          isChecked ? 'bg-blue-50/50' : 'active:bg-slate-100'
                        }`}
                      >
                        <Text
                          numberOfLines={1}
                          className={`min-w-0 flex-1 text-xs font-bold ${
                            option.disabled
                              ? 'text-slate-300'
                              : isChecked
                                ? 'text-blue-600'
                                : 'text-slate-700'
                          }`}
                        >
                          {option.label}
                        </Text>
                        {isChecked && !option.disabled ? (
                          <HugeiconsIcon
                            icon={Check}
                            size={16}
                            color="#2563eb"
                          />
                        ) : null}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}
