import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MusclesScreen from '@/src/screen/MusclesScreen';
import WeeklyPlanScreen from '@/src/screen/WeeklyPlanScreen';
import { Colors } from '@/src/constants/colors';

type Tab = 'muscles' | 'plan';

export default function TrainingTab() {
  const [activeTab, setActiveTab] = useState<Tab>('muscles');
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={[styles.segmentBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'muscles' && styles.segmentActive]}
          onPress={() => setActiveTab('muscles')}
        >
          <Text style={[styles.segmentText, activeTab === 'muscles' && styles.segmentTextActive]}>
            Nhóm cơ
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'plan' && styles.segmentActive]}
          onPress={() => setActiveTab('plan')}
        >
          <Text style={[styles.segmentText, activeTab === 'plan' && styles.segmentTextActive]}>
            Kế hoạch
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, display: activeTab === 'muscles' ? 'flex' : 'none' }}>
        <MusclesScreen />
      </View>
      <View style={{ flex: 1, display: activeTab === 'plan' ? 'flex' : 'none' }}>
        <WeeklyPlanScreen />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  segmentBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  segmentActive: {
    borderBottomColor: Colors.accent,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  segmentTextActive: {
    color: Colors.accent,
    fontWeight: '600',
  },
});
