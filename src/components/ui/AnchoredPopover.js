import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, View, useWindowDimensions } from 'react-native';

/**
 * Web equivalent: `relative` wrapper + `fixed inset-0` transparent backdrop +
 * `absolute right-0/left-0 mt-N` floating panel. RN cannot escape scroll
 * clipping with absolute children, so the panel is rendered in a transparent
 * Modal and positioned from the trigger's window rect.
 */
export function AnchoredPopover({
  open,
  onClose,
  trigger,
  children,
  width = 224,
  align = 'left',
  gap = 8,
  panelClassName = 'rounded-2xl border border-slate-100 bg-white shadow-xl',
  maxHeight,
  panelStyle,
}) {
  const ref = useRef(null);
  const [rect, setRect] = useState(null);
  const { width: winW, height: winH } = useWindowDimensions();

  useEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    ref.current?.measureInWindow((x, y, w, h) => {
      setRect({ x, y, w, h });
    });
  }, [open]);

  let left = 0;
  let top = 0;
  if (rect) {
    left = align === 'right' ? rect.x + rect.w - width : rect.x;
    left = Math.max(8, Math.min(left, winW - width - 8));
    top = rect.y + rect.h + gap;
  }

  return (
    <View ref={ref} collapsable={false}>
      {trigger}
      <Modal
        visible={open && !!rect}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={onClose}
      >
        <Pressable className="flex-1" onPress={onClose}>
          {rect ? (
            <Pressable
              onPress={() => {}}
              className={`absolute ${panelClassName}`}
              style={[
                {
                  left,
                  top,
                  width,
                  maxHeight: maxHeight ?? winH - top - 16,
                  elevation: 8,
                },
                panelStyle,
              ]}
            >
              {children}
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}
