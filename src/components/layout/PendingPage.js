import React from 'react';
import { Text, View } from 'react-native';

/** Placeholder for pages that are not ported from the web yet. */
export function PendingPage({ title }) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <View className="w-full items-center rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-10">
        <Text className="text-sm font-black uppercase tracking-widest text-slate-400">
          {title}
        </Text>
        <Text className="mt-1 text-center text-xs text-slate-400">
          This screen will be ported from the web next.
        </Text>
      </View>
    </View>
  );
}
