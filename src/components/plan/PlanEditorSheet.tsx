import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ChevronRight, Dumbbell, X } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';
import { MuscleTone } from '@/src/lib/planTone';
import {
  upsertWeeklyPlanEntry,
  upsertWeeklyPlanEntries,
  WEEK_DAYS,
  WeekDayKey,
  WeeklyPlanEntry,
} from '@/src/services/weeklyPlanService';
import { MuscleGroup } from '@/src/types/database';
import { ExercisePickerSheet } from './ExercisePickerSheet';

type MuscleGroupWithCount = MuscleGroup & { exercise_count?: number };

const CATEGORIES = ['Ngực', 'Lưng', 'Vai', 'Tay', 'Chân', 'Bụng', 'Khác'];

export type PlanEditorRequest =
  | { type: 'create' }
  | { type: 'edit'; entry: WeeklyPlanEntry }
  | { type: 'prefill'; muscleGroupId: string; sets: number };

interface PlanEditorSheetProps {
  request: PlanEditorRequest | null;
  onClose: () => void;
  onSaved: (nextPlans: WeeklyPlanEntry[]) => void;
  initialDay: WeekDayKey;
  groups: MuscleGroupWithCount[];
  plans: WeeklyPlanEntry[];
  colorByMuscle: Record<string, MuscleTone>;
  weeklyActualSetsByMuscle: Record<string, number>;
  weekProgressLoading: boolean;
  exerciseNameById: Record<string, string>;
  userKey: string;
  activePlanId: string | null;
}

// Bottom sheet để tạo hàng loạt (nhiều ngày/nhiều nhóm cơ) hoặc sửa 1 mục kế
// hoạch — tách khỏi WeeklyPlanScreen để màn chính gọn hơn. Việc chọn bài tập
// cụ thể cho từng nhóm cơ được uỷ quyền cho ExercisePickerSheet (bottom sheet
// riêng), tránh chèn ép layout của danh sách chọn nhóm cơ.
export function PlanEditorSheet({
  request,
  onClose,
  onSaved,
  initialDay,
  groups,
  plans,
  colorByMuscle,
  weeklyActualSetsByMuscle,
  weekProgressLoading,
  exerciseNameById,
  userKey,
  activePlanId,
}: PlanEditorSheetProps) {
  const editingId = request?.type === 'edit' ? request.entry.id : null;
  const editingEntry = request?.type === 'edit' ? request.entry : null;

  const [formDayCreate, setFormDayCreate] = useState<WeekDayKey>('mon');
  const [createDaySelections, setCreateDaySelections] = useState<
    Partial<Record<WeekDayKey, Record<string, string>>>
  >({});
  const [formDaySingle, setFormDaySingle] = useState<WeekDayKey>('mon');
  const [selectedMuscles, setSelectedMuscles] = useState<Record<string, string>>({});
  const [editNote, setEditNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  const [selectedExercises, setSelectedExercises] = useState<Record<string, string | null>>({});
  const [createDayExerciseSelections, setCreateDayExerciseSelections] = useState<
    Partial<Record<WeekDayKey, Record<string, string | null>>>
  >({});
  const [exercisePickerFor, setExercisePickerFor] = useState<string | null>(null);

  // Seed lại toàn bộ state cục bộ mỗi khi có yêu cầu mở sheet mới (tạo/sửa/
  // đưa từ ngoài kế hoạch vào).
  useEffect(() => {
    if (!request) return;
    setError('');
    setSaving(false);
    setSelectedCategories(new Set());
    setExercisePickerFor(null);

    if (request.type === 'edit') {
      const entry = request.entry;
      setFormDaySingle(entry.dayKey);
      setCreateDaySelections({});
      setSelectedMuscles({ [entry.muscleGroupId]: String(entry.sets) });
      setEditNote(entry.note || '');
      setSelectedExercises({ [entry.muscleGroupId]: entry.exerciseId ?? null });
      setCreateDayExerciseSelections({});
    } else if (request.type === 'prefill') {
      const sets = String(Math.max(1, Math.round(request.sets)));
      setFormDayCreate(initialDay);
      setCreateDaySelections({ [initialDay]: { [request.muscleGroupId]: sets } });
      setSelectedMuscles({ [request.muscleGroupId]: sets });
      setEditNote('');
      setSelectedExercises({});
      setCreateDayExerciseSelections({});
    } else {
      setFormDayCreate(initialDay);
      setCreateDaySelections({});
      setSelectedMuscles({});
      setEditNote('');
      setSelectedExercises({});
      setCreateDayExerciseSelections({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const existingPlanByDayMuscle = new Map<string, WeeklyPlanEntry>();
  plans.forEach((entry) => {
    existingPlanByDayMuscle.set(`${entry.dayKey}::${entry.muscleGroupId}`, entry);
  });

  const persistedPlannedByMuscle = plans.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.muscleGroupId] = (acc[entry.muscleGroupId] || 0) + entry.sets;
    return acc;
  }, {});

  // FIX: draftDeltaByMuscle chỉ dùng cho create mode — edit mode tính riêng
  // trong lúc render để tránh nhầm lẫn.
  const draftDeltaByMuscle: Record<string, number> = {};
  if (!editingId) {
    const source = { ...createDaySelections, [formDayCreate]: selectedMuscles };
    WEEK_DAYS.forEach((day) => {
      const musclesForDay = source[day.key] || {};
      Object.entries(musclesForDay).forEach(([muscleGroupId, setsRaw]) => {
        const nextSets = Number(setsRaw);
        if (!Number.isFinite(nextSets) || nextSets <= 0) return;
        const existing = existingPlanByDayMuscle.get(`${day.key}::${muscleGroupId}`);
        const existingSets = existing?.sets || 0;
        draftDeltaByMuscle[muscleGroupId] = (draftDeltaByMuscle[muscleGroupId] || 0) + (nextSets - existingSets);
      });
    });
  }

  const filteredGroups = selectedCategories.size === 0
    ? groups
    : groups.filter((group) => selectedCategories.has(group.category || 'Khác'));

  const configuredCreateDaysCount = Object.values(createDaySelections)
    .filter((value) => value && Object.keys(value).length > 0).length;

  const toggleMuscle = (id: string) => {
    setSelectedMuscles((prev) => {
      let next: Record<string, string>;
      if (prev[id] !== undefined) {
        next = { ...prev };
        delete next[id];
      } else {
        next = { ...prev, [id]: '10' };
      }
      if (!editingId) {
        setCreateDaySelections((dayPrev) => ({ ...dayPrev, [formDayCreate]: next }));
      }
      return next;
    });
    setSelectedExercises((prev) => {
      if (prev[id] === undefined) return prev;
      const next = { ...prev };
      delete next[id];
      if (!editingId) {
        setCreateDayExerciseSelections((dayPrev) => ({ ...dayPrev, [formDayCreate]: next }));
      }
      return next;
    });
  };

  const updateMuscleSets = (id: string, val: string) => {
    setSelectedMuscles((prev) => {
      const next = { ...prev, [id]: val };
      if (!editingId) {
        setCreateDaySelections((dayPrev) => ({ ...dayPrev, [formDayCreate]: next }));
      }
      return next;
    });
  };

  const switchCreateDay = (dayKey: WeekDayKey) => {
    setFormDayCreate(dayKey);
    setSelectedMuscles({ ...(createDaySelections[dayKey] || {}) });
    setSelectedExercises({ ...(createDayExerciseSelections[dayKey] || {}) });
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const setMuscleExercise = (muscleGroupId: string, exerciseId: string | null) => {
    setSelectedExercises((prev) => {
      const next = { ...prev, [muscleGroupId]: exerciseId };
      if (!editingId) {
        setCreateDayExerciseSelections((dayPrev) => ({ ...dayPrev, [formDayCreate]: next }));
      }
      return next;
    });
  };

  const submit = async () => {
    const muscleIds = Object.keys(selectedMuscles);
    if (muscleIds.length === 0) { setError('Vui lòng chọn ít nhất một nhóm cơ.'); return; }
    const muscleEntries = muscleIds.map((id) => ({ muscleGroupId: id, sets: Number(selectedMuscles[id]) }));
    if (muscleEntries.some((e) => !Number.isFinite(e.sets) || e.sets <= 0)) {
      setError('Sets cần là số lớn hơn 0.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const nextPlans = await upsertWeeklyPlanEntry(
          {
            id: editingId,
            dayKey: formDaySingle,
            muscleGroupId: muscleIds[0],
            exerciseId: selectedExercises[muscleIds[0]] ?? null,
            sets: muscleEntries[0].sets,
            note: editNote,
          },
          userKey,
          activePlanId,
        );
        onSaved(nextPlans);
      } else {
        const source = { ...createDaySelections, [formDayCreate]: selectedMuscles };
        const exerciseSource = { ...createDayExerciseSelections, [formDayCreate]: selectedExercises };
        const payload = WEEK_DAYS.flatMap(({ key }) => {
          const musclesForDay = source[key] || {};
          const exercisesForDay = exerciseSource[key] || {};
          return Object.entries(musclesForDay)
            .map(([muscleGroupId, setsRaw]) => {
              const existing = plans.find(
                (plan) => plan.dayKey === key && plan.muscleGroupId === muscleGroupId,
              );
              return {
                id: existing?.id,
                dayKey: key,
                muscleGroupId,
                exerciseId: exercisesForDay[muscleGroupId] ?? null,
                sets: Number(setsRaw),
                note: existing?.note || '',
              };
            })
            .filter((entry) => Number.isFinite(entry.sets) && entry.sets > 0);
        });
        if (payload.length === 0) {
          setError('Vui lòng chọn nhóm cơ cho ít nhất một ngày.');
          setSaving(false);
          return;
        }
        const nextPlans = await upsertWeeklyPlanEntries(payload, userKey, activePlanId);
        onSaved(nextPlans);
      }
      onClose();
    } catch {
      setError('Không thể lưu kế hoạch. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const createLabel = (() => {
    if (saving) return 'Đang lưu...';
    const dCount = configuredCreateDaysCount;
    const mCount = dCount > 0
      ? Math.max(...Object.values(createDaySelections).map((value) => Object.keys(value || {}).length), 0)
      : 0;
    if (dCount > 1 && mCount > 1) return `Thêm ${mCount} nhóm cơ × ${dCount} ngày`;
    if (dCount > 1) return `Thêm ${dCount} ngày`;
    if (mCount > 1) return `Thêm ${mCount} nhóm cơ`;
    return 'Thêm kế hoạch';
  })();

  const pickerGroup = exercisePickerFor ? groups.find((g) => g.id === exercisePickerFor) ?? null : null;

  return (
    <>
      <Modal visible={!!request} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.overlay} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editingId ? 'Sửa kế hoạch' : 'Thêm kế hoạch'}</Text>
              <TouchableOpacity onPress={onClose}>
                <X color={Colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            {/* Day picker */}
            <Text style={styles.inputLabel}>
              {editingId
                ? 'Ngày tập'
                : `Ngày tập${configuredCreateDaysCount > 0 ? ` (${configuredCreateDaysCount} ngày đã set)` : ''}`}
            </Text>
            <View style={styles.filterWrap}>
              {WEEK_DAYS.map((day) => {
                const isActive = editingId ? formDaySingle === day.key : formDayCreate === day.key;
                const hasConfig = !editingId && Object.keys(createDaySelections[day.key] || {}).length > 0;
                return (
                  <TouchableOpacity
                    key={day.key}
                    style={[styles.chip, hasConfig && styles.chipConfigured, isActive && styles.chipActive]}
                    onPress={() => {
                      if (editingId) setFormDaySingle(day.key);
                      else switchCreateDay(day.key);
                    }}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{day.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Multi-muscle selector */}
            <Text style={styles.inputLabel}>
              {editingId
                ? 'Nhóm cơ'
                : `Nhóm cơ${Object.keys(selectedMuscles).length > 0 ? ` (${Object.keys(selectedMuscles).length} đã chọn)` : ''}`}
            </Text>

            <View style={styles.categoryFilterWrap}>
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategories.has(cat);
                const count = groups.filter((group) => (group.category || 'Khác') === cat).length;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryFilterChip, isSelected && styles.categoryFilterChipActive]}
                    onPress={() => toggleCategory(cat)}
                  >
                    <Text style={[styles.categoryFilterChipText, isSelected && styles.categoryFilterChipTextActive]}>
                      {cat} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.musclePickerList}>
              {filteredGroups.map((group) => {
                const col = colorByMuscle[group.id];
                const isChosen = selectedMuscles[group.id] !== undefined;
                const targetSets = Number(group.target_sets_per_week || 0);
                const actualWeeklySets = weeklyActualSetsByMuscle[group.id] ?? 0;
                const persistedPlannedSets = persistedPlannedByMuscle[group.id] ?? 0;

                let projectedPlannedSets: number;
                if (editingId) {
                  const currentInputSets = Number(selectedMuscles[group.id] || 0);
                  const isThisEntryMuscle = editingEntry?.muscleGroupId === group.id;
                  if (isThisEntryMuscle) {
                    projectedPlannedSets = persistedPlannedSets - (editingEntry?.sets ?? 0) + currentInputSets;
                  } else {
                    projectedPlannedSets = persistedPlannedSets;
                  }
                } else {
                  const draftContribution = draftDeltaByMuscle[group.id] ?? 0;
                  const safeDraftContribution = Number.isFinite(draftContribution) ? draftContribution : 0;
                  projectedPlannedSets = Math.max(persistedPlannedSets + safeDraftContribution, 0);
                }

                const remain = Math.max(targetSets - projectedPlannedSets, 0);
                const reached = targetSets > 0
                  ? projectedPlannedSets >= targetSets
                  : projectedPlannedSets > 0;

                const chosenExerciseId = selectedExercises[group.id] ?? null;
                const chosenExerciseName = chosenExerciseId ? exerciseNameById[chosenExerciseId] : null;

                return (
                  <View
                    key={group.id}
                    style={[
                      styles.musclePickerRow,
                      isChosen && { borderColor: col?.bar ?? Colors.accent, backgroundColor: col?.badgeBg ?? Colors.accent + '10' },
                    ]}
                  >
                    <View style={styles.musclePickerMainRow}>
                      <TouchableOpacity
                        style={styles.musclePickerLeft}
                        onPress={() => !editingId && toggleMuscle(group.id)}
                        activeOpacity={editingId ? 1 : 0.6}
                      >
                        <View style={[styles.musclePickerCheck, isChosen && { backgroundColor: col?.bar ?? Colors.accent, borderColor: col?.bar ?? Colors.accent }]}>
                          {isChosen && <Text style={styles.musclePickerCheckMark}>✓</Text>}
                        </View>
                        <View style={styles.musclePickerTextWrap}>
                          <View style={styles.musclePickerNameRow}>
                            <Text style={[styles.musclePickerName, isChosen && { color: col?.badgeText ?? Colors.accent, fontWeight: '700' }]}>
                              {group.name}
                            </Text>
                            <Text style={[styles.musclePickerGoalStatus, reached ? styles.musclePickerGoalReached : styles.musclePickerGoalPending]}>
                              {reached ? 'Đủ' : `Thiếu ${remain}`}
                            </Text>
                          </View>
                          <Text style={[styles.musclePickerMeta, isChosen && { color: col?.badgeText ?? Colors.textSecondary }]}>
                            Mục tiêu {targetSets}s · Đã tập {weekProgressLoading ? '…' : actualWeeklySets}s · Kế hoạch {projectedPlannedSets}s
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {isChosen && (
                        <View style={styles.musclePickerSetsWrap}>
                          <TextInput
                            style={[styles.musclePickerSetsInput, { borderColor: col?.bar ?? Colors.accent }]}
                            keyboardType="number-pad"
                            value={selectedMuscles[group.id]}
                            onChangeText={(val) => updateMuscleSets(group.id, val)}
                            selectTextOnFocus
                          />
                          <Text style={[styles.musclePickerSetsUnit, { color: col?.badgeText ?? Colors.accent }]}>sets</Text>
                        </View>
                      )}
                    </View>

                    {/* Dòng trigger gọn, mở sheet chọn bài tập riêng */}
                    {isChosen && (
                      <TouchableOpacity
                        style={styles.exerciseTriggerRow}
                        onPress={() => setExercisePickerFor(group.id)}
                        activeOpacity={0.7}
                      >
                        <Dumbbell color={col?.badgeText ?? Colors.textMuted} size={14} strokeWidth={2} />
                        <Text
                          style={[
                            styles.exerciseTriggerText,
                            chosenExerciseName ? { color: col?.badgeText ?? Colors.text, fontWeight: '600' } : null,
                          ]}
                          numberOfLines={1}
                        >
                          {chosenExerciseName ?? 'Chọn bài tập cụ thể (tuỳ chọn)'}
                        </Text>
                        <ChevronRight color={Colors.textMuted} size={16} strokeWidth={2} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Note — edit mode only */}
            {editingId && (
              <>
                <Text style={styles.inputLabel}>Ghi chú (tuỳ chọn)</Text>
                <TextInput
                  style={[styles.input, styles.noteInput]}
                  multiline
                  value={editNote}
                  onChangeText={setEditNote}
                  placeholder="VD: ưu tiên volume vừa, giữ kỹ thuật"
                  placeholderTextColor={Colors.textMuted}
                />
              </>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={submit} disabled={saving}>
              <Text style={styles.saveBtnText}>
                {editingId ? (saving ? 'Đang lưu...' : 'Lưu thay đổi') : createLabel}
              </Text>
            </TouchableOpacity>
            <View style={{ height: 24 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <ExercisePickerSheet
        muscleGroupId={exercisePickerFor}
        muscleGroupName={pickerGroup?.name}
        tone={exercisePickerFor ? colorByMuscle[exercisePickerFor] : undefined}
        chosenExerciseId={exercisePickerFor ? selectedExercises[exercisePickerFor] ?? null : null}
        onPick={(exerciseId) => {
          if (exercisePickerFor) setMuscleExercise(exercisePickerFor, exerciseId);
          setExercisePickerFor(null);
        }}
        onClose={() => setExercisePickerFor(null)}
      />
    </>
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
  sheetTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  inputLabel: { color: Colors.textSecondary, marginBottom: 8, marginTop: 10, fontSize: 12, fontWeight: '600' },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    backgroundColor: Colors.surfaceElevated, color: Colors.text,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  noteInput: { minHeight: 72, textAlignVertical: 'top' },
  errorText: { marginTop: 10, color: Colors.error, fontSize: 12 },
  saveBtn: {
    marginTop: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, backgroundColor: Colors.accent,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Colors.bg, fontWeight: '700', fontSize: 14 },

  filterWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  chipConfigured: { borderColor: Colors.success + '66', backgroundColor: Colors.success + '14' },
  chipActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '1f' },
  chipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: Colors.accent, fontWeight: '700' },

  categoryFilterWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  categoryFilterChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  categoryFilterChipActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '20' },
  categoryFilterChipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  categoryFilterChipTextActive: { color: Colors.accent, fontWeight: '700' },

  musclePickerList: { gap: 6, marginBottom: 4 },
  musclePickerRow: {
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: Colors.surface,
  },
  musclePickerMainRow: { flexDirection: 'row', alignItems: 'center' },
  musclePickerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  musclePickerTextWrap: { flex: 1 },
  musclePickerCheck: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg,
  },
  musclePickerCheckMark: { fontSize: 11, color: Colors.bg, fontWeight: '700', lineHeight: 14 },
  musclePickerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  musclePickerName: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  musclePickerGoalStatus: { fontSize: 10, fontWeight: '700' },
  musclePickerGoalReached: { color: Colors.success },
  musclePickerGoalPending: { color: Colors.warning },
  musclePickerMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  musclePickerSetsWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  musclePickerSetsInput: {
    width: 48, textAlign: 'center', borderWidth: 1.5, borderRadius: 8,
    paddingVertical: 4, paddingHorizontal: 6,
    fontSize: 14, fontWeight: '700', color: Colors.text, backgroundColor: Colors.bg,
  },
  musclePickerSetsUnit: { fontSize: 12, fontWeight: '600' },

  exerciseTriggerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  exerciseTriggerText: { flex: 1, fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
});
