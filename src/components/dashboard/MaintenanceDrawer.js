import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { AlertCircle, ChevronDown, X } from '@hugeicons/core-free-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Port of NeedMaintenanceList inside web Dashboard.tsx */
function NeedMaintenanceList({
  venues,
  units,
  expandedVenueId,
  onToggleVenue,
  onViewUnit,
}) {
  if (venues.length === 0) {
    return (
      <Text className="py-6 text-center text-[11px] font-bold italic text-slate-400">
        No venues in this organization.
      </Text>
    );
  }

  return (
    <View className="gap-2">
      {venues.map((v) => {
        const venueUnits = units.filter((u) => u.venueId === v.id);
        const faultyUnits = venueUnits.filter((u) => u.hasFault);
        const faultCount = faultyUnits.length;
        const isExpanded = expandedVenueId === v.id;

        return (
          <View
            key={v.id}
            className={`overflow-hidden rounded-2xl border ${
              faultCount > 0
                ? 'border-red-100 bg-red-50/10'
                : 'border-slate-100 bg-slate-50/20'
            }`}
          >
            <Pressable
              onPress={() => onToggleVenue(v.id)}
              className="flex-row items-center justify-between p-3.5 active:bg-slate-50"
            >
              <Text
                numberOfLines={1}
                className="min-w-0 flex-1 pr-2 text-xs font-extrabold text-slate-800"
              >
                {v.name}
              </Text>
              <View className="flex-row items-center gap-2">
                <View
                  className={`rounded-full px-2.5 py-0.5 ${
                    faultCount > 0 ? 'bg-red-100' : 'bg-slate-100'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-black ${
                      faultCount > 0 ? 'text-red-700' : 'text-slate-500'
                    }`}
                  >
                    ! {String(faultCount).padStart(2, '0')}
                  </Text>
                </View>
                <View
                  style={{
                    transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
                  }}
                >
                  <HugeiconsIcon icon={ChevronDown} size={16} color="#94a3b8" />
                </View>
              </View>
            </Pressable>

            {isExpanded ? (
              <View className="border-t border-slate-100 bg-white px-4 py-2.5">
                {faultCount > 0 ? (
                  faultyUnits.map((unit, idx) => {
                    const reason =
                      unit.healthAlert ||
                      (typeof unit.ventTemperature === 'number'
                        ? `Vent ${unit.ventTemperature.toFixed(1)}°C above set ${unit.targetTemp}°C`
                        : 'Vent temperature above set point');
                    return (
                      <View
                        key={unit.id}
                        className={`flex-row items-center justify-between gap-2 py-2 ${
                          idx > 0 ? 'border-t border-slate-50' : ''
                        }`}
                      >
                        <View className="min-w-0 flex-1">
                          <Text
                            numberOfLines={1}
                            className="text-xs font-black text-slate-800"
                          >
                            {unit.name}
                          </Text>
                          <Text className="mt-0.5 text-[9px] font-medium leading-snug text-amber-600">
                            {reason}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => onViewUnit(unit.id)}
                          className="rounded-lg bg-red-50 p-1.5 active:bg-red-100"
                        >
                          <Text className="text-[10px] font-black uppercase text-red-600">
                            View
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })
                ) : (
                  <Text className="py-2 text-[11px] font-bold italic text-slate-400">
                    All hardware healthy in this venue.
                  </Text>
                )}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/**
 * Port of the mobile "Need Maintenance" draggable bottom drawer.
 * Drag the handle down > 96px to dismiss.
 */
export function MaintenanceDrawer({
  visible,
  onClose,
  venues,
  units,
  faultCount,
  expandedVenueId,
  onToggleVenue,
  onViewUnit,
}) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(winH)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (visible) {
      translateY.setValue(winH);
      Animated.spring(translateY, {
        toValue: 0,
        damping: 32,
        stiffness: 380,
        mass: 0.85,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateY, winH]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (_, g) => {
          translateY.setValue(Math.max(0, g.dy));
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 96) {
            onCloseRef.current();
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              damping: 32,
              stiffness: 380,
              mass: 0.85,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [translateY]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1">
        <Pressable
          className="absolute inset-0 bg-slate-900/45"
          onPress={onClose}
          accessibilityLabel="Close maintenance drawer"
        />
        <Animated.View
          className="absolute bottom-0 left-0 right-0 overflow-hidden rounded-t-[1.75rem] border border-slate-100 bg-white"
          style={{
            maxHeight: winH * 0.86,
            transform: [{ translateY }],
            elevation: 16,
          }}
        >
          {/* Draggable handle + header */}
          <View className="px-4 pb-1 pt-2" {...panResponder.panHandlers}>
            <View className="items-center pb-2">
              <View className="h-1.5 w-11 rounded-full bg-slate-300" />
            </View>
            <View className="flex-row items-start gap-2.5 pb-3">
              <View className="rounded-xl bg-red-50 p-2">
                <HugeiconsIcon icon={AlertCircle} size={20} color="#dc2626" />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-base font-black tracking-tight text-slate-900">
                  Need Maintenance
                </Text>
                <Text className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Vent temp & device health alerts · {faultCount} fault
                  {faultCount === 1 ? '' : 's'}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                className="rounded-xl bg-slate-100 p-2 active:scale-95"
                accessibilityLabel="Close"
              >
                <HugeiconsIcon icon={X} size={16} color="#64748b" />
              </Pressable>
            </View>
          </View>

          <ScrollView
            className="min-h-0 flex-shrink px-4"
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
            <NeedMaintenanceList
              venues={venues}
              units={units}
              expandedVenueId={expandedVenueId}
              onToggleVenue={onToggleVenue}
              onViewUnit={onViewUnit}
            />
          </ScrollView>

          <View
            className="border-t border-slate-100 px-4 pt-3"
            style={{ paddingBottom: Math.max(12, insets.bottom) }}
          >
            <Text className="text-center text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Live Hardware Heartbeat Status
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
