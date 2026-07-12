import { View, Text, StyleSheet, Switch } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';

export function ExerciseInjuryBadge({ size = 12 }: { size?: number }) {
  return <AlertTriangle color={Colors.warning} size={size} strokeWidth={2.2} />;
}

// Hàng cấu hình "dễ chấn thương" trong form thêm/sửa bài tập — dùng Switch có
// sẵn của RN (đã dùng ở UserAccountModal/NutrientConfigScreen) thay vì chip
// bấm tự vẽ, để nhất quán với cách app đã xử lý các cờ bật/tắt khác.
export function InjuryToggleRow({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <AlertTriangle size={16} color={Colors.warning} strokeWidth={2.2} />
        <Text style={styles.label}>Dễ chấn thương</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.warning + '60' }}
        thumbColor={value ? Colors.warning : Colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 14, color: Colors.text, fontWeight: '600' },
});
