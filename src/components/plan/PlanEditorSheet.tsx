import { useEffect, useMemo, useState } from 'react';
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
  deleteWeeklyPlanEntry,
  upsertWeeklyPlanEntries,
  WEEK_DAYS,
  WeekDayKey,
  WeeklyPlanEntry,
} from '@/src/services/weeklyPlanService';
import { MuscleGroup, Exercise } from '@/src/types/database';
import { ExercisePickerSheet } from './ExercisePickerSheet';
import { ExerciseThumb } from './ExerciseThumb';

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
  exerciseById: Record<string, Exercise>;
  userKey: string;
  activePlanId: string | null;
}

type EntryUpsertPayload = {
  id?: string;
  dayKey: WeekDayKey;
  muscleGroupId: string;
  exerciseId: string | null;
  sets: number;
  reps: number | null;
  sortOrder: number | null;
  note: string;
};

// So khớp danh sách bài tập người dùng chọn (cho 1 nhóm cơ/1 ngày) với các
// entry đã có sẵn — bài nào đã có thì cập nhật (giữ nguyên id), bài mới thì
// tạo entry mới, bài nào bị bỏ chọn thì xoá. Không chọn bài nào = 1 entry
// duy nhất với exerciseId = null (y hệt hành vi cũ, chỉ theo nhóm cơ).
// setsByExerciseId (nếu có) cho phép mỗi bài tập có sets riêng thay vì dùng
// chung 1 giá trị `sets` — dùng khi 1 nhóm cơ có >= 2 bài tập được chọn.
// repsByExerciseId (nếu có) là reps mục tiêu riêng từng bài, tuỳ chọn (null
// = không đặt mục tiêu reps). sortOrder GIỮ NGUYÊN giá trị đã có (thứ tự
// Focus Mode được quản lý riêng qua FocusOrderSheet trong WeeklyPlanScreen.tsx
// — đánh số phẳng xuyên suốt cả ngày, không phân biệt nhóm cơ); bài mới thêm
// vào đây chưa có thứ tự, để null (rơi xuống cuối, xếp bằng tay sau).
export function resolveMuscleEntries(
  dayKey: WeekDayKey,
  muscleGroupId: string,
  sets: number,
  note: string,
  exerciseIds: string[],
  existingEntries: WeeklyPlanEntry[],
  setsByExerciseId?: Record<string, number>,
  repsByExerciseId?: Record<string, number | null>,
): { toUpsert: EntryUpsertPayload[]; toDeleteIds: string[] } {
  const targetIds: (string | null)[] = exerciseIds.length > 0 ? exerciseIds : [null];
  const toUpsert = targetIds.map((exId) => {
    const existing = existingEntries.find((e) => (e.exerciseId ?? null) === exId);
    const rowSets = exId && setsByExerciseId?.[exId] !== undefined ? setsByExerciseId[exId] : sets;
    const rowReps = exId ? repsByExerciseId?.[exId] ?? null : null;
    return {
      id: existing?.id,
      dayKey,
      muscleGroupId,
      exerciseId: exId,
      sets: rowSets,
      reps: rowReps,
      sortOrder: existing?.sortOrder ?? null,
      note,
    };
  });
  const toDeleteIds = existingEntries
    .filter((e) => !targetIds.includes(e.exerciseId ?? null))
    .map((e) => e.id);
  return { toUpsert, toDeleteIds };
}

// Chia đều `total` cho `count` phần, dư ra cộng vào các phần đầu tiên (VD:
// 10 sets / 3 bài -> [4, 3, 3]) — dùng làm giá trị khởi tạo khi thêm bài tập
// mới vào 1 nhóm cơ đã có sets, hoặc khi tạo hàng loạt (không cho chỉnh tay).
export function splitSetsEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

// Bottom sheet để tạo hàng loạt (nhiều ngày/nhiều nhóm cơ) hoặc sửa 1 mục kế
// hoạch — tách khỏi WeeklyPlanScreen để màn chính gọn hơn. Việc chọn bài tập
// cụ thể cho từng nhóm cơ (có thể chọn nhiều bài) được uỷ quyền cho
// ExercisePickerSheet (bottom sheet riêng), tránh chèn ép layout của danh
// sách chọn nhóm cơ.
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
  exerciseById,
  userKey,
  activePlanId,
}: PlanEditorSheetProps) {
  const editingId = request?.type === 'edit' ? request.entry.id : null;
  const editingEntry = request?.type === 'edit' ? request.entry : null;

  const muscleNameById = useMemo(
    () => groups.reduce<Record<string, string>>((acc, g) => { acc[g.id] = g.name; return acc; }, {}),
    [groups],
  );

  const [formDayCreate, setFormDayCreate] = useState<WeekDayKey>('mon');
  const [createDaySelections, setCreateDaySelections] = useState<
    Partial<Record<WeekDayKey, Record<string, string>>>
  >({});
  const [formDaySingle, setFormDaySingle] = useState<WeekDayKey>('mon');
  // Ngày đang hiển thị bất kể mode — dùng để lưu override sets/reps theo đúng
  // ngày (chế độ tạo hàng loạt xử lý nhiều ngày cùng lúc; chế độ sửa cũng cho
  // đổi ngày qua chip nên formDaySingle có thể đổi trong lúc sửa).
  const currentDayKey: WeekDayKey = editingId ? formDaySingle : formDayCreate;
  const [selectedMuscles, setSelectedMuscles] = useState<Record<string, string>>({});
  const [editNote, setEditNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  // Mỗi nhóm cơ có thể gắn NHIỀU bài tập (danh sách id thay vì 1 id duy nhất).
  const [selectedExercises, setSelectedExercises] = useState<Record<string, string[]>>({});
  const [createDayExerciseSelections, setCreateDayExerciseSelections] = useState<
    Partial<Record<WeekDayKey, Record<string, string[]>>>
  >({});
  const [exercisePickerFor, setExercisePickerFor] = useState<string | null>(null);

  // Sets riêng cho từng bài tập khi 1 nhóm cơ có >= 2 bài tập được chọn — dùng
  // chung cho cả tạo mới và sửa. Có thêm lớp theo ngày (dayKey -> muscleGroupId
  // -> exerciseId -> giá trị input) để chế độ tạo hàng loạt (nhiều ngày cùng
  // lúc) giữ đúng override riêng từng ngày mà không cần cơ chế mirror/copy-back
  // như createDaySelections.
  const [exerciseSetsOverride, setExerciseSetsOverride] = useState<
    Partial<Record<WeekDayKey, Record<string, Record<string, string>>>>
  >({});

  // Reps mục tiêu riêng từng bài tập — chỉ có ý nghĩa khi đã chọn bài tập cụ
  // thể, tuỳ chọn (không bắt buộc, để trống = không đặt mục tiêu). Cùng cấu
  // trúc theo ngày như exerciseSetsOverride.
  const [exerciseRepsOverride, setExerciseRepsOverride] = useState<
    Partial<Record<WeekDayKey, Record<string, Record<string, string>>>>
  >({});

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
      // Nạp luôn các bài tập khác (nếu có) đã gắn cho cùng ngày + nhóm cơ này
      // — sửa 1 mục giờ coi như sửa cả "gói" bài tập của nhóm cơ đó trong ngày.
      const siblings = plans.filter((p) => p.dayKey === entry.dayKey && p.muscleGroupId === entry.muscleGroupId);
      const existingIds = siblings.filter((p) => p.exerciseId).map((p) => p.exerciseId as string);
      setSelectedExercises({ [entry.muscleGroupId]: existingIds });
      // Nạp sets thật của từng bài tập (không chia đều lại) để người dùng
      // thấy đúng số hiện có, chỉnh tiếp từ đó.
      const overrideForGroup: Record<string, string> = {};
      const repsOverrideForGroup: Record<string, string> = {};
      siblings.forEach((p) => {
        if (p.exerciseId) {
          overrideForGroup[p.exerciseId] = String(p.sets);
          if (p.reps != null) repsOverrideForGroup[p.exerciseId] = String(p.reps);
        }
      });
      setExerciseSetsOverride({ [entry.dayKey]: { [entry.muscleGroupId]: overrideForGroup } });
      setExerciseRepsOverride({ [entry.dayKey]: { [entry.muscleGroupId]: repsOverrideForGroup } });
      setCreateDayExerciseSelections({});
    } else if (request.type === 'prefill') {
      const sets = String(Math.max(1, Math.round(request.sets)));
      setFormDayCreate(initialDay);
      setCreateDaySelections({ [initialDay]: { [request.muscleGroupId]: sets } });
      setSelectedMuscles({ [request.muscleGroupId]: sets });
      setEditNote('');
      setSelectedExercises({});
      setExerciseSetsOverride({});
      setExerciseRepsOverride({});
      setCreateDayExerciseSelections({});
    } else {
      setFormDayCreate(initialDay);
      setCreateDaySelections({});
      setSelectedMuscles({});
      setEditNote('');
      setSelectedExercises({});
      setExerciseSetsOverride({});
      setExerciseRepsOverride({});
      setCreateDayExerciseSelections({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const persistedPlannedByMuscle = plans.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.muscleGroupId] = (acc[entry.muscleGroupId] || 0) + entry.sets;
    return acc;
  }, {});

  // FIX: draftDeltaByMuscle chỉ dùng cho create mode — edit mode tính riêng
  // trong lúc render để tránh nhầm lẫn.
  const draftDeltaByMuscle: Record<string, number> = {};
  if (!editingId) {
    const existingPlanByDayMuscle = new Map<string, WeeklyPlanEntry>();
    plans.forEach((entry) => {
      existingPlanByDayMuscle.set(`${entry.dayKey}::${entry.muscleGroupId}`, entry);
    });
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
    const turningOn = selectedMuscles[id] === undefined;

    setSelectedMuscles((prev) => {
      let next: Record<string, string>;
      if (!turningOn) {
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
      let next: Record<string, string[]>;
      if (!turningOn) {
        next = { ...prev };
        delete next[id];
      } else {
        // Bật 1 nhóm cơ đã có sẵn kế hoạch cho ngày này thì nạp luôn các bài
        // tập đang gắn sẵn, tránh mất dấu khi người dùng chỉ định sửa sets.
        const existingIds = plans
          .filter((p) => p.dayKey === formDayCreate && p.muscleGroupId === id && p.exerciseId)
          .map((p) => p.exerciseId as string);
        next = { ...prev, [id]: existingIds };
      }
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

  const toggleExerciseForGroup = (muscleGroupId: string, exerciseId: string) => {
    setSelectedExercises((prev) => {
      const current = prev[muscleGroupId] || [];
      const turningOn = !current.includes(exerciseId);
      const next = turningOn
        ? [...current, exerciseId]
        : current.filter((id) => id !== exerciseId);
      const nextMap = { ...prev, [muscleGroupId]: next };
      if (!editingId) {
        setCreateDayExerciseSelections((dayPrev) => ({ ...dayPrev, [formDayCreate]: nextMap }));
      }
      // Bỏ 1 bài -> xoá override tương ứng, giữ nguyên các bài còn lại (tránh
      // mất công người dùng vừa chỉnh tay). Thêm 1 bài mới -> chia lại đều
      // tổng hiện tại cho toàn bộ danh sách mới. Dùng chung cho cả 2 mode,
      // theo đúng ngày đang hiển thị.
      setExerciseSetsOverride((prevOverride) => {
        const dayOverride = prevOverride[currentDayKey] || {};
        const currentOverride = dayOverride[muscleGroupId] || {};
        if (!turningOn) {
          const nextOverride = { ...currentOverride };
          delete nextOverride[exerciseId];
          return { ...prevOverride, [currentDayKey]: { ...dayOverride, [muscleGroupId]: nextOverride } };
        }
        if (next.length >= 2) {
          const total = Number(selectedMuscles[muscleGroupId] || 0) || 0;
          const parts = splitSetsEvenly(total, next.length);
          const nextOverride: Record<string, string> = {};
          next.forEach((id, idx) => { nextOverride[id] = String(parts[idx]); });
          return { ...prevOverride, [currentDayKey]: { ...dayOverride, [muscleGroupId]: nextOverride } };
        }
        return prevOverride;
      });
      // Reps không có khái niệm "tổng" để chia — bỏ chọn thì xoá override,
      // thêm bài mới thì để trống (không ép nhập, không tự điền).
      if (!turningOn) {
        setExerciseRepsOverride((prevOverride) => {
          const dayOverride = prevOverride[currentDayKey] || {};
          const nextOverride = { ...(dayOverride[muscleGroupId] || {}) };
          delete nextOverride[exerciseId];
          return { ...prevOverride, [currentDayKey]: { ...dayOverride, [muscleGroupId]: nextOverride } };
        });
      }
      return nextMap;
    });
  };

  const clearExercisesForGroup = (muscleGroupId: string) => {
    setSelectedExercises((prev) => {
      const nextMap = { ...prev, [muscleGroupId]: [] };
      if (!editingId) {
        setCreateDayExerciseSelections((dayPrev) => ({ ...dayPrev, [formDayCreate]: nextMap }));
      }
      setExerciseSetsOverride((prevOverride) => ({
        ...prevOverride,
        [currentDayKey]: { ...(prevOverride[currentDayKey] || {}), [muscleGroupId]: {} },
      }));
      setExerciseRepsOverride((prevOverride) => ({
        ...prevOverride,
        [currentDayKey]: { ...(prevOverride[currentDayKey] || {}), [muscleGroupId]: {} },
      }));
      return nextMap;
    });
  };

  // Cập nhật sets riêng của 1 bài tập trong nhóm cơ có >= 2 bài — đồng thời
  // dồn lại tổng vào selectedMuscles[muscleGroupId] để mọi tính toán khác
  // (mục tiêu/đã tập/kế hoạch, resolveMuscleEntries) không cần đổi gì thêm.
  const updateExerciseSets = (muscleGroupId: string, exerciseId: string, val: string) => {
    setExerciseSetsOverride((prev) => {
      const dayOverride = prev[currentDayKey] || {};
      const nextGroupOverride = { ...(dayOverride[muscleGroupId] || {}), [exerciseId]: val };
      const total = Object.values(nextGroupOverride).reduce((sum, v) => sum + (Number(v) || 0), 0);
      setSelectedMuscles((prevMuscles) => ({ ...prevMuscles, [muscleGroupId]: String(total) }));
      return { ...prev, [currentDayKey]: { ...dayOverride, [muscleGroupId]: nextGroupOverride } };
    });
  };

  // Reps mục tiêu riêng — không có tổng để dồn lại, chỉ lưu giá trị nhập.
  const updateExerciseReps = (muscleGroupId: string, exerciseId: string, val: string) => {
    setExerciseRepsOverride((prev) => {
      const dayOverride = prev[currentDayKey] || {};
      return {
        ...prev,
        [currentDayKey]: { ...dayOverride, [muscleGroupId]: { ...(dayOverride[muscleGroupId] || {}), [exerciseId]: val } },
      };
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
    // Nhóm cơ có >= 2 bài tập: mỗi bài phải có sets riêng > 0 — áp dụng chung
    // cho cả tạo mới (lặp qua mọi ngày/nhóm cơ đã cấu hình) và sửa (chỉ 1
    // ngày/nhóm cơ đang mở).
    if (editingId) {
      const muscleGroupId = muscleIds[0];
      const exerciseIds = selectedExercises[muscleGroupId] || [];
      if (exerciseIds.length >= 2) {
        const invalid = exerciseIds.some((exId) => {
          const v = Number(exerciseSetsOverride[currentDayKey]?.[muscleGroupId]?.[exId]);
          return !Number.isFinite(v) || v <= 0;
        });
        if (invalid) {
          setError('Mỗi bài tập cần số sets lớn hơn 0.');
          return;
        }
      }
    } else {
      const source = { ...createDaySelections, [formDayCreate]: selectedMuscles };
      const exerciseSource = { ...createDayExerciseSelections, [formDayCreate]: selectedExercises };
      for (const day of WEEK_DAYS) {
        const musclesForDay = source[day.key] || {};
        const exercisesForDay = exerciseSource[day.key] || {};
        for (const [muscleGroupId, setsRaw] of Object.entries(musclesForDay)) {
          const sets = Number(setsRaw);
          if (!Number.isFinite(sets) || sets <= 0) continue;
          const exerciseIds = exercisesForDay[muscleGroupId] || [];
          if (exerciseIds.length >= 2) {
            const invalid = exerciseIds.some((exId) => {
              const v = Number(exerciseSetsOverride[day.key]?.[muscleGroupId]?.[exId]);
              return !Number.isFinite(v) || v <= 0;
            });
            if (invalid) {
              const groupName = groups.find((g) => g.id === muscleGroupId)?.name ?? 'Nhóm cơ đã chọn';
              setError(`${groupName} (${day.label}): mỗi bài tập cần số sets lớn hơn 0.`);
              return;
            }
          }
        }
      }
    }
    setSaving(true);
    try {
      const allUpserts: EntryUpsertPayload[] = [];
      const allDeleteIds: string[] = [];

      if (editingId) {
        const muscleGroupId = muscleIds[0];
        const dayKey = formDaySingle;
        const sets = muscleEntries[0].sets;
        const exerciseIds = selectedExercises[muscleGroupId] || [];
        const existingEntries = plans.filter((p) => p.dayKey === dayKey && p.muscleGroupId === muscleGroupId);
        const setsByExerciseId = exerciseIds.length >= 2
          ? Object.fromEntries(exerciseIds.map((exId) => [exId, Number(exerciseSetsOverride[currentDayKey]?.[muscleGroupId]?.[exId]) || 0]))
          : undefined;
        const repsByExerciseId = exerciseIds.length >= 1
          ? Object.fromEntries(exerciseIds.map((exId) => {
              const raw = exerciseRepsOverride[currentDayKey]?.[muscleGroupId]?.[exId];
              const parsed = Number(raw);
              return [exId, raw && Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null];
            }))
          : undefined;
        const { toUpsert, toDeleteIds } = resolveMuscleEntries(dayKey, muscleGroupId, sets, editNote, exerciseIds, existingEntries, setsByExerciseId, repsByExerciseId);
        allUpserts.push(...toUpsert);
        allDeleteIds.push(...toDeleteIds);
      } else {
        const source = { ...createDaySelections, [formDayCreate]: selectedMuscles };
        const exerciseSource = { ...createDayExerciseSelections, [formDayCreate]: selectedExercises };
        WEEK_DAYS.forEach(({ key }) => {
          const musclesForDay = source[key] || {};
          const exercisesForDay = exerciseSource[key] || {};
          Object.entries(musclesForDay).forEach(([muscleGroupId, setsRaw]) => {
            const sets = Number(setsRaw);
            if (!Number.isFinite(sets) || sets <= 0) return;
            const exerciseIds = exercisesForDay[muscleGroupId] || [];
            const existingEntries = plans.filter((p) => p.dayKey === key && p.muscleGroupId === muscleGroupId);
            const note = existingEntries[0]?.note || '';
            // Sets/reps riêng từng bài — đọc từ override (đã populate sẵn từ
            // lúc chọn bài qua toggleExerciseForGroup, kể cả lần đầu chia đều),
            // giống hệt nhánh sửa.
            const setsByExerciseId = exerciseIds.length >= 2
              ? Object.fromEntries(exerciseIds.map((exId) => [exId, Number(exerciseSetsOverride[key]?.[muscleGroupId]?.[exId]) || 0]))
              : undefined;
            const repsByExerciseId = exerciseIds.length >= 1
              ? Object.fromEntries(exerciseIds.map((exId) => {
                  const raw = exerciseRepsOverride[key]?.[muscleGroupId]?.[exId];
                  const parsed = Number(raw);
                  return [exId, raw && Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null];
                }))
              : undefined;
            const { toUpsert, toDeleteIds } = resolveMuscleEntries(key, muscleGroupId, sets, note, exerciseIds, existingEntries, setsByExerciseId, repsByExerciseId);
            allUpserts.push(...toUpsert);
            allDeleteIds.push(...toDeleteIds);
          });
        });
        if (allUpserts.length === 0) {
          setError('Vui lòng chọn nhóm cơ cho ít nhất một ngày.');
          setSaving(false);
          return;
        }
      }

      let nextPlans = plans;
      if (allUpserts.length > 0) {
        nextPlans = await upsertWeeklyPlanEntries(allUpserts, userKey, activePlanId);
      }
      for (const delId of allDeleteIds) {
        nextPlans = await deleteWeeklyPlanEntry(delId, userKey, activePlanId);
      }
      onSaved(nextPlans);
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

                const chosenExerciseIds = selectedExercises[group.id] || [];
                const chosenNames = chosenExerciseIds.map((id) => exerciseNameById[id]).filter(Boolean);
                const triggerLabel = chosenNames.length === 0
                  ? 'Chọn bài tập cụ thể (tuỳ chọn)'
                  : chosenNames.length <= 2
                    ? chosenNames.join(', ')
                    : `${chosenNames[0]}, ${chosenNames[1]} +${chosenNames.length - 2} bài khác`;

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
                        <Text style={[styles.musclePickerName, isChosen && { color: col?.badgeText ?? Colors.accent, fontWeight: '700' }]} numberOfLines={1}>
                          {group.name}
                        </Text>
                      </TouchableOpacity>

                      <View
                        style={[
                          styles.musclePickerGoalBadge,
                          reached ? styles.musclePickerGoalReachedBadge : styles.musclePickerGoalPendingBadge,
                        ]}
                      >
                        <Text style={[styles.musclePickerGoalStatus, reached ? styles.musclePickerGoalReached : styles.musclePickerGoalPending]}>
                          {reached ? 'Đủ' : `Thiếu ${remain}`}
                        </Text>
                      </View>

                      {isChosen && !(chosenExerciseIds.length >= 2) && (
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
                      {isChosen && chosenExerciseIds.length >= 2 && (
                        <Text style={[styles.musclePickerSetsTotalReadonly, { color: col?.badgeText ?? Colors.accent }]}>
                          Tổng {selectedMuscles[group.id] || 0} sets
                        </Text>
                      )}
                    </View>

                    {/* Thống kê rút gọn — 1 dòng chữ mờ thay vì 3 pill viền
                        riêng, đỡ rối mắt khi có nhiều nhóm cơ đã chọn. */}
                    <Text style={styles.musclePickerStatsLine}>
                      Mục tiêu {targetSets}s · Đã tập {weekProgressLoading ? '…' : actualWeeklySets}s · Kế hoạch {projectedPlannedSets}s
                    </Text>

                    {/* Dòng trigger gọn, mở sheet chọn bài tập riêng (chọn được nhiều bài) */}
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
                            chosenNames.length > 0 ? { color: col?.badgeText ?? Colors.text, fontWeight: '600' } : null,
                          ]}
                          numberOfLines={1}
                        >
                          {triggerLabel}
                        </Text>
                        <ChevronRight color={Colors.textMuted} size={16} strokeWidth={2} />
                      </TouchableOpacity>
                    )}

                    {/* Sets/reps riêng từng bài — dùng chung cho cả tạo mới
                        và sửa. Sets riêng chỉ cần khi >= 2 bài (khi chỉ 1
                        bài, sets đã có ở ô chung phía trên); reps mục tiêu
                        thì luôn hiện vì nó vốn là thuộc tính riêng từng bài,
                        không có "tổng" để gộp. */}
                    {chosenExerciseIds.length >= 1 && (
                      <View style={styles.exerciseSetsBreakdown}>
                        {chosenExerciseIds.map((exId) => (
                          <View key={exId} style={styles.exerciseSetsBreakdownRow}>
                            {exerciseById[exId] ? (
                              <ExerciseThumb ex={exerciseById[exId]} tone={col} size={26} />
                            ) : null}
                            <Text style={styles.exerciseSetsBreakdownName} numberOfLines={1}>
                              {exerciseNameById[exId] || 'Bài tập'}
                            </Text>
                            {chosenExerciseIds.length >= 2 && (
                              <TextInput
                                style={[styles.exerciseSetsBreakdownInput, { borderColor: col?.bar ?? Colors.accent }]}
                                keyboardType="number-pad"
                                value={exerciseSetsOverride[currentDayKey]?.[group.id]?.[exId] ?? ''}
                                onChangeText={(val) => updateExerciseSets(group.id, exId, val)}
                                placeholder="sets"
                                placeholderTextColor={Colors.textMuted}
                                selectTextOnFocus
                              />
                            )}
                            <TextInput
                              style={[styles.exerciseRepsBreakdownInput, { borderColor: col?.bar ?? Colors.accent }]}
                              keyboardType="number-pad"
                              value={exerciseRepsOverride[currentDayKey]?.[group.id]?.[exId] ?? ''}
                              onChangeText={(val) => updateExerciseReps(group.id, exId, val)}
                              placeholder="reps"
                              placeholderTextColor={Colors.textMuted}
                              selectTextOnFocus
                            />
                          </View>
                        ))}
                      </View>
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
        chosenExerciseIds={exercisePickerFor ? selectedExercises[exercisePickerFor] || [] : []}
        onToggle={(exerciseId) => {
          if (exercisePickerFor) toggleExerciseForGroup(exercisePickerFor, exerciseId);
        }}
        onClearAll={() => {
          if (exercisePickerFor) clearExercisesForGroup(exercisePickerFor);
        }}
        onDone={() => setExercisePickerFor(null)}
        muscleNameById={muscleNameById}
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

  musclePickerList: { gap: 8, marginBottom: 4 },
  musclePickerRow: {
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: Colors.surface,
  },
  musclePickerMainRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  musclePickerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  musclePickerCheck: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg, flexShrink: 0,
  },
  musclePickerCheckMark: { fontSize: 11, color: Colors.bg, fontWeight: '700', lineHeight: 14 },
  musclePickerName: { fontSize: 14, color: Colors.text, fontWeight: '500', flexShrink: 1 },
  musclePickerGoalBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, flexShrink: 0 },
  musclePickerGoalReachedBadge: { backgroundColor: Colors.success + '18' },
  musclePickerGoalPendingBadge: { backgroundColor: Colors.warning + '18' },
  musclePickerGoalStatus: { fontSize: 10, fontWeight: '700' },
  musclePickerGoalReached: { color: Colors.success },
  musclePickerGoalPending: { color: Colors.warning },
  musclePickerStatsLine: { fontSize: 11, color: Colors.textMuted, marginTop: 8 },
  musclePickerSetsWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  musclePickerSetsInput: {
    width: 48, textAlign: 'center', borderWidth: 1.5, borderRadius: 8,
    paddingVertical: 4, paddingHorizontal: 6,
    fontSize: 14, fontWeight: '700', color: Colors.text, backgroundColor: Colors.bg,
  },
  musclePickerSetsUnit: { fontSize: 12, fontWeight: '600' },
  musclePickerSetsTotalReadonly: { fontSize: 13, fontWeight: '700', flexShrink: 0 },

  exerciseTriggerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  exerciseTriggerText: { flex: 1, fontSize: 12, color: Colors.textMuted, fontWeight: '500' },

  exerciseSetsBreakdown: { gap: 6, marginTop: 8 },
  exerciseSetsBreakdownRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    backgroundColor: Colors.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6,
  },
  exerciseSetsBreakdownName: { flex: 1, fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  exerciseSetsBreakdownInput: {
    width: 44, textAlign: 'center', borderWidth: 1.5, borderRadius: 8,
    paddingVertical: 3, paddingHorizontal: 4,
    fontSize: 13, fontWeight: '700', color: Colors.text, backgroundColor: Colors.surfaceElevated,
  },
  exerciseRepsBreakdownInput: {
    width: 52, textAlign: 'center', borderWidth: 1.5, borderRadius: 8,
    paddingVertical: 3, paddingHorizontal: 4,
    fontSize: 12, fontWeight: '600', color: Colors.text, backgroundColor: Colors.surfaceElevated,
  },
});
