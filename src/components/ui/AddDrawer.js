import React from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Drawer } from 'react-native-drawer-layout';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { X } from '@hugeicons/core-free-icons';

/** Console page bg (header sits on the same slate-50). */
const PAGE_BG = '#f8fafc';

/**
 * Right-edge drawer scoped to the console content frame only
 * (does not cover header or bottom nav). Full content width.
 */
export function AddDrawer({
  open,
  onClose,
  title,
  subtitle,
  panel,
  children,
  /** SoftAP owns its own scrolling — skip KeyboardAwareScrollView. */
  scrollable = true,
}) {
  const { width: windowWidth } = useWindowDimensions();

  return (
    <Drawer
      open={open}
      onOpen={() => {}}
      onClose={onClose}
      drawerPosition="right"
      drawerType="front"
      swipeEnabled={open}
      drawerStyle={{
        width: windowWidth,
        backgroundColor: PAGE_BG,
      }}
      overlayStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.35)' }}
      renderDrawerContent={() => (
        <View className="flex-1" style={{ backgroundColor: PAGE_BG }}>
          <View className="flex-row items-start justify-between gap-3 border-b border-slate-100/80 px-5 pb-4 pt-3">
            <View className="min-w-0 flex-1">
              {subtitle ? (
                <Text className="mb-1 text-[10px] font-black uppercase tracking-widest text-blue-600">
                  {subtitle}
                </Text>
              ) : null}
              <Text className="text-base font-black tracking-tight text-slate-900">
                {title || 'Add'}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="rounded-xl bg-white p-2 active:scale-95"
              accessibilityLabel="Close"
            >
              <HugeiconsIcon icon={X} size={16} color="#64748b" />
            </Pressable>
          </View>

          {scrollable ? (
            <KeyboardAwareScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: 24,
              }}
              bottomOffset={24}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {panel}
            </KeyboardAwareScrollView>
          ) : (
            <View className="min-h-0 flex-1 px-5 pb-3 pt-3">{panel}</View>
          )}
        </View>
      )}
    >
      {children}
    </Drawer>
  );
}
