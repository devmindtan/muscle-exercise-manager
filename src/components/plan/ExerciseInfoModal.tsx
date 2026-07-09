import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import { X } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';
import { getExerciseSecondaryMuscles } from '@/src/lib/repository';
import { Exercise } from '@/src/types/database';
import { ExerciseThumb } from './ExerciseThumb';

interface ExerciseInfoModalProps {
  /** null = đóng modal. */
  exercise: Exercise | null;
  muscleNameById: Record<string, string>;
  onClose: () => void;
}

// Modal xem nhanh chi tiết 1 bài tập — dùng chung ở ExercisePickerSheet.tsx
// (khi lập kế hoạch) và FocusModeScreen.tsx (khi xem bài tiếp theo lúc
// nghỉ/chuẩn bị). Thuần đọc, không có hành động chọn/sửa/xoá.
export function ExerciseInfoModal({ exercise, muscleNameById, onClose }: ExerciseInfoModalProps) {
  const [secondaryIds, setSecondaryIds] = useState<string[]>([]);

  useEffect(() => {
    if (!exercise || exercise.exercise_type !== 'compound') {
      setSecondaryIds([]);
      return;
    }
    let cancelled = false;
    getExerciseSecondaryMuscles(exercise.id)
      .then((ids) => { if (!cancelled) setSecondaryIds(ids); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [exercise?.id, exercise?.exercise_type]);

  return (
    <Modal visible={!!exercise} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        {exercise ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={10}>
              <X color={Colors.textSecondary} size={20} strokeWidth={2} />
            </TouchableOpacity>

            <View style={styles.center}>
              <ExerciseThumb ex={exercise} size={160} />
              <Text style={styles.name}>{exercise.name}</Text>
              {exercise.exercise_type ? (
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>
                    {exercise.exercise_type === 'compound' ? 'Compound' : 'Isolation'}
                  </Text>
                </View>
              ) : null}
            </View>

            {secondaryIds.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Nhóm cơ phụ</Text>
                <View style={styles.chipRow}>
                  {secondaryIds.map((id) => (
                    <View key={id} style={styles.chip}>
                      <Text style={styles.chipText}>{muscleNameById[id] ?? 'Không rõ'}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {exercise.notes ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Ghi chú</Text>
                <Text style={styles.notes}>{exercise.notes}</Text>
              </View>
            ) : null}

            <View style={{ height: 24 }} />
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000088' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 20, paddingTop: 8,
    maxHeight: '85%',
  },
  sheetHandle: {
    width: 44, height: 4, borderRadius: 999, backgroundColor: Colors.textMuted,
    alignSelf: 'center', marginBottom: 8, opacity: 0.4,
  },
  closeBtn: { alignSelf: 'flex-end', padding: 4 },
  center: { alignItems: 'center', gap: 10, marginBottom: 8 },
  name: { fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  typeBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceElevated,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  section: { marginTop: 14 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceElevated,
  },
  chipText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  notes: { fontSize: 14, color: Colors.textMuted, lineHeight: 20 },
});
