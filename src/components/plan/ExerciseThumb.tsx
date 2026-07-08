import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors } from '@/src/constants/colors';
import { MuscleTone } from '@/src/lib/planTone';
import { Exercise } from '@/src/types/database';

// Ảnh minh hoạ bài tập nếu có, không thì avatar chữ cái đầu tô màu theo nhóm
// cơ — dùng chung ở ExercisePickerSheet, PlanEditorSheet, WeeklyPlanScreen để
// hiển thị bài tập nhất quán (thay cho icon/emoji rời rạc).
export function ExerciseThumb({
  ex,
  tone,
  size = 36,
}: {
  ex: Pick<Exercise, 'name' | 'image_uri'>;
  tone?: MuscleTone;
  size?: number;
}) {
  const dimStyle = { width: size, height: size, borderRadius: size * 0.22 };
  if (ex.image_uri) {
    return <Image source={{ uri: ex.image_uri }} style={[styles.thumb, dimStyle]} />;
  }
  return (
    <View style={[styles.thumbPlaceholder, dimStyle, { backgroundColor: (tone?.bar ?? Colors.accent) + '22' }]}>
      <Text style={[styles.thumbPlaceholderText, { color: tone?.bar ?? Colors.accent, fontSize: size * 0.4 }]}>
        {ex.name[0]?.toUpperCase() ?? '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {},
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholderText: { fontWeight: '700' },
});
