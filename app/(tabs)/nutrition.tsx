import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NutritionDayView from '@/src/components/nutrition/NutritionDayView';
import BodyMetricsScreen from '@/src/screen/BodyMetricsScreen';
import { SlidingTabs } from '@/src/components/common/SlidingTabs';

export default function NutritionTab() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('nutrition');

  return (
    <SlidingTabs
      tabs={[
        { key: 'nutrition', label: 'Dinh dưỡng' },
        { key: 'metrics', label: 'Chỉ số' },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      headerTopInset={insets.top + 6}
      scrollableScreens={false}
      renderScreen={(key) => (key === 'nutrition' ? <NutritionDayView /> : <BodyMetricsScreen />)}
    />
  );
}
