import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import { Colors } from '@/src/constants/colors';

export type SubTabItem = {
  key: string;
  label: string;
  /** Optional icon component (e.g. from lucide-react-native). Receives color + size. */
  icon?: (props: { color: string; size: number; strokeWidth?: number }) => React.ReactNode;
  /** Optional badge/count shown on the right of the label. */
  count?: number;
};

type Props = {
  tabs: SubTabItem[];
  activeKey: string;
  onChange: (key: string) => void;
};

/**
 * A modern segmented control (pill-style) sub-tab bar.
 * Replaces the old underline "SlidingTabs" look with a floating pill indicator
 * that animates smoothly between segments.
 */
export function SegmentedSubTabs({ tabs, activeKey, onChange }: Props) {
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.key === activeKey));
  // Phải là state (không phải ref) — onLayout chỉ chạy 1 lần lúc mount, nếu
  // dùng ref thì component không re-render nên viên pill (điều kiện
  // segmentWidth > 0 bên dưới) không bao giờ được vẽ ở lần mount đầu tiên,
  // chỉ hiện ra sau khi có re-render khác xảy ra (vd bấm đổi tab).
  const [containerWidth, setContainerWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const hasMeasuredRef = useRef(false);

  const segmentWidth =
    containerWidth > 0
      ? (containerWidth - TRACK_PADDING * 2) / tabs.length
      : 0;

  useEffect(() => {
    if (segmentWidth <= 0) return;
    const toValue = activeIndex * segmentWidth;
    // Lần đo đầu tiên: đặt thẳng vị trí, không animate từ 0 tới đó.
    if (!hasMeasuredRef.current) {
      hasMeasuredRef.current = true;
      translateX.setValue(toValue);
      return;
    }
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [activeIndex, segmentWidth, translateX]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== containerWidth) {
      setContainerWidth(w);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.track} onLayout={onLayout}>
        {/* Sliding pill indicator */}
        {segmentWidth > 0 && (
          <Animated.View
            style={[
              styles.pill,
              {
                width: segmentWidth,
                transform: [{ translateX }],
              },
            ]}
          />
        )}

        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          const color = isActive ? Colors.bg : Colors.textSecondary;
          return (
            <Pressable
              key={tab.key}
              style={styles.segment}
              onPress={() => onChange(tab.key)}
              android_ripple={{ color: 'transparent' }}
              hitSlop={4}
            >
              {tab.icon?.({ color, size: 16, strokeWidth: 2.2 })}
              <Text
                style={[
                  styles.label,
                  { color },
                  isActive && styles.labelActive,
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <View
                  style={[
                    styles.countBadge,
                    isActive ? styles.countBadgeActive : styles.countBadgeIdle,
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      { color: isActive ? Colors.accent : Colors.textMuted },
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const TRACK_PADDING = 4;

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: Colors.bg,
  },
  track: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: TRACK_PADDING,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    bottom: TRACK_PADDING,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    ...Platform.select({
      ios: {
        shadowColor: Colors.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    zIndex: 1,
  },
  label: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  labelActive: {
    fontWeight: '700',
  },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeActive: {
    backgroundColor: Colors.bg,
  },
  countBadgeIdle: {
    backgroundColor: Colors.accent + '15',
  },
  countText: {
    fontSize: 11,
    fontWeight: '800',
  },
});