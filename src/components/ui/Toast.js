import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

/** Same look as the Dashboard toasts (error = red, success = green, info = blue). */
const STYLES = {
  error: 'border-red-200 bg-red-50',
  success: 'border-emerald-200 bg-emerald-50',
  info: 'border-blue-200 bg-blue-50',
};
const TEXT = {
  error: 'text-red-800',
  success: 'text-emerald-800',
  info: 'text-blue-800',
};

export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const showToast = useCallback((message, type = 'error', duration = 4500) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), duration);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return { toast, showToast };
}

/** The pill only — the parent decides where to position it. */
export function Toast({ toast }) {
  if (!toast) return null;
  const type = STYLES[toast.type] ? toast.type : 'error';
  return (
    <View className={`rounded-xl border px-3 py-2 ${STYLES[type]}`}>
      <Text className={`text-xs font-bold ${TEXT[type]}`}>{toast.message}</Text>
    </View>
  );
}
