import { useRef, useState } from 'react';
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
  const [activeTab, setActiveTab] = useState<Tab>('muscles');
  const insets = useSafeAreaInsets();

  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const switchTab = (tab: Tab) => {
    if (tab === activeTab) return;
    const toIndex = TABS.findIndex((t) => t.key === tab);
    Animated.parallel([
      Animated.spring(indicatorAnim, {
        toValue: toIndex,
        useNativeDriver: false,
        tension: 300,
        friction: 30,
      }),
      Animated.spring(slideAnim, {
        toValue: toIndex,
        useNativeDriver: true,
        tension: 300,
        friction: 30,
      }),
    ]).start();
    setActiveTab(tab);
  };

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -SCREEN_WIDTH],
  });

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      {/* Header: title + pill segment switcher */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Tập luyện</Text>
        <View style={styles.pillWrap}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.pillBtn, isActive && styles.pillBtnActive]}
                onPress={() => switchTab(tab.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                  {tab.label}
                </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
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
  pillBtnActive: {
    backgroundColor: Colors.accent,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  pillTextActive: {
    color: Colors.bg,
    fontWeight: '700',
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
