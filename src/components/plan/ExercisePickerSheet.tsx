import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import { Check, ChevronDown, X } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';
import { getExercises } from '@/src/lib/repository';
import { MuscleTone } from '@/src/lib/planTone';
import { Exercise } from '@/src/types/database';

// Nhóm bài tập theo bài gốc — biến thể (parent_exercise_id) lồng dưới bài
// gốc, để chọn bài tập cụ thể cho 1 mục kế hoạch.
function groupExercisesByParent(list: Exercise[]) {
  const idsInList = new Set(list.map((e) => e.id));
  const variantsByParent = new Map<string, Exercise[]>();
  const topLevel: Exercise[] = [];
  for (const ex of list) {
    if (ex.parent_exercise_id && idsInList.has(ex.parent_exercise_id)) {
      const arr = variantsByParent.get(ex.parent_exercise_id) || [];
      arr.push(ex);
      variantsByParent.set(ex.parent_exercise_id, arr);
    } else {
      topLevel.push(ex);
    }
  }
  return { topLevel, variantsByParent };
}

interface ExercisePickerSheetProps {
  /** Muscle group whose exercises are being picked; null = sheet closed. */
  muscleGroupId: string | null;
  muscleGroupName?: string;
  tone?: MuscleTone;
  chosenExerciseId: string | null;
  onPick: (exerciseId: string | null) => void;
  onClose: () => void;
}

// Bottom sheet riêng để chọn bài tập/biến thể cụ thể cho 1 nhóm cơ đã chọn
// trong kế hoạch — tách khỏi PlanEditorSheet để tránh chèn ép layout của
// danh sách chọn nhóm cơ (mỗi nhóm cơ chỉ có 1 dòng trigger gọn).
export function ExercisePickerSheet({
  muscleGroupId,
  muscleGroupName,
  tone,
  chosenExerciseId,
  onPick,
  onClose,
}: ExercisePickerSheetProps) {
  const [exercisesByGroup, setExercisesByGroup] = useState<Record<string, Exercise[]>>({});
  const [loading, setLoading] = useState(false);
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!muscleGroupId) return;
    setExpandedVariants(new Set());
    if (exercisesByGroup[muscleGroupId]) return;

    let cancelled = false;
    setLoading(true);
    getExercises(muscleGroupId)
      .then((rows) => {
        if (cancelled) return;
        const list = (rows as Exercise[]).filter((e) => e.is_active);
        setExercisesByGroup((prev) => ({ ...prev, [muscleGroupId]: list }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muscleGroupId]);

  const exercises = muscleGroupId ? exercisesByGroup[muscleGroupId] || [] : [];
  const { topLevel, variantsByParent } = groupExercisesByParent(exercises);

  return (
    <Modal visible={!!muscleGroupId} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <View style={styles.titleWrap}>
            <Text style={styles.sheetTitle} numberOfLines={1}>Chọn bài tập</Text>
            {muscleGroupName ? (
              <Text style={styles.subtitle} numberOfLines={1}>{muscleGroupName}</Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={onClose}>
            <X color={Colors.textSecondary} size={20} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
          {loading ? (
            <Text style={styles.mutedHint}>Đang tải bài tập...</Text>
          ) : exercises.length === 0 ? (
            <Text style={styles.mutedHint}>Nhóm cơ này chưa có bài tập nào.</Text>
          ) : (
            <View style={styles.listWrap}>
              <TouchableOpacity
                style={[styles.optionRow, chosenExerciseId === null && styles.optionRowActive]}
                onPress={() => onPick(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionText, chosenExerciseId === null && styles.optionTextActive]}>
                  Không chọn cụ thể
                </Text>
                {chosenExerciseId === null && (
                  <Check color={tone?.badgeText ?? Colors.accent} size={16} strokeWidth={2.5} />
                )}
              </TouchableOpacity>

              {topLevel.map((ex) => {
                const variants = variantsByParent.get(ex.id) || [];
                const expanded = expandedVariants.has(ex.id);
                const isChosen = chosenExerciseId === ex.id;
                return (
                  <View key={ex.id}>
                    <View style={[styles.optionRow, isChosen && styles.optionRowActive]}>
                      <TouchableOpacity
                        style={styles.optionMain}
                        onPress={() => onPick(ex.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.optionText, isChosen && styles.optionTextActive]} numberOfLines={2}>
                          {ex.name}
                        </Text>
                      </TouchableOpacity>
                      {isChosen && (
                        <Check color={tone?.badgeText ?? Colors.accent} size={16} strokeWidth={2.5} />
                      )}
                      {variants.length > 0 && (
                        <TouchableOpacity
                          style={styles.variantToggle}
                          onPress={() => setExpandedVariants((prev) => {
                            const next = new Set(prev);
                            if (next.has(ex.id)) next.delete(ex.id); else next.add(ex.id);
                            return next;
                          })}
                          hitSlop={8}
                        >
                          <Text style={styles.variantToggleText}>{variants.length} biến thể</Text>
                          <ChevronDown
                            color={Colors.textMuted}
                            size={14}
                            style={!expanded ? styles.variantChevronCollapsed : undefined}
                          />
                        </TouchableOpacity>
                      )}
                    </View>

                    {expanded && variants.map((v) => {
                      const vChosen = chosenExerciseId === v.id;
                      return (
                        <TouchableOpacity
                          key={v.id}
                          style={[styles.variantRow, vChosen && styles.optionRowActive]}
                          onPress={() => onPick(v.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.variantText, vChosen && styles.optionTextActive]} numberOfLines={2}>
                            {v.name}
                          </Text>
                          {vChosen && (
                            <Check color={tone?.badgeText ?? Colors.accent} size={15} strokeWidth={2.5} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
        <View style={{ height: 24 }} />
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
    paddingHorizontal: 16, paddingTop: 8,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 44, height: 4, borderRadius: 999, backgroundColor: Colors.textMuted,
    alignSelf: 'center', marginBottom: 12, opacity: 0.4,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  titleWrap: { flex: 1, minWidth: 0, marginRight: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  mutedHint: { fontSize: 13, color: Colors.textMuted, fontStyle: 'italic', paddingVertical: 12, textAlign: 'center' },
  listWrap: { gap: 6, paddingBottom: 4 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14, backgroundColor: Colors.surface,
  },
  optionRowActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '12' },
  optionMain: { flex: 1 },
  optionText: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  optionTextActive: { color: Colors.accent, fontWeight: '700' },
  variantToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
  },
  variantToggleText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  variantChevronCollapsed: { transform: [{ rotate: '-90deg' }] },
  variantRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 6, marginLeft: 20,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 12, backgroundColor: Colors.surface,
  },
  variantText: { flex: 1, fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
});
