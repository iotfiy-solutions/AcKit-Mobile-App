import React, { useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';

/**
 * Minimal replacement for web `<input type="range">`
 * (slate-200 track, blue thumb, integer steps).
 */
export function RangeSlider({ min, max, value, onChange }) {
  const [width, setWidth] = useState(0);
  const live = useRef({});
  live.current = { min, max, width, onChange };

  const pan = useRef(null);
  if (!pan.current) {
    const update = (x) => {
      const { min: lo, max: hi, width: w, onChange: cb } = live.current;
      if (!w) return;
      const ratio = Math.max(0, Math.min(1, x / w));
      cb(Math.round(lo + ratio * (hi - lo)));
    };
    pan.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => update(e.nativeEvent.locationX),
      onPanResponderMove: (e) => update(e.nativeEvent.locationX),
      onPanResponderTerminationRequest: () => false,
    });
  }

  const ratio = (value - min) / (max - min);
  const thumb = 18;

  return (
    <View
      className="h-8 flex-1 justify-center"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <View pointerEvents="none" className="h-2 rounded-lg bg-slate-200">
        <View
          className="h-2 rounded-lg bg-blue-600"
          style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }}
        />
      </View>
      <View
        pointerEvents="none"
        className="absolute rounded-full border-2 border-white bg-blue-600"
        style={{
          width: thumb,
          height: thumb,
          left: Math.max(0, Math.min(1, ratio)) * (width - thumb),
          elevation: 2,
        }}
      />
      {/* Touch layer — keeps locationX relative to the track */}
      <View
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        {...pan.current.panHandlers}
      />
    </View>
  );
}
