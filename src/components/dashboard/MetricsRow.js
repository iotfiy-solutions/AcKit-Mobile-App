import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Defs,
  G,
  LinearGradient,
  Mask,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  AlertCircle,
  ChevronRight,
  Lock,
  Smartphone,
  Unlock,
  Zap,
} from '@hugeicons/core-free-icons';
import { buildEnergyWave } from '../../utils/dashboardHelpers';

/** Card 1 — Energy (tap opens Reports) */
function EnergyCard({ framePowerKw, totalUnitsCount, onPress }) {
  const [cardSize, setCardSize] = useState({ w: 0, h: 0 });
  const [sparkSize, setSparkSize] = useState({ w: 0, h: 0 });
  const wave = useMemo(
    () => buildEnergyWave(framePowerKw, totalUnitsCount),
    [framePowerKw, totalUnitsCount]
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Open energy reports"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width !== cardSize.w || height !== cardSize.h) {
          setCardSize({ w: width, h: height });
        }
      }}
      className="relative flex-1 overflow-hidden rounded-2xl p-2 active:scale-[0.98]"
      style={{
        // Fallback until onLayout paints the gradient Svg
        backgroundColor: '#149a78',
        shadowColor: '#047857',
        shadowOpacity: 0.25,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
      }}
    >
      {/*
        RN Svg ignores % width/height when absolute — paint with measured pixels
        (web: linear-gradient(135deg,#2ec4a0 0%,#149a78 48%,#0b6b52 100%))
      */}
      {cardSize.w > 0 && cardSize.h > 0 ? (
        <Svg
          pointerEvents="none"
          width={cardSize.w}
          height={cardSize.h}
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <LinearGradient id="energyBg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#2ec4a0" />
              <Stop offset="0.48" stopColor="#149a78" />
              <Stop offset="1" stopColor="#0b6b52" />
            </LinearGradient>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={cardSize.w}
            height={cardSize.h}
            fill="url(#energyBg)"
          />
        </Svg>
      ) : null}

      <View className="z-[1] flex-row items-start justify-between">
        <View className="h-6 w-6 items-center justify-center rounded-full bg-[#7ee0c4]/55">
          <HugeiconsIcon icon={Zap} size={12} color="#ffffff" />
        </View>
        <HugeiconsIcon icon={ChevronRight} size={14} color="#ffffffe6" />
      </View>

      <View className="z-[1] mt-1.5 items-start">
        <Text className="text-[8px] font-black uppercase leading-none tracking-[0.12em] text-white">
          Energy
        </Text>
        <View className="mt-1 flex-row items-baseline gap-0.5">
          <Text className="text-[15px] font-black leading-none tracking-tight text-white">
            {framePowerKw.toFixed(2)}
          </Text>
          <Text className="text-[8px] font-medium leading-none text-white/90">
            kW
          </Text>
        </View>
      </View>

      <View
        pointerEvents="none"
        className="absolute bottom-0 left-0 right-0"
        style={{ height: '42%' }}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width !== sparkSize.w || height !== sparkSize.h) {
            setSparkSize({ w: width, h: height });
          }
        }}
      >
        {sparkSize.w > 0 && sparkSize.h > 0 ? (
          <Svg
            width={sparkSize.w}
            height={sparkSize.h}
            viewBox="0 0 120 40"
            preserveAspectRatio="none"
          >
            <Defs>
              <LinearGradient id="energySparkFade" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="white" stopOpacity="0" />
                <Stop offset="0.16" stopColor="white" stopOpacity="1" />
              </LinearGradient>
              <Mask id="energySparkMask" x="0" y="0" width="120" height="40">
                <Rect width="120" height="40" fill="url(#energySparkFade)" />
              </Mask>
            </Defs>
            <G mask="url(#energySparkMask)">
              <Path d={wave.area} fill="rgba(255,255,255,0.22)" />
              <Path
                d={wave.line}
                fill="none"
                stroke="white"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </G>
          </Svg>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Card 2 — Devices & Faults */
function DevicesCard({
  totalUnitsCount,
  faultUnitsCount,
  onOpenDevices,
  onOpenMaintenance,
}) {
  return (
    <View
      className="flex-1 justify-between rounded-2xl border border-slate-100 bg-white p-2"
      style={{
        shadowColor: '#0f172a',
        shadowOpacity: 0.06,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      <Pressable
        onPress={onOpenDevices}
        accessibilityLabel="Open organization and device list"
        className="min-w-0 rounded-xl px-0.5 py-0.5 active:bg-slate-50"
      >
        <View className="flex-row items-center gap-1">
          <HugeiconsIcon icon={Smartphone} size={12} color="#0f766e" />
          <Text className="text-sm font-black leading-none text-emerald-600">
            {totalUnitsCount}
          </Text>
          <View className="ml-auto">
            <HugeiconsIcon
              icon={ChevronRight}
              size={12}
              color="#cbd5e1"
              strokeWidth={2.5}
            />
          </View>
        </View>
        <Text className="mt-0.5 text-[7px] font-bold uppercase leading-tight tracking-wide text-slate-500">
          No. of devices
        </Text>
      </Pressable>

      <View className="my-1 h-px bg-slate-100" />

      <Pressable
        onPress={onOpenMaintenance}
        accessibilityLabel="Open need maintenance list"
        className="min-w-0 rounded-xl px-0.5 py-0.5 active:bg-red-50/70"
      >
        <View className="flex-row items-center gap-1">
          <HugeiconsIcon icon={AlertCircle} size={12} color="#ef4444" />
          <Text className="text-sm font-black leading-none text-red-600">
            {faultUnitsCount}
          </Text>
          <View className="ml-auto">
            <HugeiconsIcon
              icon={ChevronRight}
              size={12}
              color="#cbd5e1"
              strokeWidth={2.5}
            />
          </View>
        </View>
        <Text className="mt-0.5 text-[7px] font-bold uppercase leading-tight tracking-wide text-slate-500">
          Fault devices
        </Text>
      </Pressable>
    </View>
  );
}

const LOCK_OPTIONS = [
  {
    key: 'Super Locked',
    label: 'Super',
    iconColor: '#dc2626',
    selectedBg: 'bg-red-50',
    unlockIcon: false,
  },
  {
    key: 'Locked',
    label: 'Lock',
    iconColor: '#059669',
    selectedBg: 'bg-emerald-50',
    unlockIcon: false,
  },
  {
    key: 'Unlocked',
    label: 'Unlock',
    iconColor: '#64748b',
    selectedBg: 'bg-slate-100',
    unlockIcon: true,
  },
];

/** Card 3 — Lock State (Super | Lock | Unlock strip) */
function LockCard({ lockState, onPick, pending }) {
  return (
    <View
      className={`flex-1 gap-2 overflow-hidden rounded-2xl bg-[#2563eb] px-2 pb-1.5 pt-2 ${
        pending ? 'opacity-70' : ''
      }`}
      style={{
        shadowColor: '#2563eb',
        shadowOpacity: 0.25,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
      }}
      pointerEvents={pending ? 'none' : 'auto'}
    >
      <View className="min-w-0 flex-row items-center gap-1">
        <HugeiconsIcon icon={Lock} size={12} color="#ffffff" strokeWidth={2.25} />
        <Text
          numberOfLines={1}
          className="min-w-0 flex-1 text-[8px] font-black uppercase leading-none tracking-wider text-white"
        >
          Lock State
        </Text>
      </View>

      <View className="w-full items-center justify-center rounded-lg bg-white/25 px-2 py-2">
        <Text
          numberOfLines={1}
          className="text-[10px] font-black leading-none tracking-tight text-white"
        >
          {lockState}
        </Text>
      </View>

      <View className="w-full flex-row rounded-xl bg-white p-0.5">
        {LOCK_OPTIONS.map((opt) => {
          const selected = lockState === opt.key;
          const color = selected ? opt.iconColor : '#94a3b8';
          return (
            <Pressable
              key={opt.key}
              disabled={pending}
              onPress={() => onPick(opt.key)}
              className={`flex-1 items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 active:scale-95 ${
                selected ? opt.selectedBg : 'bg-transparent'
              }`}
            >
              <HugeiconsIcon
                icon={opt.unlockIcon ? Unlock : Lock}
                size={12}
                color={color}
                strokeWidth={2.25}
              />
              <Text
                className="text-[6px] font-bold leading-none tracking-tight"
                style={{ color }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Metrics row — Energy / Devices / Lock (grid-cols-3 gap-2) */
export function MetricsRow({
  framePowerKw,
  totalUnitsCount,
  faultUnitsCount,
  lockState,
  lockPending = false,
  onOpenReports,
  onOpenDevices,
  onOpenMaintenance,
  onLockPick,
}) {
  return (
    <View className="flex-row items-stretch gap-2">
      <EnergyCard
        framePowerKw={framePowerKw}
        totalUnitsCount={totalUnitsCount}
        onPress={onOpenReports}
      />
      <DevicesCard
        totalUnitsCount={totalUnitsCount}
        faultUnitsCount={faultUnitsCount}
        onOpenDevices={onOpenDevices}
        onOpenMaintenance={onOpenMaintenance}
      />
      <LockCard
        lockState={lockState}
        onPick={onLockPick}
        pending={lockPending}
      />
    </View>
  );
}
