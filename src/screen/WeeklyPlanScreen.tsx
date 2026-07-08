import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  AppState,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronDown, Plus, Pencil, Trash2, Flame } from 'lucide-react-native';
import { getMuscleGroups, getWorkoutLogs, getExercises } from '@/src/lib/repository';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/context/AuthContext';
import { getGroupTone } from '@/src/lib/planTone';
import { PlanEditorSheet, PlanEditorRequest } from '@/src/components/plan/PlanEditorSheet';
import { PlanManagerSheet } from '@/src/components/plan/PlanManagerSheet';
import { ExerciseThumb } from '@/src/components/plan/ExerciseThumb';
import {
  deleteWeeklyPlanEntry,
  getWeeklyPlanEntries,
  getWorkoutPlans,
  WEEK_DAYS,
  WeekDayKey,
  WeeklyPlanEntry,
  WorkoutPlan,
} from '@/src/services/weeklyPlanService';
import { MuscleGroup, Exercise } from '@/src/types/database';

type MuscleGroupWithCount = MuscleGroup & { exercise_count?: number };

// 1 thẻ hiển thị/nhóm cơ trong 1 ngày, gộp mọi bài tập (entry) được gán cho
// nhóm cơ đó — thay cho việc hiển thị phẳng từng dòng weekly_plan_entries.
type MuscleGroupCard = {
  muscleGroupId: string;
  entries: WeeklyPlanEntry[];
  totalSets: number;
};

// ─── Signature palette (bảng điểm phòng gym) ─────────────────────────────────
// Ink + chalk-lime: nền tối như bảng phấn trong phòng gym, điểm nhấn màu
// "chalk lime" cho phần trọng tâm / được chọn (accent chính), và xanh lá
// riêng (GREEN) dành cho trạng thái "đã hoàn thành" — tách biệt 2 ý nghĩa để
// không bị lẫn màu. Không đụng tới Colors global để không phá vỡ theme các
// màn khác.
const INK = '#0E1210';
const INK_RAISED = '#161C19';
const CHALK = '#F3F6EF';
const LIME = '#D6FF3F';
const LIME_DIM = 'rgba(214,255,63,0.16)';
// Xanh lá cho trạng thái "đã hoàn thành" — khác với LIME (màu nhấn chính)
const GREEN = '#34D399';
const GREEN_DIM = 'rgba(52,211,153,0.16)';
const HAIRLINE = 'rgba(243,246,239,0.10)';

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_LABEL_FULL: Record<WeekDayKey, string> = {
  mon: 'Thứ 2', tue: 'Thứ 3', wed: 'Thứ 4',
  thu: 'Thứ 5', fri: 'Thứ 6', sat: 'Thứ 7', sun: 'Chủ nhật',
};

const DAY_ORDER_MAP: Record<WeekDayKey, number> = WEEK_DAYS.reduce((acc, day) => {
  acc[day.key] = day.order;
  return acc;
}, {} as Record<WeekDayKey, number>);

function sortPlans(plans: WeeklyPlanEntry[]) {
  return [...plans].sort((a, b) => {
    const orderDiff = DAY_ORDER_MAP[a.dayKey] - DAY_ORDER_MAP[b.dayKey];
    if (orderDiff !== 0) return orderDiff;
    if (a.muscleGroupId !== b.muscleGroupId) return a.muscleGroupId.localeCompare(b.muscleGroupId);
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function getDateForDayKey(key: WeekDayKey): Date {
  const jsDay = new Date().getDay();
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date();
  monday.setDate(monday.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const offsets: Record<WeekDayKey, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
  const d = new Date(monday);
  d.setDate(monday.getDate() + offsets[key]);
  return d;
}

function getTodayKey(): WeekDayKey | null {
  const map: Record<number, WeekDayKey> = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat', 0: 'sun' };
  return map[new Date().getDay()] ?? null;
}

function formatShortDate(d: Date) {
  return `${d.getDate()} thg ${d.getMonth() + 1}`;
}

function getDayBounds(dayKey: WeekDayKey) {
  const date = getDateForDayKey(dayKey);
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(date); end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday.toISOString(), end: sunday.toISOString() };
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function WeeklyPlanScreen() {
  const { user } = useAuth();
  const userKey = user?.id || 'guest';
  const todayKey = getTodayKey();
  const dayScrollRef = useRef<ScrollView>(null);
  const dayProgressCacheRef = useRef<Partial<Record<WeekDayKey, Record<string, number>>>>({});

  const [groups, setGroups] = useState<MuscleGroupWithCount[]>([]);
  const [plans, setPlans] = useState<WeeklyPlanEntry[]>([]);
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [showPlanManager, setShowPlanManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actualSetsByMuscle, setActualSetsByMuscle] = useState<Record<string, number>>({});
  const [weeklyActualSetsByMuscle, setWeeklyActualSetsByMuscle] = useState<Record<string, number>>({});
  const [dayProgressLoading, setDayProgressLoading] = useState(false);
  const [weekProgressLoading, setWeekProgressLoading] = useState(false);
  const [exerciseNameById, setExerciseNameById] = useState<Record<string, string>>({});
  const [exerciseById, setExerciseById] = useState<Record<string, Exercise>>({});

  const [selectedDay, setSelectedDay] = useState<WeekDayKey>(todayKey ?? 'mon');
  const selectedDayRef = useRef<WeekDayKey>(todayKey ?? 'mon');
  selectedDayRef.current = selectedDay;

  const [editorRequest, setEditorRequest] = useState<PlanEditorRequest | null>(null);

  // ── Data loading ──

  const load = useCallback(async () => {
    const [nextGroups, nextWorkoutPlans, allExercises] = await Promise.all([
      getMuscleGroups() as Promise<MuscleGroupWithCount[]>,
      getWorkoutPlans(userKey),
      getExercises() as Promise<Exercise[]>,
    ]);
    setGroups(nextGroups);
    setWorkoutPlans(nextWorkoutPlans);
    setExerciseNameById(
      allExercises.reduce<Record<string, string>>((acc, ex) => { acc[ex.id] = ex.name; return acc; }, {}),
    );
    setExerciseById(
      allExercises.reduce<Record<string, Exercise>>((acc, ex) => { acc[ex.id] = ex; return acc; }, {}),
    );

    const active = nextWorkoutPlans.find((p) => p.isActive) ?? nextWorkoutPlans[0] ?? null;
    setActivePlanId(active?.id ?? null);

    const nextPlans = await getWeeklyPlanEntries(userKey, active?.id ?? null);
    setPlans(sortPlans(nextPlans));
  }, [userKey]);

  const loadDayProgress = useCallback(async (dayKey: WeekDayKey, options?: { force?: boolean }) => {
    const cached = dayProgressCacheRef.current[dayKey];
    if (!options?.force && cached) {
      setActualSetsByMuscle(cached);
      return;
    }
    setDayProgressLoading(true);
    try {
      const { start, end } = getDayBounds(dayKey);
      const logs = await getWorkoutLogs(start, end);
      const nextMap = logs.reduce<Record<string, number>>((acc, log: any) => {
        const muscleGroupId = log.muscle_group_id;
        acc[muscleGroupId] = (acc[muscleGroupId] || 0) + Number(log.sets || 0);
        return acc;
      }, {});
      dayProgressCacheRef.current[dayKey] = nextMap;
      setActualSetsByMuscle(nextMap);
    } finally {
      setDayProgressLoading(false);
    }
  }, []);

  const loadWeekProgress = useCallback(async () => {
    setWeekProgressLoading(true);
    try {
      const { start, end } = getWeekBounds();
      const logs = await getWorkoutLogs(start, end);
      const nextMap = logs.reduce<Record<string, number>>((acc, log: any) => {
        const muscleGroupId = log.muscle_group_id;
        acc[muscleGroupId] = (acc[muscleGroupId] || 0) + Number(log.sets || 0);
        return acc;
      }, {});
      setWeeklyActualSetsByMuscle(nextMap);
    } finally {
      setWeekProgressLoading(false);
    }
  }, []);

  // FIX: reload khi app quay lại foreground (đã sync ở background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        dayProgressCacheRef.current = {};
        Promise.all([
          load(),
          loadWeekProgress(),
          loadDayProgress(selectedDayRef.current, { force: true }),
        ]);
      }
    });
    return () => subscription.remove();
  }, [load, loadDayProgress, loadWeekProgress]);

  const onRefresh = async () => {
    setRefreshing(true);
    dayProgressCacheRef.current = {};
    await Promise.all([
      load(),
      loadWeekProgress(),
      loadDayProgress(selectedDay, { force: true }),
    ]);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      // FIX: invalidate cache khi focus lại tab để lấy workout logs mới nhất
      dayProgressCacheRef.current = {};
      Promise.all([
        load(),
        loadWeekProgress(),
        loadDayProgress(selectedDayRef.current, { force: true }),
      ]).finally(() => setLoading(false));
    }, [load, loadDayProgress, loadWeekProgress]),
  );

  // ── Derived data ──

  const activePlanName = useMemo(
    () => workoutPlans.find((p) => p.id === activePlanId)?.name ?? 'Kế hoạch tuần',
    [workoutPlans, activePlanId],
  );

  const muscleNameById = useMemo(() =>
    groups.reduce<Record<string, string>>((acc, g) => { acc[g.id] = g.name; return acc; }, {}),
    [groups]);

  const targetSetsByMuscle = useMemo(() =>
    groups.reduce<Record<string, number>>((acc, group) => {
      acc[group.id] = Number(group.target_sets_per_week || 0);
      return acc;
    }, {}),
    [groups]);

  const colorByMuscle = useMemo(() => {
    const map: Record<string, ReturnType<typeof getGroupTone>> = {};
    groups.forEach((g) => { map[g.id] = getGroupTone(g.color); });
    return map;
  }, [groups]);

  const totalWeeklySets = useMemo(() => plans.reduce((s, e) => s + e.sets, 0), [plans]);
  const totalWeeklyActualSets = useMemo(
    () => Object.values(weeklyActualSetsByMuscle).reduce((sum, val) => sum + val, 0),
    [weeklyActualSetsByMuscle],
  );
  const activeDays = useMemo(() => new Set(plans.map((p) => p.dayKey)).size, [plans]);
  const weekPct = totalWeeklySets > 0 ? Math.min(totalWeeklyActualSets / totalWeeklySets, 1) : 0;

  const byDay = useMemo(() => {
    const map: Record<WeekDayKey, WeeklyPlanEntry[]> = {} as any;
    WEEK_DAYS.forEach((d) => { map[d.key] = []; });
    plans.forEach((p) => map[p.dayKey]?.push(p));
    return map;
  }, [plans]);

  // Gộp các dòng cùng nhóm cơ (nhiều bài tập/1 nhóm cơ/1 ngày) thành 1 thẻ —
  // plans đã được sortPlans() sắp theo dayKey -> muscleGroupId nên các dòng
  // cùng nhóm cơ luôn nằm liền kề nhau, Map giữ đúng thứ tự xuất hiện đầu tiên.
  function groupEntriesByMuscle(entries: WeeklyPlanEntry[]): MuscleGroupCard[] {
    const map = new Map<string, WeeklyPlanEntry[]>();
    entries.forEach((entry) => {
      const arr = map.get(entry.muscleGroupId) || [];
      arr.push(entry);
      map.set(entry.muscleGroupId, arr);
    });
    return Array.from(map.entries()).map(([muscleGroupId, groupEntries]) => ({
      muscleGroupId,
      entries: groupEntries,
      totalSets: groupEntries.reduce((sum, e) => sum + e.sets, 0),
    }));
  }

  const setsPerDay = useMemo(() => {
    const map: Record<WeekDayKey, number> = {} as any;
    WEEK_DAYS.forEach((d) => { map[d.key] = byDay[d.key].reduce((s, e) => s + e.sets, 0); });
    return map;
  }, [byDay]);

  const dayActualTotal = useMemo(
    () => Object.values(actualSetsByMuscle).reduce((sum, val) => sum + val, 0),
    [actualSetsByMuscle],
  );

  const selectedEntries = useMemo(() => byDay[selectedDay] ?? [], [byDay, selectedDay]);
  const selectedMuscleGroups = useMemo(
    () => groupEntriesByMuscle(selectedEntries),
    [selectedEntries],
  );
  const selectedEntryIds = useMemo(
    () => new Set(selectedMuscleGroups.map((group) => group.muscleGroupId)),
    [selectedMuscleGroups],
  );
  const outOfPlanEntries = useMemo(() => {
    return Object.entries(actualSetsByMuscle)
      .filter(([muscleGroupId, actualSets]) => actualSets > 0 && !selectedEntryIds.has(muscleGroupId))
      .map(([muscleGroupId, actualSets]) => ({ muscleGroupId, actualSets }))
      .sort((a, b) => {
        const nameA = muscleNameById[a.muscleGroupId] ?? '';
        const nameB = muscleNameById[b.muscleGroupId] ?? '';
        return nameA.localeCompare(nameB, 'vi');
      });
  }, [actualSetsByMuscle, muscleNameById, selectedEntryIds]);

  // ── Editor / plan-manager launchers ──

  const openCreate = () => setEditorRequest({ type: 'create' });
  const openEdit = (entry: WeeklyPlanEntry) => setEditorRequest({ type: 'edit', entry });
  const openAddToPlanFromOutside = (muscleGroupId: string, sets: number) =>
    setEditorRequest({ type: 'prefill', muscleGroupId, sets });

  const remove = async (id: string) => {
    const nextPlans = await deleteWeeklyPlanEntry(id, userKey, activePlanId);
    setPlans(sortPlans(nextPlans));
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={LIME} />
        <Text style={[styles.loadingText, { marginTop: 12 }]}>Đang tải bảng điểm...</Text>
      </View>
    );
  }

  const selectedDate = getDateForDayKey(selectedDay);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LIME} />}
      >
        {/* ── Header: bảng tên vận động viên ── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.eyebrow}>KẾ HOẠCH · TUẦN NÀY</Text>
              <TouchableOpacity style={styles.planSelector} onPress={() => setShowPlanManager(true)} activeOpacity={0.7}>
                <Text style={styles.title} numberOfLines={1}>{activePlanName}</Text>
                <ChevronDown color={CHALK} size={20} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={openCreate} activeOpacity={0.85}>
              <Plus color={INK} size={20} strokeWidth={3} />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>
            Chỉ để theo dõi — bạn vẫn tập linh hoạt theo thực tế.
            {workoutPlans.length > 1 ? ` · ${workoutPlans.length} kế hoạch` : ''}
          </Text>
        </View>

        {/* ── Scoreboard: tiến độ tuần dạng bảng điểm lớn ── */}
        <View style={styles.scoreboard}>
          <View style={styles.scoreboardTopRow}>
            <Flame color={LIME} size={14} strokeWidth={2.5} />
            <Text style={styles.scoreboardLabel}>TỔNG SETS TUẦN NÀY</Text>
          </View>
          <View style={styles.scoreboardBigRow}>
            <Text style={styles.scoreboardBig}>
              {weekProgressLoading ? '—' : totalWeeklyActualSets}
            </Text>
            <Text style={styles.scoreboardBigSlash}>/</Text>
            <Text style={styles.scoreboardBigTarget}>{totalWeeklySets}</Text>
          </View>
          <View style={styles.scoreboardTrack}>
            <View style={[styles.scoreboardFill, { width: `${Math.round(weekPct * 100)}%` }]} />
          </View>
          <View style={styles.scoreboardFooterRow}>
            <Text style={styles.scoreboardFooterText}>{Math.round(weekPct * 100)}% hoàn thành</Text>
            <View style={styles.scoreboardDivider} />
            <Text style={styles.scoreboardFooterText}>{activeDays}/7 ngày có lịch</Text>
          </View>
        </View>

        {/* ── Day picker: dải thẻ vuông bo góc theo tuần ── */}
        <ScrollView
          ref={dayScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayStrip}
        >
          {WEEK_DAYS.map((day) => {
            const isSelected = selectedDay === day.key;
            const isToday = todayKey === day.key;
            const hasEntries = (byDay[day.key]?.length ?? 0) > 0;
            const date = getDateForDayKey(day.key);
            return (
              <TouchableOpacity
                key={day.key}
                style={[
                  styles.dayPlate,
                  hasEntries && styles.dayPlateLoaded,
                  isSelected && styles.dayPlateActive,
                  !isSelected && isToday && styles.dayPlateToday,
                ]}
                onPress={() => {
                  selectedDayRef.current = day.key;
                  setSelectedDay(day.key);
                  void loadDayProgress(day.key);
                }}
                activeOpacity={0.75}
              >
                <Text
                  style={[styles.dayPlateAbbr, isSelected && styles.dayPlateAbbrActive]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {day.label}
                </Text>
                <Text style={[styles.dayPlateNum, isSelected && styles.dayPlateNumActive]}>
                  {date.getDate()}
                </Text>
                {isToday && !isSelected ? <View style={styles.dayPlateTodayDot} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Selected day detail ── */}
        <View style={styles.dayDetail}>
          <View style={styles.dayDetailHeader}>
            <View style={styles.dayDetailTitleRow}>
              <View style={styles.dayDetailTick} />
              <Text style={styles.dayDetailTitle}>{DAY_LABEL_FULL[selectedDay].toUpperCase()}</Text>
              {selectedDay === todayKey && (
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>HÔM NAY</Text>
                </View>
              )}
            </View>
            <Text style={styles.dayDetailDate}>
              {formatShortDate(selectedDate)}
              {setsPerDay[selectedDay] > 0
                ? `  ·  ${dayProgressLoading ? '…' : dayActualTotal}/${setsPerDay[selectedDay]} sets`
                : `  ·  ${dayProgressLoading ? '…' : dayActualTotal} sets`}
            </Text>
          </View>

          {selectedMuscleGroups.length === 0 && outOfPlanEntries.length === 0 ? (
            <View style={styles.dayRestRow}>
              <Text style={styles.dayRestText}>Nghỉ ngơi — chưa có lịch tập</Text>
              <TouchableOpacity style={styles.dayAddInline} onPress={openCreate}>
                <Plus size={12} color={LIME} strokeWidth={2.5} />
                <Text style={styles.dayAddInlineText}>Thêm</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.daySections}>
              {selectedMuscleGroups.length > 0 && (
                <View style={styles.muscleList}>
                  {selectedMuscleGroups.map((group, idx) => {
                    const col = colorByMuscle[group.muscleGroupId] ?? getGroupTone();
                    const isLast = idx === selectedMuscleGroups.length - 1;
                    const actualSets = actualSetsByMuscle[group.muscleGroupId] ?? 0;
                    const targetSets = targetSetsByMuscle[group.muscleGroupId] ?? 0;
                    const totalSets = group.totalSets;
                    const pct = totalSets > 0 ? Math.min(actualSets / totalSets, 1) : 0;
                    const done = actualSets >= totalSets && totalSets > 0;
                    // "Xong" dùng GREEN (xanh lá) thay vì LIME để tách biệt với màu nhấn chính
                    const accent = done ? GREEN : col.bar;
                    return (
                      <View key={group.muscleGroupId} style={[styles.muscleCard, !isLast && { marginBottom: 10 }]}>
                        <View style={[styles.muscleCardStripe, { backgroundColor: accent }]} />
                        <View style={styles.muscleCardBody}>
                          <View style={styles.muscleCardHeader}>
                            <Text style={styles.muscleName} numberOfLines={1}>
                              {(muscleNameById[group.muscleGroupId] ?? 'Nhóm cơ đã xoá').toUpperCase()}
                            </Text>
                            <TouchableOpacity
                              style={styles.cardEditBtn}
                              onPress={() => openEdit(group.entries[0])}
                              hitSlop={8}
                            >
                              <Pencil color={CHALK} size={13} strokeWidth={2} />
                            </TouchableOpacity>
                          </View>

                          <View style={styles.muscleCardStatsRow}>
                            <Text style={[styles.setsNow, done && { color: GREEN }]}>
                              {dayProgressLoading ? '…' : actualSets}
                              <Text style={styles.setsDivider}> / {totalSets} sets</Text>
                            </Text>
                            <View style={[styles.statusPill, done && styles.statusPillDone]}>
                              <Text style={[styles.statusPillText, done && { color: GREEN }]}>
                                {done ? '✓ XONG' : `${targetSets} S/TUẦN`}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: accent }]} />
                          </View>

                          <View style={styles.exerciseSubList}>
                            {group.entries.map((entry) => {
                              const ex = entry.exerciseId ? exerciseById[entry.exerciseId] : null;
                              return (
                                <View key={entry.id} style={styles.exerciseSubRow}>
                                  {ex ? (
                                    <ExerciseThumb ex={ex} tone={col} size={30} />
                                  ) : (
                                    <View style={[styles.exerciseSubThumbEmpty, { borderColor: col.badgeBorder }]} />
                                  )}
                                  <View style={styles.exerciseSubInfo}>
                                    <View style={styles.exerciseSubNameRow}>
                                      <Text style={styles.exerciseSubName} numberOfLines={1}>
                                        {ex?.name ?? 'Chưa chọn bài tập'}
                                      </Text>
                                      {ex?.exercise_type ? (
                                        <View style={[styles.exerciseTypeTag, { backgroundColor: col.badgeBg, borderColor: col.badgeBorder }]}>
                                          <Text style={[styles.exerciseTypeTagText, { color: col.badgeText }]}>
                                            {ex.exercise_type === 'compound' ? 'C' : 'I'}
                                          </Text>
                                        </View>
                                      ) : null}
                                    </View>
                                    {entry.note ? (
                                      <Text style={styles.exerciseSubNote} numberOfLines={1}>{entry.note}</Text>
                                    ) : null}
                                  </View>
                                  <View style={styles.exerciseSubSetsPill}>
                                    <Text style={styles.exerciseSubSetsPillText}>{entry.sets}</Text>
                                  </View>
                                  <TouchableOpacity style={styles.exerciseSubDeleteBtn} onPress={() => remove(entry.id)} hitSlop={8}>
                                    <Trash2 color={Colors.error} size={14} strokeWidth={2} />
                                  </TouchableOpacity>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {outOfPlanEntries.length > 0 && (
                <View style={styles.outOfPlanSection}>
                  <View style={styles.outOfPlanHeader}>
                    <Text style={styles.outOfPlanTitle}>NGOÀI KẾ HOẠCH</Text>
                    <Text style={styles.outOfPlanSub}>Đã tập nhưng chưa có trong lịch hôm nay</Text>
                  </View>
                  {outOfPlanEntries.map((item, idx) => (
                    <View key={item.muscleGroupId} style={[styles.outOfPlanCard, idx > 0 && { marginTop: 8 }]}>
                      <View style={styles.outOfPlanDot} />
                      <View style={styles.muscleInfo}>
                        <Text style={styles.outOfPlanName} numberOfLines={1}>
                          {muscleNameById[item.muscleGroupId] ?? 'Nhóm cơ đã xoá'}
                        </Text>
                        <Text style={styles.muscleNote} numberOfLines={1}>
                          {dayProgressLoading ? '…' : item.actualSets} sets đã tập
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.outOfPlanAddBtn}
                        onPress={() => openAddToPlanFromOutside(item.muscleGroupId, item.actualSets)}
                      >
                        <Text style={styles.outOfPlanAddBtnText}>THÊM VÀO KH</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {groups.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Chưa có nhóm cơ</Text>
            <Text style={styles.emptyText}>Vào tab Nhóm cơ để tạo nhóm cơ trước khi lập kế hoạch tuần.</Text>
          </View>
        )}
      </ScrollView>

      <PlanEditorSheet
        request={editorRequest}
        onClose={() => setEditorRequest(null)}
        onSaved={(nextPlans) => setPlans(sortPlans(nextPlans))}
        initialDay={selectedDay}
        groups={groups}
        plans={plans}
        colorByMuscle={colorByMuscle}
        weeklyActualSetsByMuscle={weeklyActualSetsByMuscle}
        weekProgressLoading={weekProgressLoading}
        exerciseNameById={exerciseNameById}
        exerciseById={exerciseById}
        userKey={userKey}
        activePlanId={activePlanId}
      />

      <PlanManagerSheet
        visible={showPlanManager}
        onClose={() => setShowPlanManager(false)}
        workoutPlans={workoutPlans}
        activePlanId={activePlanId}
        userKey={userKey}
        onWorkoutPlansChange={setWorkoutPlans}
        onActivePlanChange={setActivePlanId}
        onPlansReload={(nextPlans) => setPlans(sortPlans(nextPlans))}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
// Hướng thiết kế: "bảng điểm phòng gym" — nền mực đen (INK), số liệu lớn kiểu
// scoreboard, LIME là accent chính (nút thêm, ngày đang chọn, thanh tiến độ
// tuần), GREEN riêng cho trạng thái "đã hoàn thành" ở từng nhóm cơ, mọi thứ
// còn lại giữ tông trầm, viền hairline mảnh thay cho shadow mềm mại.

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: INK },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 13, color: CHALK, opacity: 0.6, letterSpacing: 0.5 },
  content: { paddingBottom: 40 },

  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  headerTitleWrap: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: LIME, marginBottom: 6 },
  planSelector: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { fontSize: 30, fontWeight: '800', color: CHALK, letterSpacing: -0.8, flexShrink: 1 },
  subtitle: { marginTop: 10, fontSize: 12, color: CHALK, opacity: 0.5, lineHeight: 18 },
  addBtn: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: LIME, alignItems: 'center', justifyContent: 'center',
  },

  // Scoreboard — panel số liệu lớn thay cho 2 statCard nhỏ
  scoreboard: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: INK_RAISED, borderRadius: 18,
    borderWidth: 1, borderColor: HAIRLINE,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14,
  },
  scoreboardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  scoreboardLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: CHALK, opacity: 0.55 },
  scoreboardBigRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  scoreboardBig: { fontSize: 52, fontWeight: '800', color: CHALK, letterSpacing: -1.5, lineHeight: 54 },
  scoreboardBigSlash: { fontSize: 26, fontWeight: '400', color: CHALK, opacity: 0.3, marginBottom: 4 },
  scoreboardBigTarget: { fontSize: 26, fontWeight: '700', color: CHALK, opacity: 0.4, marginBottom: 4 },
  scoreboardTrack: { height: 6, borderRadius: 999, backgroundColor: 'rgba(243,246,239,0.08)', overflow: 'hidden', marginTop: 12 },
  scoreboardFill: { height: '100%', borderRadius: 999, backgroundColor: LIME },
  scoreboardFooterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  scoreboardFooterText: { fontSize: 11, color: CHALK, opacity: 0.55, fontWeight: '600' },
  scoreboardDivider: { width: 1, height: 10, backgroundColor: HAIRLINE },

  // Day strip — thẻ vuông bo góc thay cho hình tròn: rộng rãi hơn cho label
  // dài như "Chủ nhật", có đệm ngang để chữ không dí sát viền, và tự co cỡ
  // chữ (adjustsFontSizeToFit) làm lớp bảo hiểm thứ hai.
  dayStrip: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  dayPlate: {
    alignItems: 'center', justifyContent: 'center', gap: 2,
    width: 54, height: 58, borderRadius: 16,
    borderWidth: 1.5, borderColor: HAIRLINE, backgroundColor: INK_RAISED,
    paddingHorizontal: 4,
  },
  dayPlateLoaded: { borderColor: 'rgba(214,255,63,0.35)' },
  dayPlateActive: {
    backgroundColor: LIME, borderColor: LIME,
    shadowColor: LIME, shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  dayPlateToday: { borderColor: LIME, borderWidth: 1.5 },
  dayPlateAbbr: {
    fontSize: 10, fontWeight: '800', letterSpacing: 0.2,
    color: CHALK, opacity: 0.55, textAlign: 'center',
    maxWidth: 44,
  },
  dayPlateAbbrActive: { color: INK, opacity: 0.75 },
  dayPlateNum: { fontSize: 17, fontWeight: '800', color: CHALK },
  dayPlateNumActive: { color: INK },
  dayPlateTodayDot: {
    position: 'absolute', top: 6, right: 6,
    width: 5, height: 5, borderRadius: 2.5, backgroundColor: LIME,
  },

  dayDetail: {
    marginHorizontal: 20, marginBottom: 4,
    borderWidth: 1, borderColor: HAIRLINE, borderRadius: 18,
    backgroundColor: INK_RAISED, overflow: 'hidden',
  },
  dayDetailHeader: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: HAIRLINE,
  },
  dayDetailTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  dayDetailTick: { width: 3, height: 14, borderRadius: 2, backgroundColor: LIME },
  dayDetailTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 0.6, color: CHALK },
  todayBadge: { backgroundColor: LIME, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  todayBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4, color: INK },
  dayDetailDate: { fontSize: 11, color: CHALK, opacity: 0.5, marginLeft: 11 },

  dayRestRow: {
    paddingHorizontal: 16, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dayRestText: { fontSize: 13, color: CHALK, opacity: 0.45, fontStyle: 'italic' },
  dayAddInline: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1,
    borderColor: 'rgba(214,255,63,0.4)', backgroundColor: LIME_DIM,
  },
  dayAddInlineText: { fontSize: 12, fontWeight: '700', color: LIME },

  muscleList: {},
  daySections: { gap: 10, paddingHorizontal: 12, paddingVertical: 12 },

  // Thẻ nhóm cơ — dải màu dọc bên trái thay cho chấm tròn, kiểu "hàng điểm"
  muscleCard: {
    flexDirection: 'row',
    borderWidth: 1, borderColor: HAIRLINE, borderRadius: 14,
    backgroundColor: INK, overflow: 'hidden',
  },
  muscleCardStripe: { width: 4 },
  muscleCardBody: { flex: 1, padding: 12 },
  muscleCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  muscleCardStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  statusPill: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
    backgroundColor: 'rgba(243,246,239,0.06)', flexShrink: 0,
  },
  statusPillDone: { backgroundColor: GREEN_DIM },
  statusPillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3, color: CHALK, opacity: 0.55 },
  cardEditBtn: {
    width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(243,246,239,0.06)', flexShrink: 0, marginLeft: 'auto',
  },
  muscleInfo: { flex: 1, minWidth: 0 },
  muscleName: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '800', letterSpacing: 0.4, color: CHALK },
  muscleNote: { fontSize: 11, color: CHALK, opacity: 0.45, marginTop: 1 },

  // Danh sách bài tập con lồng trong 1 thẻ nhóm cơ
  exerciseSubList: { gap: 5, marginTop: 4 },
  exerciseSubRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: INK_RAISED, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6,
  },
  exerciseSubThumbEmpty: {
    width: 30, height: 30, borderRadius: 7, borderWidth: 1, borderStyle: 'dashed',
  },
  exerciseSubInfo: { flex: 1, minWidth: 0 },
  exerciseSubNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exerciseSubName: { flexShrink: 1, fontSize: 12.5, color: CHALK, fontWeight: '600' },
  exerciseSubNote: { fontSize: 10, color: CHALK, opacity: 0.4, fontStyle: 'italic', marginTop: 1 },
  exerciseTypeTag: {
    width: 16, height: 16, borderRadius: 4, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  exerciseTypeTagText: { fontSize: 9, fontWeight: '700' },
  exerciseSubSetsPill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: 'rgba(243,246,239,0.08)', flexShrink: 0,
  },
  exerciseSubSetsPillText: { fontSize: 11, fontWeight: '700', color: CHALK },
  exerciseSubDeleteBtn: { padding: 4 },
  progressTrack: { height: 3, borderRadius: 999, backgroundColor: 'rgba(243,246,239,0.08)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  setsNow: { fontSize: 18, fontWeight: '800', color: CHALK },
  setsDivider: { fontSize: 12, fontWeight: '500', color: CHALK, opacity: 0.4 },

  // "Ngoài kế hoạch" — tông ấm cảnh báo, tách biệt khỏi lime/xanh lá
  outOfPlanSection: {},
  outOfPlanHeader: { marginBottom: 8 },
  outOfPlanTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, color: CHALK, opacity: 0.7 },
  outOfPlanSub: { fontSize: 11, color: CHALK, opacity: 0.4, marginTop: 2 },
  outOfPlanCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: Colors.warning + '40', backgroundColor: Colors.warning + '12',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9,
  },
  outOfPlanDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.warning, flexShrink: 0 },
  outOfPlanName: { fontSize: 13, fontWeight: '700', color: CHALK },
  outOfPlanAddBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.warning, flexShrink: 0,
  },
  outOfPlanAddBtnText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3, color: INK },

  emptyBox: {
    marginHorizontal: 20, marginTop: 12,
    borderWidth: 1, borderColor: HAIRLINE, borderRadius: 16,
    backgroundColor: INK_RAISED,
    paddingHorizontal: 16, paddingVertical: 28, alignItems: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: CHALK, marginBottom: 6 },
  emptyText: { fontSize: 13, color: CHALK, opacity: 0.5, textAlign: 'center', lineHeight: 20 },
});