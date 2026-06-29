import { useRef } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MusclesScreen from '@/src/screen/MusclesScreen';
import WeeklyPlanScreen from '@/src/screen/WeeklyPlanScreen';
import { Colors } from '@/src/constants/colors';

type Tab = 'muscles' | 'plan';

const TABS: { key: Tab; label: string }[] = [
  { key: 'muscles', label: 'Nhóm cơ' },
  { key: 'plan', label: 'Kế hoạch' },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function TrainingTab() {
  const insets = useSafeAreaInsets();

  // Chỉ cần 1 biến Animated để điều khiển cả indicator và slide trang
  const animValue = useRef(new Animated.Value(0)).current; 
  // Dùng ref để lưu tab hiện tại thay vì state nhằm tránh re-render giật lag khi bấm
  const currentTabRef = useRef<Tab>('muscles'); 

  const switchTab = (tab: Tab) => {
    if (tab === currentTabRef.current) return;
    
    currentTabRef.current = tab;
    const toIndex = TABS.findIndex((t) => t.key === tab);

    // Chạy hiệu ứng mượt mà đồng thời cho cả chữ và trang
    Animated.spring(animValue, {
      toValue: toIndex,
      useNativeDriver: false, // Tắt native driver vì animate màu sắc layout chưa hỗ trợ hoàn toàn
      tension: 260,
      friction: 26,
    }).start();
  };

  // Interpolate cho vị trí trượt trang
  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -SCREEN_WIDTH],
  });

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      {/* Compact pill switcher */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.pillWrap}>
          {TABS.map((tab, index) => {
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
                onPress={() => switchTab(tab.key)}
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

      {/* Sliding content */}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View
          style={[styles.slidingContainer, { transform: [{ translateX }] }]}
        >
          <View style={styles.screen}>
            <MusclesScreen />
          </View>
          <View style={styles.screen}>
            <WeeklyPlanScreen />
          </View>
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
    width: SCREEN_WIDTH * 2,
  },
  screen: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
});