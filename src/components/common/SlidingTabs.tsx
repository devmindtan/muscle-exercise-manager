import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  RefreshControlProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import type { ReactElement, ReactNode } from 'react';
import { Colors } from '@/src/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface SlidingTabItem {
  key: string;
  label: string;
}

export interface SlidingTabsProps {
  tabs: SlidingTabItem[];
  /** Controlled: which tab is active. The caller owns this state. */
  activeTab: string;
  onTabChange: (key: string) => void;
  renderScreen: (tabKey: string, index: number) => React.ReactNode;
  /**
   * Render a custom tab bar (to preserve a screen's existing look) instead of
   * the default animated pill switcher. Call `onSelect(key)` on press — the
   * content-sliding animation is driven by the `activeTab` prop regardless of
   * which tab bar renders it.
   */
  renderTabBar?: (params: { activeTab: string; onSelect: (key: string) => void }) => ReactNode;
  /** Wrap each screen in its own ScrollView. Set false when the screen manages its own scrolling. */
  scrollableScreens?: boolean;
  /** Applied to every screen's own ScrollView (only used when scrollableScreens is true). */
  refreshControl?: ReactElement<RefreshControlProps>;
  headerTopInset?: number;
  containerStyle?: StyleProp<ViewStyle>;
  pillWrapStyle?: StyleProp<ViewStyle>;
}

export function SlidingTabs({
  tabs,
  activeTab,
  onTabChange,
  renderScreen,
  renderTabBar,
  scrollableScreens = true,
  refreshControl,
  headerTopInset,
  containerStyle,
  pillWrapStyle,
}: SlidingTabsProps) {
  const activeIndex = Math.max(tabs.findIndex((t) => t.key === activeTab), 0);

  // Chỉ cần 1 biến Animated để điều khiển cả indicator và slide trang
  const animValue = useRef(new Animated.Value(activeIndex)).current;
  const previousIndexRef = useRef(activeIndex);

  useEffect(() => {
    if (previousIndexRef.current === activeIndex) return;
    previousIndexRef.current = activeIndex;

    // Chạy hiệu ứng mượt mà đồng thời cho cả chữ và trang
    Animated.spring(animValue, {
      toValue: activeIndex,
      useNativeDriver: false, // Tắt native driver vì animate màu sắc layout chưa hỗ trợ hoàn toàn
      tension: 260,
      friction: 26,
    }).start();
  }, [activeIndex, animValue]);

  const onSelect = (key: string) => {
    if (key === activeTab) return;
    onTabChange(key);
  };

  // Interpolate cho vị trí trượt trang
  const translateX = animValue.interpolate({
    inputRange: tabs.map((_, i) => i),
    outputRange: tabs.map((_, i) => -SCREEN_WIDTH * i),
  });

  return (
    <View style={[{ flex: 1, backgroundColor: Colors.bg }, containerStyle]}>
      {renderTabBar ? (
        renderTabBar({ activeTab, onSelect })
      ) : (
        <View style={[styles.header, headerTopInset != null && { paddingTop: headerTopInset }]}>
          <View style={[styles.pillWrap, pillWrapStyle]}>
            {tabs.map((tab, index) => {
              // Tính toán màu nền động cho từng nút dựa trên animValue
              const backgroundColor = animValue.interpolate({
                inputRange: [index - 1, index, index + 1],
                outputRange: ['transparent', Colors.accent, 'transparent'],
                extrapolate: 'clamp',
              });

              // Tính toán màu chữ động
              const textColor = animValue.interpolate({
                inputRange: [index - 1, index, index + 1],
                outputRange: [Colors.textMuted, Colors.bg, Colors.textMuted],
                extrapolate: 'clamp',
              });

              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => onSelect(tab.key)}
                  activeOpacity={0.8}
                >
                  {/* Đổi thành Animated.View và Animated.Text để nhận giá trị nội suy */}
                  <Animated.View style={[styles.pillBtn, { backgroundColor }]}>
                    <Animated.Text style={[styles.pillText, { color: textColor }]}>
                      {tab.label}
                    </Animated.Text>
                  </Animated.View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Sliding content */}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View
          style={[
            styles.slidingContainer,
            { width: SCREEN_WIDTH * tabs.length, transform: [{ translateX }] },
          ]}
        >
          {tabs.map((tab, index) => {
            const content = renderScreen(tab.key, index);
            return (
              <View key={tab.key} style={styles.screen}>
                {scrollableScreens ? (
                  <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={refreshControl}
                  >
                    {content}
                  </ScrollView>
                ) : (
                  content
                )}
              </View>
            );
          })}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pillWrap: {
    flexDirection: 'row',
    backgroundColor: Colors.bg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
  },
  pillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 17,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700', // Để đậm cố định, tránh đổi weight gây giật text khi dịch chuyển
  },
  slidingContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  screen: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
