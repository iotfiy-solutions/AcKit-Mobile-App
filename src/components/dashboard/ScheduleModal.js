import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Info } from '@hugeicons/core-free-icons';
import { AppModal } from '../ui/AppModal';
import { Select } from '../ui/Select';
import { RangeSlider } from '../ui/RangeSlider';

const DAYS = [
  { value: 'Mon', label: 'Monday' },
  { value: 'Tue', label: 'Tuesday' },
  { value: 'Wed', label: 'Wednesday' },
  { value: 'Thu', label: 'Thursday' },
  { value: 'Fri', label: 'Friday' },
  { value: 'Sat', label: 'Saturday' },
  { value: 'Sun', label: 'Sunday' },
];

const REMOTE_OPTIONS = [
  { value: 'unlock', label: 'Unlock' },
  { value: 'lock', label: 'Lock' },
];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function formatTimeInput(text) {
  const digits = text.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function Label({ children }) {
  return (
    <Text className="mb-1 text-sm font-medium text-slate-700">{children}</Text>
  );
}

function TimeField({ value, onChange }) {
  return (
    <TextInput
      value={value}
      onChangeText={(t) => onChange(formatTimeInput(t))}
      placeholder="HH:MM"
      placeholderTextColor="#94a3b8"
      keyboardType="number-pad"
      maxLength={5}
      className="w-full rounded-lg border border-slate-200 p-2 text-slate-900"
    />
  );
}

/**
 * Add-event form — same fields as the web schedule Modal in Dashboard.tsx.
 * (Time is typed as 24h HH:MM — no time-picker package is installed yet.)
 */
export function ScheduleModal({
  isOpen,
  onClose,
  title,
  subtitle,
  hasTargets,
  onSubmit,
}) {
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');
  const [action, setAction] = useState('ON');
  const [temp, setTemp] = useState(22);
  const [days, setDays] = useState([]);
  const [remote, setRemote] = useState('unlock');

  useEffect(() => {
    if (isOpen) return;
    setName('');
    setStartTime('08:00');
    setEndTime('18:00');
    setAction('ON');
    setTemp(22);
    setDays([]);
    setRemote('unlock');
  }, [isOpen]);

  const toggleDay = (day) =>
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );

  const canSubmit =
    name.trim() &&
    TIME_RE.test(startTime) &&
    TIME_RE.test(endTime) &&
    hasTargets;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      startTime,
      endTime,
      action,
      temp,
      days,
      remote: action === 'OFF' ? 'lock' : remote,
    });
  };

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
    >
      <View className="gap-4">
        <View>
          <Label>Event Name</Label>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g., Morning Start"
            placeholderTextColor="#94a3b8"
            className="w-full rounded-lg border border-slate-200 p-2 text-slate-900"
          />
        </View>

        <View>
          <Label>Event Type</Label>
          <View className="flex-row rounded-lg bg-slate-100 p-1">
            {[
              { v: 'ON', label: 'On', activeText: 'text-emerald-700' },
              { v: 'OFF', label: 'Off', activeText: 'text-slate-900' },
            ].map((opt) => (
              <Pressable
                key={opt.v}
                onPress={() => {
                  setAction(opt.v);
                  if (opt.v === 'OFF') setRemote('lock');
                }}
                className={`flex-1 items-center rounded-md py-1.5 ${
                  action === opt.v ? 'bg-white' : ''
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    action === opt.v ? opt.activeText : 'text-slate-500'
                  }`}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {action === 'ON' ? (
          <View>
            <Label>Target Temperature (°C)</Label>
            <View className="flex-row items-center gap-4">
              <RangeSlider min={16} max={30} value={temp} onChange={setTemp} />
              <Text className="w-10 text-sm font-bold text-slate-800">
                {temp}°
              </Text>
            </View>
          </View>
        ) : null}

        <View className="flex-row gap-4">
          <View className="flex-1">
            <Label>Start Time</Label>
            <TimeField value={startTime} onChange={setStartTime} />
          </View>
          <View className="flex-1">
            <Label>End Time</Label>
            <TimeField value={endTime} onChange={setEndTime} />
          </View>
        </View>

        <View>
          <Text className="mb-2 text-sm font-medium text-slate-700">
            Days{' '}
            <Text className="font-normal text-slate-400">
              (optional — empty = one-time)
            </Text>
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {DAYS.map((day) => {
              const on = days.includes(day.value);
              return (
                <Pressable
                  key={day.value}
                  onPress={() => toggleDay(day.value)}
                  className={`rounded-lg border px-2.5 py-1.5 ${
                    on
                      ? 'border-blue-200 bg-blue-100'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      on ? 'text-blue-700' : 'text-slate-600'
                    }`}
                  >
                    {day.value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {days.length === 0 ? (
            <Text className="mt-1.5 text-[10px] font-medium text-slate-400">
              One-time: runs once at the next start/end, then is deleted.
            </Text>
          ) : null}
        </View>

        {action === 'ON' ? (
          <View>
            <Label>Remote Lock</Label>
            <Select
              value={remote}
              onChange={setRemote}
              options={REMOTE_OPTIONS}
              placement="up"
            />
          </View>
        ) : (
          <View className="flex-row items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50 p-3">
            <View className="mt-0.5">
              <HugeiconsIcon icon={Info} size={16} color="#d97706" />
            </View>
            <Text className="flex-1 text-xs leading-relaxed text-amber-800">
              Off events always use{' '}
              <Text className="font-bold">remote lock</Text>. No one can change
              the AC with the physical remote while this event is active.
            </Text>
          </View>
        )}

        <View className="mt-2 flex-row justify-end gap-2 border-t border-slate-100 pt-4">
          <Pressable
            onPress={onClose}
            className="rounded-lg px-4 py-2 active:bg-slate-100"
          >
            <Text className="text-sm font-medium text-slate-600">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            className={`rounded-lg bg-blue-600 px-4 py-2 ${
              canSubmit ? '' : 'opacity-50'
            }`}
          >
            <Text className="text-sm font-medium text-white">Add Event</Text>
          </Pressable>
        </View>
      </View>
    </AppModal>
  );
}
