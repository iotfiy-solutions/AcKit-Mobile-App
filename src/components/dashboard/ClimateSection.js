import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Droplet,
  Fan,
  Minus,
  Plus,
  Power,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  Sun,
  Wind,
} from '@hugeicons/core-free-icons';
import { TEMP_ECO, TEMP_MAX, TEMP_MIN } from '../../utils/dashboardHelpers';

const MODE_OPTIONS = [
  { mode: 'Cool', label: 'Cool', icon: Snowflake },
  { mode: 'Heat', label: 'Heat', icon: Sun },
  { mode: 'Dry', label: 'Dry', icon: Droplet },
  { mode: 'Fan', label: 'Fan Only', icon: Wind },
  { mode: 'Auto', label: 'Auto', icon: Sparkles },
];

const FAN_OPTIONS = ['Low', 'Medium', 'High', 'Ultra', 'Turbo'];

const MODE_ICONS = {
  Cool: Snowflake,
  Heat: Sun,
  Dry: Droplet,
  Fan: Wind,
  Auto: Sparkles,
};

const ARC_PATH = 'M 39.5 169.1 A 92 92 0 1 1 180.5 169.1';
const ARC_LENGTH = 417.5;
const START_ANGLE = 140;
const TOTAL_ANGLE = 260;

/** Same math as web `tempFromMobileArcPoint` (x/y already in 220x220 viewBox units) */
function tempFromArcPoint(x, y) {
  const dx = x - 110;
  const dy = y - 110;
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (deg < 0) deg += 360;

  let progress;
  if (deg >= 140) {
    progress = (deg - 140) / 260;
  } else if (deg <= 40) {
    progress = (deg + 220) / 260;
  } else {
    // Bottom gap outside the arc — snap to nearest end
    progress = deg < 90 ? 1 : 0;
  }
  progress = Math.max(0, Math.min(1, progress));
  return Math.round(TEMP_MIN + progress * (TEMP_MAX - TEMP_MIN));
}

const buttonShadow = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.12,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3,
};

/**
 * Mobile climate card: soft wave background, draggable temperature arc dial,
 * +/- buttons, "Auto Adjust" pill and the ON / OFF segmented switch.
 */
export function ClimateSection({
  targetTempState,
  allUnitsOn,
  powerPending = false,
  currentMode = 'Cool',
  currentFan = 'Medium',
  controlsBlockedReason = '',
  controlsDisabled = false,
  onAdjust,
  onSetTemp,
  onEco,
  onPower,
  onModeChange,
  onFanChange,
}) {
  const tempValue =
    typeof targetTempState === 'number' ? targetTempState : TEMP_ECO;
  const angleDeg =
    START_ANGLE + (TOTAL_ANGLE * (tempValue - TEMP_MIN)) / (TEMP_MAX - TEMP_MIN);
  const angleRad = (angleDeg * Math.PI) / 180;
  const cx = 110 + 92 * Math.cos(angleRad);
  const cy = 110 + 92 * Math.sin(angleRad);
  const handleArrow = allUnitsOn ? '#2563eb' : '#94a3b8';

  const { width: winW, height: winH } = useWindowDimensions();
  const [dialSize, setDialSize] = useState(240);
  const [cardSize, setCardSize] = useState({ w: 0, h: 0 });
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showFanDropdown, setShowFanDropdown] = useState(false);
  const [modeRect, setModeRect] = useState(null);
  const [fanRect, setFanRect] = useState(null);
  const modeTriggerRef = useRef(null);
  const fanTriggerRef = useRef(null);

  const openModeDropdown = () => {
    if (!allUnitsOn || controlsDisabled) return;
    modeTriggerRef.current?.measureInWindow((x, y, width, h) => {
      const estimatedMax = 220;
      const spaceBelow = winH - (y + h);
      const openUp = spaceBelow < estimatedMax && y > spaceBelow;
      const left = Math.max(12, Math.min(x, winW - width - 12));
      setModeRect({
        left,
        width,
        top: openUp ? undefined : y + h + 6,
        bottom: openUp ? winH - y + 6 : undefined,
      });
      setShowModeDropdown(true);
      setShowFanDropdown(false);
    });
  };

  const openFanDropdown = () => {
    if (!allUnitsOn || controlsDisabled) return;
    fanTriggerRef.current?.measureInWindow((x, y, width, h) => {
      const estimatedMax = 220;
      const spaceBelow = winH - (y + h);
      const openUp = spaceBelow < estimatedMax && y > spaceBelow;
      const left = Math.max(12, Math.min(x, winW - width - 12));
      setFanRect({
        left,
        width,
        top: openUp ? undefined : y + h + 6,
        bottom: openUp ? winH - y + 6 : undefined,
      });
      setShowFanDropdown(true);
      setShowModeDropdown(false);
    });
  };
  const live = useRef({});
  live.current = { allUnitsOn, onSetTemp, dialSize };

  const dragging = useRef(false);
  const pan = useRef(null);
  if (!pan.current) {
    const applyPoint = (e) => {
      const { dialSize: size, onSetTemp: setTemp } = live.current;
      const scale = size / 220;
      const next = tempFromArcPoint(
        e.nativeEvent.locationX / scale,
        e.nativeEvent.locationY / scale
      );
      if (next != null) setTemp(next);
    };
    pan.current = PanResponder.create({
      // Only start when the finger is on the arc ring / knob (like the web hit area)
      onStartShouldSetPanResponder: (e) => {
        const { allUnitsOn: on, dialSize: size } = live.current;
        if (!on) return false;
        const scale = size / 220;
        const x = e.nativeEvent.locationX / scale - 110;
        const y = e.nativeEvent.locationY / scale - 110;
        const r = Math.sqrt(x * x + y * y);
        return r >= 70 && r <= 114;
      },
      onMoveShouldSetPanResponder: () => false,
      onPanResponderGrant: (e) => {
        dragging.current = true;
        applyPoint(e);
      },
      onPanResponderMove: (e) => {
        if (dragging.current && live.current.allUnitsOn) applyPoint(e);
      },
      onPanResponderRelease: () => {
        dragging.current = false;
      },
      onPanResponderTerminate: () => {
        dragging.current = false;
      },
      onPanResponderTerminationRequest: () => false,
    });
  }

  return (
    <View
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width !== cardSize.w || height !== cardSize.h) {
          setCardSize({ w: width, h: height });
        }
      }}
      className="relative w-full items-center justify-center gap-3 overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white px-2 py-3"
      style={{
        shadowColor: '#94a3b8',
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      {/* Soft wave background — RN Svg needs measured pixels, not % */}
      {cardSize.w > 0 && cardSize.h > 0 ? (
        <Svg
          pointerEvents="none"
          width={cardSize.w}
          height={cardSize.h}
          viewBox="0 0 360 420"
          preserveAspectRatio="xMidYMid slice"
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <LinearGradient id="tempCardSky" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#ffffff" />
              <Stop offset="100%" stopColor="#ffffff" />
            </LinearGradient>
            <LinearGradient id="tempWaveA" x1="0%" y1="50%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#bae6fd" stopOpacity="0.32" />
              <Stop offset="100%" stopColor="#e0f2fe" stopOpacity="0.1" />
            </LinearGradient>
            <LinearGradient id="tempWaveB" x1="100%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.14" />
              <Stop offset="100%" stopColor="#f0f9ff" stopOpacity="0.04" />
            </LinearGradient>
          </Defs>
          <Rect width="360" height="420" fill="url(#tempCardSky)" />
          <Path
            d="M-20 210 C40 160, 90 270, 160 200 C230 130, 280 240, 380 170 L380 430 L-20 430 Z"
            fill="url(#tempWaveA)"
          />
          <Path
            d="M-20 90 C70 40, 120 150, 200 80 C280 10, 320 120, 380 60 L380 0 L-20 0 Z"
            fill="url(#tempWaveB)"
          />
          <Path
            d="M180 430 C220 320, 280 360, 380 280 L380 430 Z"
            fill="#7dd3fc"
            opacity={0.1}
          />
          <Ellipse
            cx="70"
            cy="180"
            rx="90"
            ry="55"
            fill="#7dd3fc"
            opacity={0.1}
          />
          <Ellipse
            cx="300"
            cy="240"
            rx="80"
            ry="50"
            fill="#bae6fd"
            opacity={0.12}
          />
        </Svg>
      ) : null}

      {/* Blocked reason banner (e.g., "Device is locked." or "Device is offline") */}
      {controlsBlockedReason ? (
        <View className="z-[3] w-full px-2 mb-1">
          <View className="flex-row items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/95 px-3.5 py-2.5 shadow-sm">
            <HugeiconsIcon icon={AlertCircle} size={16} color="#d97706" strokeWidth={2} />
            <Text className="flex-1 text-xs font-bold text-amber-800">
              {controlsBlockedReason}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Dial */}
      <View
        className="z-[1] w-full"
        style={{ maxWidth: 240, aspectRatio: 1 }}
        onLayout={(e) => setDialSize(e.nativeEvent.layout.width)}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 220 220"
          overflow="visible"
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id="mobileArcFill" x1="0%" y1="50%" x2="100%" y2="50%">
              <Stop offset="0%" stopColor="#2563eb" />
              <Stop offset="100%" stopColor="#93c5fd" />
            </LinearGradient>
          </Defs>

          {/* Background track */}
          <Path
            d={ARC_PATH}
            stroke="#e8eef8"
            strokeWidth={11}
            strokeLinecap="round"
            fill="none"
          />
          {/* Active fill arc — blue gradient when ON, gray when OFF */}
          <Path
            d={ARC_PATH}
            stroke={allUnitsOn ? 'url(#mobileArcFill)' : '#94a3b8'}
            strokeWidth={11}
            strokeLinecap="round"
            strokeDasharray={[ARC_LENGTH, ARC_LENGTH]}
            strokeDashoffset={
              ARC_LENGTH -
              (ARC_LENGTH * (tempValue - TEMP_MIN)) / (TEMP_MAX - TEMP_MIN)
            }
            fill="none"
          />

          {/* Knob */}
          <G x={cx} y={cy}>
            <Circle cy={2.6} r={15} fill="#0f172a" opacity={0.06} />
            <Circle cy={1.8} r={14} fill="#0f172a" opacity={0.1} />
            <Circle r={13} fill="#ffffff" stroke="#ffffff" strokeWidth={2.5} />
            <Path d="M -2.5 -3.5 L -6.5 0 L -2.5 3.5 Z" fill={handleArrow} />
            <Path d="M 2.5 -3.5 L 6.5 0 L 2.5 3.5 Z" fill={handleArrow} />
          </G>

          {/* Arc limit labels */}
          <SvgText
            x="39.5"
            y="194"
            fill="#94a3b8"
            fontSize="11"
            fontWeight="500"
            textAnchor="middle"
          >
            16°C
          </SvgText>
          <SvgText
            x="180.5"
            y="194"
            fill="#94a3b8"
            fontSize="11"
            fontWeight="500"
            textAnchor="middle"
          >
            30°C
          </SvgText>
        </Svg>

        {/* Touch layer for dragging along the arc */}
        <View
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          pointerEvents={controlsDisabled ? 'none' : 'auto'}
          {...pan.current.panHandlers}
        />

        {/* Inner content — sits inside the arc */}
        <View
          pointerEvents="box-none"
          className="absolute inset-0 items-center justify-center"
          style={{ marginTop: -8 }}
        >
          <View
            pointerEvents="none"
            className="mb-0.5 flex-row items-center gap-1"
          >
            <HugeiconsIcon
              icon={MODE_ICONS[currentMode] || Snowflake}
              size={14}
              color="#2563eb"
              strokeWidth={2.25}
            />
            <Text className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#60a5fa]">
              {currentMode || 'Cool'}
            </Text>
          </View>

          <View className="my-0.5 flex-row items-center justify-center gap-2.5">
            <Pressable
              disabled={!allUnitsOn || controlsDisabled}
              onPress={() => onAdjust(-1)}
              className={`h-9 w-9 items-center justify-center rounded-full bg-white active:scale-90 ${
                allUnitsOn && !controlsDisabled ? '' : 'opacity-40'
              }`}
              style={buttonShadow}
            >
              <HugeiconsIcon
                icon={Minus}
                size={16}
                color="#2563eb"
                strokeWidth={2.5}
              />
            </Pressable>

            <View
              pointerEvents="none"
              className="min-w-[72px] items-center justify-center"
            >
              <Text
                className={`font-extrabold leading-none tracking-tight text-slate-800 ${
                  targetTempState === 'Mixed' ? 'text-base' : 'text-[34px]'
                }`}
              >
                {targetTempState === 'Mixed' ? 'Mixed' : `${targetTempState}°C`}
              </Text>
              <Text className="mt-0.5 text-[9px] font-medium leading-none text-slate-400">
                Current Temperature
              </Text>
            </View>

            <Pressable
              disabled={!allUnitsOn || controlsDisabled}
              onPress={() => onAdjust(1)}
              className={`h-9 w-9 items-center justify-center rounded-full bg-white active:scale-90 ${
                allUnitsOn && !controlsDisabled ? '' : 'opacity-40'
              }`}
              style={buttonShadow}
            >
              <HugeiconsIcon
                icon={Plus}
                size={16}
                color="#2563eb"
                strokeWidth={2.5}
              />
            </Pressable>
          </View>

          <Pressable
            disabled={controlsDisabled}
            onPress={onEco}
            className={`mt-2.5 flex-row items-center gap-1.5 rounded-full bg-[#e8eefc] px-3.5 py-1.5 active:bg-blue-100 ${
              controlsDisabled ? 'opacity-40' : ''
            }`}
          >
            <HugeiconsIcon
              icon={SlidersHorizontal}
              size={14}
              color="#2563eb"
              strokeWidth={2.25}
            />
            <Text className="text-[11px] font-semibold tracking-wide text-[#2563eb]">
              Auto Adjust
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Mode & Fan selectors — mirrors web Active Control Frame */}
      <View className="z-[2] w-full flex-row gap-2 px-8" style={{ alignSelf: 'center' }}>
        {/* MODE SELECTOR */}
        <View className="flex-1">
          <Text
            className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1"
          >
            Mode
          </Text>
          <Pressable
            ref={modeTriggerRef}
            collapsable={false}
            disabled={!allUnitsOn || controlsDisabled}
            onPress={openModeDropdown}
            className={`flex-row items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-2.5 py-2.5 ${
              allUnitsOn && !controlsDisabled ? 'active:bg-slate-100' : 'opacity-50'
            }`}
          >
            <View className="flex-row items-center gap-1.5 min-w-0 flex-1">
              <HugeiconsIcon
                icon={MODE_ICONS[currentMode] || Snowflake}
                size={14}
                color="#2563eb"
                strokeWidth={2}
              />
              <Text className="text-[10px] font-black uppercase tracking-wider text-slate-800" numberOfLines={1}>
                {currentMode || 'Cool'}
              </Text>
            </View>
            <View style={{ transform: [{ rotate: showModeDropdown ? '180deg' : '0deg' }] }}>
              <HugeiconsIcon
                icon={ChevronDown}
                size={12}
                color={showModeDropdown ? '#2563eb' : '#94a3b8'}
                strokeWidth={2}
              />
            </View>
          </Pressable>
        </View>

        {/* FAN SPEED SELECTOR */}
        <View className="flex-1">
          <Text
            className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1"
          >
            Fan Speed
          </Text>
          <Pressable
            ref={fanTriggerRef}
            collapsable={false}
            disabled={!allUnitsOn || controlsDisabled}
            onPress={openFanDropdown}
            className={`flex-row items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-2.5 py-2.5 ${
              allUnitsOn && !controlsDisabled ? 'active:bg-slate-100' : 'opacity-50'
            }`}
          >
            <View className="flex-row items-center gap-1.5 min-w-0 flex-1">
              <HugeiconsIcon
                icon={Fan}
                size={14}
                color="#2563eb"
                strokeWidth={2}
              />
              <Text className="text-[10px] font-black uppercase tracking-wider text-slate-800" numberOfLines={1}>
                {currentFan || 'Medium'}
              </Text>
            </View>
            <View style={{ transform: [{ rotate: showFanDropdown ? '180deg' : '0deg' }] }}>
              <HugeiconsIcon
                icon={ChevronDown}
                size={12}
                color={showFanDropdown ? '#2563eb' : '#94a3b8'}
                strokeWidth={2}
              />
            </View>
          </Pressable>
        </View>
      </View>

      {/* ON / OFF segmented switch */}
      <View className="z-[1] w-full items-center">
        <View
          className={`h-12 w-full flex-row items-center rounded-full bg-slate-100 p-1 ${
            powerPending || controlsDisabled ? 'opacity-60' : ''
          }`}
          style={{ maxWidth: 240 }}
          pointerEvents={powerPending || controlsDisabled ? 'none' : 'auto'}
        >
          {[
            { label: 'ON', value: true, active: allUnitsOn },
            { label: 'OFF', value: false, active: !allUnitsOn },
          ].map((btn) => (
            <Pressable
              key={btn.label}
              disabled={powerPending || controlsDisabled}
              onPress={() => onPower(btn.value)}
              className={`h-full flex-1 flex-row items-center justify-center gap-1.5 rounded-full ${
                btn.active ? 'bg-[#2563eb]' : ''
              } ${controlsDisabled ? 'opacity-50' : ''}`}
              style={
                btn.active
                  ? {
                      shadowColor: '#2563eb',
                      shadowOpacity: 0.25,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 3 },
                      elevation: 4,
                    }
                  : undefined
              }
            >
              {powerPending && btn.active ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <HugeiconsIcon
                  icon={Power}
                  size={16}
                  color={btn.active ? '#ffffff' : '#94a3b8'}
                  strokeWidth={2.5}
                />
              )}
              <Text
                className={`text-[13px] font-black uppercase tracking-wide ${
                  btn.active ? 'text-white' : 'text-slate-400'
                }`}
              >
                {btn.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* MODE DROPDOWN MODAL */}
      <Modal
        visible={showModeDropdown && !!modeRect}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowModeDropdown(false)}
      >
        <Pressable className="flex-1" onPress={() => setShowModeDropdown(false)}>
          {modeRect ? (
            <Pressable
              onPress={() => {}}
              className="absolute rounded-2xl border border-slate-100 bg-white p-1.5 shadow-2xl"
              style={{
                left: modeRect.left,
                width: Math.max(modeRect.width, 140),
                top: modeRect.top,
                bottom: modeRect.bottom,
                elevation: 24,
                shadowColor: '#0f172a',
                shadowOpacity: 0.18,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
              }}
            >
              {MODE_OPTIONS.map((m) => {
                const isActive = currentMode === m.mode;
                return (
                  <Pressable
                    key={m.mode}
                    onPress={() => {
                      if (onModeChange) onModeChange(m.mode);
                      setShowModeDropdown(false);
                    }}
                    className={`flex-row items-center justify-between rounded-xl px-2.5 py-2 mb-0.5 ${
                      isActive ? 'bg-blue-600' : 'active:bg-slate-50'
                    }`}
                  >
                    <View className="flex-row items-center gap-1.5">
                      <HugeiconsIcon
                        icon={m.icon}
                        size={14}
                        color={isActive ? '#ffffff' : '#64748b'}
                        strokeWidth={2}
                      />
                      <Text
                        className={`text-[10px] font-black uppercase tracking-wider ${
                          isActive ? 'text-white' : 'text-slate-700'
                        }`}
                      >
                        {m.label}
                      </Text>
                    </View>
                    {isActive && (
                      <HugeiconsIcon icon={Check} size={12} color="#ffffff" strokeWidth={2.5} />
                    )}
                  </Pressable>
                );
              })}
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>

      {/* FAN DROPDOWN MODAL */}
      <Modal
        visible={showFanDropdown && !!fanRect}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowFanDropdown(false)}
      >
        <Pressable className="flex-1" onPress={() => setShowFanDropdown(false)}>
          {fanRect ? (
            <Pressable
              onPress={() => {}}
              className="absolute rounded-2xl border border-slate-100 bg-white p-1.5 shadow-2xl"
              style={{
                left: fanRect.left,
                width: Math.max(fanRect.width, 140),
                top: fanRect.top,
                bottom: fanRect.bottom,
                elevation: 24,
                shadowColor: '#0f172a',
                shadowOpacity: 0.18,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
              }}
            >
              {FAN_OPTIONS.map((speed) => {
                const isActive = currentFan === speed;
                return (
                  <Pressable
                    key={speed}
                    onPress={() => {
                      if (onFanChange) onFanChange(speed);
                      setShowFanDropdown(false);
                    }}
                    className={`flex-row items-center justify-between rounded-xl px-2.5 py-2 mb-0.5 ${
                      isActive ? 'bg-blue-600' : 'active:bg-slate-50'
                    }`}
                  >
                    <View className="flex-row items-center gap-1.5">
                      <HugeiconsIcon
                        icon={Fan}
                        size={14}
                        color={isActive ? '#ffffff' : '#64748b'}
                        strokeWidth={2}
                      />
                      <Text
                        className={`text-[10px] font-black uppercase tracking-wider ${
                          isActive ? 'text-white' : 'text-slate-700'
                        }`}
                      >
                        {speed}
                      </Text>
                    </View>
                    {isActive && (
                      <HugeiconsIcon icon={Check} size={12} color="#ffffff" strokeWidth={2.5} />
                    )}
                  </Pressable>
                );
              })}
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}
