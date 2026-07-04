import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MusclesScreen from '@/src/screen/MusclesScreen';
import WeeklyPlanScreen from '@/src/screen/WeeklyPlanScreen';
import { SlidingTabs } from '@/src/components/common/SlidingTabs';

export default function TrainingTab() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('muscles');

  return (
    <SlidingTabs
      tabs={[
        { key: 'muscles', label: 'Nhóm cơ' },
        { key: 'plan', label: 'Kế hoạch' },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      headerTopInset={insets.top + 6}
      scrollableScreens={false}
      renderScreen={(key) => (key === 'muscles' ? <MusclesScreen /> : <WeeklyPlanScreen />)}
    />
  );
}
