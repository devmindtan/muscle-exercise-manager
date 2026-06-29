import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/src/constants/colors';
import NutritionDayView from '@/src/components/nutrition/NutritionDayView';

export default function NutritionTab() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, paddingTop: insets.top }}>
      <NutritionDayView />
    </View>
  );
}
