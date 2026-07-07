import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable, Image, ActivityIndicator } from 'react-native';
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
  /** Có thể chọn nhiều bài tập cho cùng 1 nhóm cơ. */
  chosenExerciseIds: string[];
  onToggle: (exerciseId: string) => void;
  onClearAll: () => void;
  onDone: () => void;
}

function ExerciseThumb({ ex, tone }: { ex: Exercise; tone?: MuscleTone }) {
  if (ex.image_uri) {
    return <Image source={{ uri: ex.image_uri }} style={styles.thumb} />;
  }
  return (
    <View style={[styles.thumbPlaceholder, { backgroundColor: (tone?.bar ?? Colors.accent) + '22' }]}>
      <Text style={[styles.thumbPlaceholderText, { color: tone?.bar ?? Colors.accent }]}>
        {ex.name[0]?.toUpperCase() ?? '?'}
      </Text>
    </View>
  );
}

// Bottom sheet riêng để chọn (nhiều) bài tập/biến thể cụ thể cho 1 nhóm cơ đã
// chọn trong kế hoạch — tách khỏi PlanEditorSheet để tránh chèn ép layout của
// danh sách chọn nhóm cơ (mỗi nhóm cơ chỉ có 1 dòng trigger gọn).
export function ExercisePickerSheet({
  muscleGroupId,
  muscleGroupName,
  tone,
  chosenExerciseIds,
  onToggle,
  onClearAll,
  onDone,
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
  const hasSelection = chosenExerciseIds.length > 0;

  return (
    <Modal visible={!!muscleGroupId} transparent animationType="slide" onRequestClose={onDone}>
      <Pressable style={styles.overlay} onPress={onDone} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <View style={styles.titleWrap}>
            <Text style={styles.sheetTitle} numberOfLines={1}>Chọn bài tập</Text>
            {muscleGroupName ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {muscleGroupName} · có thể chọn nhiều bài
              </Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={onDone}>
            <X color={Colors.textSecondary} size={20} />
          </TouchableOpacity>
        </View>

        {hasSelection && (
          <TouchableOpacity style={styles.clearAllBtn} onPress={onClearAll}>
            <Text style={styles.clearAllText}>Bỏ chọn tất cả ({chosenExerciseIds.length})</Text>
          </TouchableOpacity>
        )}

        <ScrollView style={{ maxHeight: 400 }} keyboardShouldPersistTaps="handled">
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={Colors.accent} />
              <Text style={[styles.mutedHint, { marginTop: 8 }]}>Đang tải bài tập...</Text>
            </View>
          ) : exercises.length === 0 ? (
            <Text style={styles.mutedHint}>Nhóm cơ này chưa có bài tập nào.</Text>
          ) : (
            <View style={styles.listWrap}>
              {topLevel.map((ex) => {
                const variants = variantsByParent.get(ex.id) || [];
                const expanded = expandedVariants.has(ex.id);
                const isChosen = chosenExerciseIds.includes(ex.id);
                return (
                  <View key={ex.id}>
                    <View style={[styles.optionRow, isChosen && styles.optionRowActive]}>
                      <TouchableOpacity
                        style={styles.optionMain}
                        onPress={() => onToggle(ex.id)}
                        activeOpacity={0.7}
                      >
                        <ExerciseThumb ex={ex} tone={tone} />
                        <Text style={[styles.optionText, isChosen && styles.optionTextActive]} numberOfLines={2}>
                          {ex.name}
                        </Text>
                      </TouchableOpacity>
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
                      <View style={[styles.checkbox, isChosen && styles.checkboxActive]}>
                        {isChosen && <Check color={Colors.bg} size={14} strokeWidth={3} />}
                      </View>
                    </View>

                    {expanded && variants.map((v) => {
                      const vChosen = chosenExerciseIds.includes(v.id);
                      return (
                        <TouchableOpacity
                          key={v.id}
                          style={[styles.variantRow, vChosen && styles.optionRowActive]}
                          onPress={() => onToggle(v.id)}
                          activeOpacity={0.7}
                        >
                          <ExerciseThumb ex={v} tone={tone} />
                          <Text style={[styles.variantText, vChosen && styles.optionTextActive]} numberOfLines={2}>
                            {v.name}
                          </Text>
                          <View style={[styles.checkbox, vChosen && styles.checkboxActive]}>
                            {vChosen && <Check color={Colors.bg} size={13} strokeWidth={3} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        <TouchableOpacity style={styles.doneBtn} onPress={onDone}>
          <Text style={styles.doneBtnText}>
            {hasSelection ? `Xong (${chosenExerciseIds.length} bài đã chọn)` : 'Xong (không chọn cụ thể)'}
          </Text>
        </TouchableOpacity>
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  titleWrap: { flex: 1, minWidth: 0, marginRight: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  clearAllBtn: { alignSelf: 'flex-start', marginBottom: 8, paddingVertical: 2 },
  clearAllText: { fontSize: 12, color: Colors.error, fontWeight: '600' },
  mutedHint: { fontSize: 13, color: Colors.textMuted, fontStyle: 'italic', paddingVertical: 12, textAlign: 'center' },
  loadingWrap: { alignItems: 'center', paddingVertical: 12 },
  listWrap: { gap: 6, paddingBottom: 4 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingVertical: 8, paddingHorizontal: 10, backgroundColor: Colors.surface,
  },
  optionRowActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '12' },
  optionMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionText: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '500' },
  optionTextActive: { color: Colors.accent, fontWeight: '700' },
  thumb: { width: 36, height: 36, borderRadius: 8 },
  thumbPlaceholder: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholderText: { fontSize: 14, fontWeight: '700' },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg,
  },
  checkboxActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  variantToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
  },
  variantToggleText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  variantChevronCollapsed: { transform: [{ rotate: '-90deg' }] },
  variantRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 6, marginLeft: 20,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 10, backgroundColor: Colors.surface,
  },
  variantText: { flex: 1, fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  doneBtn: {
    marginTop: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, backgroundColor: Colors.accent,
  },
  doneBtnText: { color: Colors.bg, fontWeight: '700', fontSize: 14 },
});
