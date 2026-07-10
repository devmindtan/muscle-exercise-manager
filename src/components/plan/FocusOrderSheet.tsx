import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import { X, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';
import { getGroupTone } from '@/src/lib/planTone';
import { upsertWeeklyPlanEntries, WeeklyPlanEntry } from '@/src/services/weeklyPlanService';
import { Exercise } from '@/src/types/database';
import { ExerciseThumb } from '@/src/components/plan/ExerciseThumb';

interface FocusOrderSheetProps {
  visible: boolean;
  dayLabel: string;
  entries: WeeklyPlanEntry[];
  exerciseById: Record<string, Exercise>;
  muscleNameById: Record<string, string>;
  colorByMuscle: Record<string, ReturnType<typeof getGroupTone>>;
  userKey: string;
  activePlanId: string | null;
  onClose: () => void;
  onSaved: (nextPlans: WeeklyPlanEntry[]) => void;
}

// Thứ tự tập trong Focus Mode chạy theo sortOrder xuyên suốt cả ngày, không
// phân biệt nhóm cơ (FocusModeScreen.sortEntriesForFocus không còn ưu tiên
// nhóm theo muscleGroupId trước) — sheet này là nơi DUY NHẤT người dùng chủ
// động chỉnh sortOrder, nên mỗi lần đổi vị trí sẽ đánh số lại toàn bộ danh
// sách của ngày đó (0..N-1) và lưu ngay.
function sortForDisplay(entries: WeeklyPlanEntry[]): WeeklyPlanEntry[] {
  return [...entries].sort((a, b) => {
    const aHas = a.sortOrder != null;
    const bHas = b.sortOrder != null;
    if (aHas && bHas) return (a.sortOrder as number) - (b.sortOrder as number);
    if (aHas !== bHas) return aHas ? -1 : 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function FocusOrderSheet({
  visible,
  dayLabel,
  entries,
  exerciseById,
  muscleNameById,
  colorByMuscle,
  userKey,
  activePlanId,
  onClose,
  onSaved,
}: FocusOrderSheetProps) {
  const [order, setOrder] = useState<WeeklyPlanEntry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setOrder(sortForDisplay(entries));
  }, [visible, entries]);

  const persist = async (nextOrder: WeeklyPlanEntry[]) => {
    setSaving(true);
    try {
      const inputs = nextOrder.map((entry, idx) => ({
        id: entry.id,
        dayKey: entry.dayKey,
        muscleGroupId: entry.muscleGroupId,
        exerciseId: entry.exerciseId,
        sets: entry.sets,
        reps: entry.reps,
        sortOrder: idx,
        note: entry.note,
      }));
      const nextPlans = await upsertWeeklyPlanEntries(inputs, userKey, activePlanId);
      onSaved(nextPlans);
    } finally {
      setSaving(false);
    }
  };

  const move = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= order.length) return;
    const next = [...order];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setOrder(next);
    void persist(next);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <ArrowUpDown color={Colors.text} size={18} strokeWidth={2.2} />
            <Text style={styles.title}>Thứ tự tập — {dayLabel}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <X color={Colors.textSecondary} size={20} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          Đây là thứ tự Focus Mode sẽ chạy qua — kéo lên/xuống để đổi, không phân biệt nhóm cơ.
        </Text>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {order.map((entry, idx) => {
            const ex = entry.exerciseId ? exerciseById[entry.exerciseId] : null;
            const tone = colorByMuscle[entry.muscleGroupId] ?? getGroupTone();
            return (
              <View key={entry.id} style={styles.row}>
                <Text style={styles.rowIndex}>{idx + 1}</Text>
                {ex ? (
                  <ExerciseThumb ex={ex} tone={tone} size={30} />
                ) : (
                  <View style={[styles.dot, { backgroundColor: tone.bar }]} />
                )}
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {ex?.name ?? 'Chưa chọn bài tập'}
                  </Text>
                  <Text style={styles.rowMuscle} numberOfLines={1}>
                    {muscleNameById[entry.muscleGroupId] ?? ''} · {entry.sets} sets
                  </Text>
                </View>
                <View style={styles.arrowCol}>
                  <TouchableOpacity onPress={() => move(idx, 'up')} disabled={idx === 0 || saving} hitSlop={6}>
                    <ChevronUp size={18} color={idx === 0 ? Colors.border : Colors.textMuted} strokeWidth={2.2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => move(idx, 'down')}
                    disabled={idx === order.length - 1 || saving}
                    hitSlop={6}
                  >
                    <ChevronDown
                      size={18}
                      color={idx === order.length - 1 ? Colors.border : Colors.textMuted}
                      strokeWidth={2.2}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '75%',
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 6, marginBottom: 12 },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  rowIndex: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, width: 16, textAlign: 'center' },
  dot: { width: 30, height: 30, borderRadius: 8 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  rowMuscle: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  arrowCol: { alignItems: 'center', justifyContent: 'center', gap: 2 },
});
