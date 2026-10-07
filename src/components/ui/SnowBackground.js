import React, { memo, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';

/**
 * Light, smooth snowfall behind the auth forms.
 *
 * Performance notes (this is what keeps it smooth):
 * - ONE shared clock drives every flake; each flake only derives its own phase
 *   from it (no per-flake repeat/reset animations).
 * - Only translateX / translateY are animated (GPU transforms). No rotation,
 *   no animated opacity, no re-rasterising.
 * - Each flake is cached as a hardware texture on Android, so moving it is a
 *   pure GPU translate.
 * - Flakes enter from the top / left edge and drift diagonally (slanted rain).
 * - Pauses when the app is in the background; respects "reduce motion".
 */

const FLAKE_COUNT = 24;
const GLYPH_RATIO = 0.25; // ~1 in 4 flakes is a real snowflake shape
const WIND_ANGLE_DEG = 22; // drift to the right while falling
const CLOCK_MS = 96000; // one master cycle; flakes loop 3–5x per cycle (19–32s each)
const COLORS = ['#93c5fd', '#bfdbfe', '#a5b4fc', '#c7d2fe', '#7dd3fc'];

const rand = (min, max) => min + Math.random() * (max - min);

function buildFlakes(width, height) {
  const drift = Math.tan((WIND_ANGLE_DEG * Math.PI) / 180) * height;
  return Array.from({ length: FLAKE_COUNT }, (_, id) => {
    const glyph = Math.random() < GLYPH_RATIO;
    const size = glyph ? rand(22, 34) : rand(7, 15);
    const depth = glyph ? 1 : (size - 7) / 8; // 0 (far) … 1 (near)
    return {
      id,
      glyph,
      size,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      startX: rand(-drift, width),
      drift,
      fall: height + size * 2,
      sway: rand(6, 16),
      swayCycles: rand(1, 2.5),
      opacity: glyph ? rand(0.5, 0.85) : rand(0.35, 0.75),
      // integer number of loops per master cycle → seamless wrap; nearer = quicker
      cycles: depth > 0.66 ? 5 : depth > 0.33 ? 4 : 3,
      offset: Math.random(),
    };
  });
}

function SnowflakeGlyph({ size, color }) {
  const arm = 'M12 2 V22 M9 5 L12 8 L15 5 M9 19 L12 16 L15 19';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {[0, 60, 120].map((deg) => (
        <G key={deg} rotation={deg} origin="12, 12">
          <Path
            d={arm}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </G>
      ))}
    </Svg>
  );
}

const Flake = memo(function Flake({ flake, clock }) {
  const style = useAnimatedStyle(() => {
    const p = (clock.value * flake.cycles + flake.offset) % 1;
    return {
      transform: [
        {
          translateX:
            flake.startX +
            flake.drift * p +
            Math.sin(p * Math.PI * 2 * flake.swayCycles) * flake.sway,
        },
        { translateY: -flake.size + flake.fall * p },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      collapsable={false}
      renderToHardwareTextureAndroid
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: flake.size,
          height: flake.size,
          opacity: flake.opacity,
        },
        style,
      ]}
    >
      {flake.glyph ? (
        <SnowflakeGlyph size={flake.size} color={flake.color} />
      ) : (
        <View
          style={{
            flex: 1,
            borderRadius: flake.size / 2,
            backgroundColor: flake.color,
          }}
        />
      )}
    </Animated.View>
  );
});

export const SnowBackground = memo(function SnowBackground() {
  const { width, height } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const clock = useSharedValue(0);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(Boolean(v));
    });
    const motionSub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const appSub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => {
      mounted = false;
      motionSub.remove();
      appSub.remove();
    };
  }, []);

  const running = !reduceMotion && appActive;

  useEffect(() => {
    if (!running) return undefined;
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: CLOCK_MS, easing: Easing.linear }),
      -1,
      false
    );
    return () => {
      clock.value = 0;
    };
  }, [running, clock]);

  const flakes = useMemo(() => buildFlakes(width, height), [width, height]);

  if (!running) return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {flakes.map((f) => (
        <Flake key={f.id} flake={f} clock={clock} />
      ))}
    </View>
  );
});
