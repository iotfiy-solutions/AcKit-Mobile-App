import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { AlertCircle, Clock, Info, X } from '@hugeicons/core-free-icons';
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

function Label({ children }) {
  return (
    <Text className="mb-1 text-sm font-medium text-slate-700">{children}</Text>
  );
}

function to12Parts(time24) {
  if (!time24 || !time24.includes(':')) {
    return { time12: '08:00', ampm: 'AM' };
  }
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10) || 0;
  const ampm = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12 || 12;
  const time12 = `${String(h12).padStart(2, '0')}:${mStr || '00'}`;
  return { time12, ampm };
}

function to24String(time12, ampm) {
  if (!time12 || !time12.includes(':')) return '08:00';
  let [hStr, mStr] = time12.split(':');
  let h = parseInt(hStr, 10);
  if (isNaN(h)) h = 8;
  let m = parseInt(mStr, 10);
  if (isNaN(m)) m = 0;
  if (h > 12) h = 12;
  if (h < 1) h = 1;
  if (m > 59) m = 59;
  if (m < 0) m = 0;

  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function format12TimeInput(text) {
  const digits = text.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function AmPmTimePicker({ label, value24, onChange24 }) {
  const initial = to12Parts(value24);
  const [digits, setDigits] = useState(initial.time12);
  const [ampm, setAmPm] = useState(initial.ampm);

  useEffect(() => {
    const p = to12Parts(value24);
    setDigits(p.time12);
    setAmPm(p.ampm);
  }, [value24]);

  const handleTextChange = (text) => {
    const formatted = format12TimeInput(text);
    setDigits(formatted);
    if (formatted.length === 5) {
      onChange24(to24String(formatted, ampm));
    }
  };

  const handleAmPmChange = (nextAmPm) => {
    setAmPm(nextAmPm);
    onChange24(to24String(digits.length === 5 ? digits : '08:00', nextAmPm));
  };

  return (
    <View style={{ flex: 1 }}>
      <Label>{label}</Label>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <TextInput
          value={digits}
          onChangeText={handleTextChange}
          placeholder="08:00"
          placeholderTextColor="#94a3b8"
          keyboardType="number-pad"
          maxLength={5}
          style={{
            flex: 1,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            backgroundColor: '#ffffff',
            padding: 8,
            textAlign: 'center',
            fontSize: 14,
            fontWeight: '700',
            color: '#1e293b',
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            backgroundColor: '#f1f5f9',
            padding: 2,
          }}
        >
          <Pressable
            onPress={() => handleAmPmChange('AM')}
            style={{
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 6,
              backgroundColor: ampm === 'AM' ? '#2563eb' : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '900',
                textTransform: 'uppercase',
                color: ampm === 'AM' ? '#ffffff' : '#64748b',
              }}
            >
              AM
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleAmPmChange('PM')}
            style={{
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 6,
              backgroundColor: ampm === 'PM' ? '#2563eb' : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '900',
                textTransform: 'uppercase',
                color: ampm === 'PM' ? '#ffffff' : '#64748b',
              }}
            >
              PM
            </Text>
          </Pressable>
        </View>
      </View>
      <Text
        style={{
          marginTop: 4,
          textAlign: 'center',
          fontSize: 10,
          fontWeight: '700',
          color: '#2563eb',
        }}
      >
        {digits.length === 5 ? `${digits} ${ampm}` : 'Enter HH:MM'}
      </Text>
    </View>
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
  const [errorMsg, setErrorMsg] = useState(null);
  const [conflictData, setConflictData] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setConflictData(null);
      setSubmitting(false);
      return;
    }
    setName('');
    setStartTime('08:00');
    setEndTime('18:00');
    setAction('ON');
    setTemp(22);
    setDays([]);
    setRemote('unlock');
    setErrorMsg(null);
    setConflictData(null);
    setSubmitting(false);
  }, [isOpen]);

  const clearError = () => {
    if (errorMsg) setErrorMsg(null);
    if (conflictData) setConflictData(null);
  };

  const handleNameChange = (val) => {
    clearError();
    setName(val);
  };

  const handleStartTimeChange = (val) => {
    clearError();
    setStartTime(val);
  };

  const handleEndTimeChange = (val) => {
    clearError();
    setEndTime(val);
  };

  const toggleDay = (day) => {
    clearError();
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const canSubmit =
    name.trim() &&
    TIME_RE.test(startTime) &&
    TIME_RE.test(endTime) &&
    hasTargets;

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setErrorMsg(null);
    setConflictData(null);
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        startTime,
        endTime,
        action,
        temp,
        days,
        remote: action === 'OFF' ? 'lock' : remote,
      });
    } catch (err) {
      const respData = err?.response?.data;
      const msg =
        respData?.message ||
        err?.message ||
        'Failed to create event. Please check inputs and try again.';
      setErrorMsg(msg);
      if (respData?.conflict) {
        setConflictData(respData.conflict);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
    >
      <View className="gap-4">
        {/* CONFLICT / ERROR CARD */}
        {errorMsg ? (
          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#fecdd3',
              backgroundColor: '#fff1f2',
              padding: 14,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View
                style={{
                  marginTop: 2,
                  borderRadius: 9999,
                  backgroundColor: '#ffe4e6',
                  padding: 6,
                }}
              >
                <HugeiconsIcon icon={AlertCircle} size={18} color="#e11d48" strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '900',
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                      color: '#9f1239',
                    }}
                  >
                    {conflictData ? 'Scheduling Conflict' : 'Unable to Save Event'}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setErrorMsg(null);
                      setConflictData(null);
                    }}
                    hitSlop={8}
                    style={{ borderRadius: 6, padding: 2 }}
                  >
                    <HugeiconsIcon icon={X} size={14} color="#f43f5e" strokeWidth={2.5} />
                  </Pressable>
                </View>

                <Text
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    fontWeight: '600',
                    lineHeight: 18,
                    color: '#9f1239',
                  }}
                >
                  {errorMsg}
                </Text>

                {conflictData ? (
                  <View
                    style={{
                      marginTop: 8,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: '#fecdd3',
                      backgroundColor: '#ffffff',
                      padding: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: '900',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        color: '#be123c',
                        marginBottom: 6,
                      }}
                    >
                      Conflicting Schedule Details:
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {conflictData.name ? (
                        <View
                          style={{
                            borderRadius: 6,
                            backgroundColor: '#fff1f2',
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderWidth: 1,
                            borderColor: '#ffe4e6',
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#881337' }}>
                            Name: {conflictData.name}
                          </Text>
                        </View>
                      ) : null}
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          borderRadius: 6,
                          backgroundColor: '#fff1f2',
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderWidth: 1,
                          borderColor: '#ffe4e6',
                        }}
                      >
                        <HugeiconsIcon icon={Clock} size={11} color="#e11d48" />
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#881337' }}>
                          {conflictData.localStartTime || conflictData.startTime || '08:00'} -{' '}
                          {conflictData.localEndTime || conflictData.endTime || '18:00'}
                        </Text>
                      </View>
                      {conflictData.days && conflictData.days.length > 0 ? (
                        <View
                          style={{
                            borderRadius: 6,
                            backgroundColor: '#fff1f2',
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderWidth: 1,
                            borderColor: '#ffe4e6',
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#881337' }}>
                            Days: {conflictData.days.join(', ')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        <View>
          <Label>Event Name</Label>
          <TextInput
            value={name}
            onChangeText={handleNameChange}
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
          <AmPmTimePicker
            label="Start Time"
            value24={startTime}
            onChange24={handleStartTimeChange}
          />
          <AmPmTimePicker
            label="End Time"
            value24={endTime}
            onChange24={handleEndTimeChange}
          />
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
            disabled={submitting}
            className="rounded-lg px-4 py-2 active:bg-slate-100"
          >
            <Text className="text-sm font-medium text-slate-600">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={submit}
            disabled={!canSubmit || submitting}
            className={`flex-row items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 ${
              canSubmit && !submitting ? 'active:bg-blue-700' : 'opacity-50'
            }`}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : null}
            <Text className="text-sm font-medium text-white">
              {submitting ? 'Saving Event...' : 'Add Event'}
            </Text>
          </Pressable>
        </View>
      </View>
    </AppModal>
  );
}
