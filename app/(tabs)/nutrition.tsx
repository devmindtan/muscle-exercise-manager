import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/src/constants/colors';

export default function NutritionTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Thực phẩm</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
});
