import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Activity,
  Building2,
  LayoutDashboard,
  MapPin,
  MonitorSmartphone,
  Users,
} from '@hugeicons/core-free-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ITEM_HEIGHT = 69.6; // h-[4.35rem]

export const MANAGER_TABS = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'organizations', label: 'Orgs', icon: Building2 },
  { id: 'venues', label: 'Venues', icon: MapPin },
  { id: 'devices', label: 'Devices', icon: MonitorSmartphone },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'reports', label: 'Reports', icon: Activity },
];

export const USER_TABS = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'devices', label: 'Devices', icon: MonitorSmartphone },
  { id: 'reports', label: 'Reports', icon: Activity },
];

/**
 * Mirrors ConsoleLayout mobile bottom nav: floating light pill with a sliding
 * blue "hump" behind the active tab.
 */
export function BottomNav({ tabs, activeTab, onTabPress }) {
  const insets = useSafeAreaInsets();
  const [innerWidth, setInnerWidth] = useState(0);
  const tabCount = tabs.length;
  const activeIndex = tabs.findIndex((t) => t.id === activeTab);
  const tabWidth = innerWidth / tabCount;
  const slide = useRef(new Animated.Value(0)).current;
  const didInit = useRef(false);

  useEffect(() => {
    if (!innerWidth || activeIndex < 0) return;
    const toValue = activeIndex * tabWidth;
    if (!didInit.current) {
      slide.setValue(toValue);
      didInit.current = true;
      return;
    }
    Animated.spring(slide, {
      toValue,
      stiffness: 420,
      damping: 34,
      mass: 0.85,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, innerWidth, tabWidth, slide]);

  // width: min(100% + 2.5rem, 6.75rem)  height: 100% - 0.5rem
  const humpWidth = Math.min(tabWidth + 40, 108);
  const humpHeight = ITEM_HEIGHT - 8;

  return (
    <View
      pointerEvents="box-none"
      className="absolute bottom-0 left-0 right-0 px-3 pt-1"
      style={{ paddingBottom: Math.max(10.4, insets.bottom) }}
    >
      <View className="mx-auto w-full" style={{ maxWidth: 416 }}>
        {/* Flat pill: no border / shadow. Solid light-blue (web's blue-100/35
            blended on the page background) so content never shows through. */}
        <View
          className="w-full overflow-hidden rounded-[2.5rem] px-2"
          style={{ backgroundColor: '#e8f0fd' }}
        >
          <View
            className="flex-row items-stretch"
            onLayout={(e) => setInnerWidth(e.nativeEvent.layout.width)}
          >
            {activeIndex >= 0 && innerWidth > 0 ? (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: tabWidth,
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  transform: [{ translateX: slide }],
                }}
              >
                <Svg
                  width={humpWidth}
                  height={humpHeight}
                  viewBox="0 0 108 62"
                  preserveAspectRatio="none"
                >
                  <Path
                    d="M0,62 A20,20 0 0 0 20,42 L20,34 A34,34 0 0 1 88,34 L88,42 A20,20 0 0 0 108,62 Z"
                    fill="#2563eb"
                  />
                </Svg>
              </Animated.View>
            ) : null}

            {tabs.map((tab) => {
              const active = tab.id === activeTab;
              const color = active ? '#ffffff' : '#2f3542';
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => onTabPress(tab.id)}
                  accessibilityLabel={tab.label}
                  accessibilityState={{ selected: active }}
                  className="min-w-0 flex-1 items-center justify-center gap-0.5 active:scale-95"
                  style={{ height: ITEM_HEIGHT }}
                >
                  <HugeiconsIcon
                    icon={tab.icon}
                    size={21.6}
                    color={color}
                    strokeWidth={active ? 2.5 : 2}
                  />
                  <Text
                    className={`text-[10px] leading-tight tracking-wide ${
                      active ? 'font-bold' : 'font-medium'
                    }`}
                    style={{ color }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}
