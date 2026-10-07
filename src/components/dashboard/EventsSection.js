import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Calendar, Clock, Plus } from '@hugeicons/core-free-icons';
import {
  calculateDefaultEndTime,
  formatDays,
  formatTimeAMPM,
} from '../../utils/dashboardHelpers';

const CARD_WIDTH = 168;
const CARD_GAP = 12;

function EventCard({ evt, onToggle }) {
  const startTimeStr = formatTimeAMPM(evt.time);
  const endTimeStr = evt.endTime
    ? formatTimeAMPM(evt.endTime)
    : formatTimeAMPM(calculateDefaultEndTime(evt.time));
  const isOffEvent = evt.action === 'OFF';
  const actionLabel =
    evt.action === 'OFF'
      ? 'OFF'
      : evt.action === 'SET_TEMP'
        ? `${evt.temp}°C`
        : 'ON';

  return (
    <View
      className={`flex-col rounded-2xl border p-2.5 ${
        isOffEvent
          ? 'border-sky-100 bg-sky-50/70'
          : 'border-emerald-100 bg-emerald-50/70'
      }`}
      style={{
        width: CARD_WIDTH,
        // shadowColor: isOffEvent ? '#38bdf8' : '#10b981',
        // shadowOpacity: 0.1,
        // shadowRadius: 5,
        // shadowOffset: { width: 0, height: 2 },
      
      }}
    >
      {/* <View className="flex-row items-center"> */}
      <View className="flex-row items-center">
        <View
          className={`h-7 w-7 items-center justify-center rounded-full ${
            isOffEvent ? 'bg-sky-100/80' : 'bg-emerald-100/80'
          }`}
        >
          <HugeiconsIcon
            icon={Calendar}
            size={14}
            color={isOffEvent ? '#0369a1' : '#059669'}
            strokeWidth={2.25}
          />
        </View>
      </View>

      <Text className="mt-2 text-[11px] font-black leading-tight tracking-tight text-slate-800 ">
        {startTimeStr} — {endTimeStr}
      </Text>

      <View className="mt-1.5 flex-row">
        <View
          className={`rounded-full px-2 py-0.5 ${
            isOffEvent ? 'bg-slate-400' : 'bg-emerald-500'
          }`}
        >
          <Text className="text-[8px] font-black uppercase tracking-wide text-white">
            {actionLabel}
          </Text>
        </View>
      </View>

      <View className="mt-2 flex-row items-center justify-between gap-1">
        <Text
          numberOfLines={1}
          className="min-w-0 flex-1 text-[8px] font-bold uppercase tracking-wider text-slate-400"
        >
          {formatDays(evt.days)}
        </Text>
        <Pressable
          onPress={() => onToggle(evt.id, evt.enabled)}
          className={`flex-row items-center gap-0.5 rounded-full px-1.5 py-0.5 ${
            isOffEvent ? 'bg-sky-100' : 'bg-emerald-100'
          }`}
        >
          <HugeiconsIcon
            icon={Clock}
            size={10}
            color={isOffEvent ? '#0369a1' : '#047857'}
            strokeWidth={2.5}
          />
          <Text
            className={`text-[8px] font-black uppercase tracking-wide ${
              isOffEvent ? 'text-sky-700' : 'text-emerald-700'
            }`}
          >
            {evt.enabled ? 'Enable' : 'Disable'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** EVENTS horizontal scroller (org / venue schedules) */
export function EventsSection({ events, onAdd, onToggle }) {
  return (
    <View className="rounded-[2rem] border border-slate-100 p-2.5">
      <View className="mb-2 flex-row items-center justify-between px-2">
        <Text className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          EVENTS
        </Text>
        <Pressable
          onPress={onAdd}
          accessibilityLabel="Add event"
          className="items-center justify-center rounded-full bg-blue-600 p-2 active:scale-90"
          style={{
            shadowColor: '#3b82f6',
            shadowOpacity: 0.2,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 3,
          }}
        >
          <HugeiconsIcon icon={Plus} size={14} color="#ffffff" />
        </Pressable>
      </View>

      {events.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + CARD_GAP}
          snapToAlignment="start"
          decelerationRate="fast"
          contentContainerStyle={{
            gap: CARD_GAP,
            paddingBottom: 4,
            paddingTop: 2,
            paddingHorizontal: 4,
          }}
        >
          {events.map((evt) => (
            <EventCard key={evt.id} evt={evt} onToggle={onToggle} />
          ))}
        </ScrollView>
      ) : (
        <View className="h-[85px] w-full items-center justify-center rounded-2xl border border-dashed border-slate-200/60 bg-white py-4">
          <HugeiconsIcon icon={Calendar} size={16} color="#cbd5e1" />
          <Text className="mt-1 text-[8px] font-black uppercase tracking-wider text-slate-400">
            No active schedules
          </Text>
        </View>
      )}
    </View>
  );
}
