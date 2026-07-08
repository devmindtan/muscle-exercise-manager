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
import { ChevronDown, Plus, Pencil, Trash2 } from 'lucide-react-native';
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
  return `${d.getDate()} tháng ${d.getMonth() + 1}`;
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
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={[styles.loadingText, { marginTop: 12 }]}>Đang tải kế hoạch...</Text>
      </View>
    );
  }

  const selectedDate = getDateForDayKey(selectedDay);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: 12 }]}>
          <View style={styles.headerTitleWrap}>
            <TouchableOpacity style={styles.planSelector} onPress={() => setShowPlanManager(true)} activeOpacity={0.7}>
              <Text style={styles.title} numberOfLines={1}>{activePlanName}</Text>
              <ChevronDown color={Colors.textMuted} size={20} strokeWidth={2.2} />
            </TouchableOpacity>
            <Text style={styles.subtitle}>
              Chỉ để theo dõi. Bạn vẫn tập linh hoạt theo thực tế.
              {workoutPlans.length > 1 ? ` · ${workoutPlans.length} kế hoạch` : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
            <Plus color={Colors.bg} size={18} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* ── Summary stats ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Tiến độ sets tuần</Text>
            <Text style={styles.statValue}>
              {weekProgressLoading ? '…' : totalWeeklyActualSets}
              <Text style={styles.statValueSub}> / {totalWeeklySets}</Text>
            </Text>
            <Text style={styles.statSub}>đã tập / đã kế hoạch</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Ngày tập</Text>
            <Text style={styles.statValue}>
              {activeDays}
              <Text style={styles.statValueSub}> / 7</Text>
            </Text>
            <Text style={styles.statSub}>đã lên kế hoạch</Text>
          </View>
        </View>

        {/* ── Day picker strip ── */}
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
                style={[styles.dayBtn, isSelected && styles.dayBtnActive, !isSelected && isToday && styles.dayBtnToday]}
                onPress={() => {
                  selectedDayRef.current = day.key;
                  setSelectedDay(day.key);
                  void loadDayProgress(day.key);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayAbbr, isSelected && styles.dayAbbrActive, !isSelected && isToday && styles.dayAbbrToday]}>
                  {day.label}
                </Text>
                <Text style={[styles.dayNum, isSelected && styles.dayNumActive, !isSelected && isToday && styles.dayNumToday]}>
                  {date.getDate()}
                </Text>
                <View style={[styles.dayDot, hasEntries ? (isSelected ? styles.dayDotActiveHas : styles.dayDotHas) : styles.dayDotEmpty]} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Selected day detail ── */}
        <View style={styles.dayDetail}>
          <View style={[styles.dayDetailHeader, selectedDay === todayKey && styles.dayDetailHeaderToday]}>
            <View style={styles.dayDetailTitleRow}>
              <Text style={styles.dayDetailTitle}>{DAY_LABEL_FULL[selectedDay]}</Text>
              {selectedDay === todayKey && (
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>Hôm nay</Text>
                </View>
              )}
            </View>
            <Text style={styles.dayDetailDate}>
              {formatShortDate(selectedDate)}
              {setsPerDay[selectedDay] > 0
                ? ` · ${dayProgressLoading ? '…' : dayActualTotal}/${setsPerDay[selectedDay]} sets`
                : ` · ${dayProgressLoading ? '…' : dayActualTotal} sets`}
            </Text>
          </View>

          {selectedMuscleGroups.length === 0 && outOfPlanEntries.length === 0 ? (
            <View style={styles.dayRestRow}>
              <Text style={styles.dayRestText}>Nghỉ ngơi — chưa có lịch tập</Text>
              <TouchableOpacity style={styles.dayAddInline} onPress={openCreate}>
                <Plus size={12} color={Colors.accent} strokeWidth={2.5} />
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
                    const doneAccent = done ? Colors.success : col.bar;
                    return (
                      <View key={group.muscleGroupId} style={[styles.muscleCard, !isLast && { marginBottom: 10 }]}>
                        <View style={styles.muscleCardHeader}>
                          <View style={[styles.entryDot, { backgroundColor: doneAccent }]} />
                          <Text style={styles.muscleName} numberOfLines={1}>
                            {muscleNameById[group.muscleGroupId] ?? 'Nhóm cơ đã xoá'}{' '}
                            <Text style={[styles.setsNow, done && { color: Colors.success }]}>
                              {dayProgressLoading ? '…' : actualSets}
                              <Text style={styles.setsDivider}> / {totalSets}</Text>
                            </Text>
                          </Text>
                          <TouchableOpacity
                            style={styles.cardEditBtn}
                            onPress={() => openEdit(group.entries[0])}
                            hitSlop={8}
                          >
                            <Pencil color={Colors.textSecondary} size={15} strokeWidth={2} />
                          </TouchableOpacity>
                        </View>

                        <View style={styles.muscleCardStatusRow}>
                          {done
                            ? <Text style={[styles.doneChip, { color: Colors.success }]}>✓ xong</Text>
                            : <Text style={styles.setsWeekTarget}>mục tiêu {targetSets}s/tuần</Text>
                          }
                        </View>

                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: doneAccent }]} />
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
                    );
                  })}
                </View>
              )}

              {outOfPlanEntries.length > 0 && (
                <View style={styles.outOfPlanBox}>
                  <View style={styles.outOfPlanHeader}>
                    <Text style={styles.outOfPlanTitle}>Ngoài kế hoạch</Text>
                    <Text style={styles.outOfPlanSub}>Các nhóm cơ đã tập nhưng chưa có trong lịch hôm nay</Text>
                  </View>
                  <View style={styles.outOfPlanList}>
                    {outOfPlanEntries.map((item, idx) => {
                      const isLast = idx === outOfPlanEntries.length - 1;
                      return (
                        <View key={item.muscleGroupId} style={[styles.outOfPlanRow, !isLast && styles.outOfPlanRowBorder]}>
                          <View style={[styles.entryDot, { backgroundColor: Colors.warning }]} />
                          <View style={styles.muscleInfo}>
                            <Text style={styles.muscleName} numberOfLines={1}>
                              {muscleNameById[item.muscleGroupId] ?? 'Nhóm cơ đã xoá'}{' '}
                              <Text style={styles.outOfPlanStatus}>ngoài kế hoạch</Text>
                            </Text>
                            <Text style={styles.muscleNote} numberOfLines={1}>
                              {dayProgressLoading ? '…' : item.actualSets} sets đã tập
                            </Text>
                          </View>
                          <View style={styles.outOfPlanActions}>
                            <TouchableOpacity
                              style={styles.outOfPlanAddBtn}
                              onPress={() => openAddToPlanFromOutside(item.muscleGroupId, item.actualSets)}
                            >
                              <Text style={styles.outOfPlanAddBtnText}>Đưa vào kế hoạch</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 15, color: Colors.textMuted },
  content: { paddingBottom: 40 },

  header: {
    paddingHorizontal: 20, paddingBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
  },
  headerTitleWrap: { flex: 1, minWidth: 0 },
  planSelector: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.text, letterSpacing: -0.5, flexShrink: 1 },
  subtitle: { marginTop: 4, fontSize: 12, color: Colors.textMuted, lineHeight: 18 },
  addBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
  },

  statsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14,
  },
  statLabel: { fontSize: 10, color: Colors.textSecondary, marginBottom: 3 },
  statValue: { fontSize: 24, fontWeight: '700', color: Colors.text, lineHeight: 30 },
  statValueSub: { fontSize: 14, fontWeight: '400', color: Colors.textMuted },
  statSub: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  dayStrip: { paddingHorizontal: 20, paddingBottom: 14, gap: 8 },
  dayBtn: {
    alignItems: 'center', gap: 3, paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface, minWidth: 44,
  },
  dayBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  dayBtnToday: { borderColor: Colors.accent },
  dayAbbr: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },
  dayAbbrActive: { color: Colors.bg },
  dayAbbrToday: { color: Colors.accent },
  dayNum: { fontSize: 15, fontWeight: '700', color: Colors.text },
  dayNumActive: { color: Colors.bg },
  dayNumToday: { color: Colors.accent },
  dayDot: { width: 4, height: 4, borderRadius: 2 },
  dayDotHas: { backgroundColor: Colors.accent + '88' },
  dayDotActiveHas: { backgroundColor: Colors.bg + 'aa' },
  dayDotEmpty: { backgroundColor: 'transparent' },

  dayDetail: {
    marginHorizontal: 20, marginBottom: 4,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 16,
    backgroundColor: Colors.surface, overflow: 'hidden',
  },
  dayDetailHeader: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  dayDetailHeaderToday: {
    backgroundColor: Colors.accent + '15',
    borderBottomColor: Colors.accent + '40',
  },
  dayDetailTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  dayDetailTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  todayBadge: { backgroundColor: Colors.accent, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  todayBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.bg },
  dayDetailDate: { fontSize: 11, color: Colors.textMuted },

  dayRestRow: {
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dayRestText: { fontSize: 13, color: Colors.textMuted, fontStyle: 'italic' },
  dayAddInline: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1,
    borderColor: Colors.accent + '55', backgroundColor: Colors.accent + '10',
  },
  dayAddInlineText: { fontSize: 12, fontWeight: '600', color: Colors.accent },

  muscleList: {},
  daySections: { gap: 10 },

  // Thẻ nhóm cơ — 1 card riêng biệt/nhóm cơ, luôn hiện danh sách bài tập con
  // bên dưới dù có 1 hay nhiều bài (nhất quán, không rẽ nhánh theo số lượng).
  muscleCard: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 14,
    backgroundColor: Colors.surface, padding: 12,
  },
  muscleCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardEditBtn: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated, flexShrink: 0,
  },
  muscleCardStatusRow: { alignItems: 'flex-end', marginTop: 2, marginBottom: 6 },
  entryDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  muscleInfo: { flex: 1, minWidth: 0 },
  muscleName: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '700', color: Colors.text },
  muscleNote: { fontSize: 11, color: Colors.textSecondary, marginBottom: 4 },

  // Danh sách bài tập con lồng trong 1 thẻ nhóm cơ
  exerciseSubList: { gap: 6, marginTop: 8 },
  exerciseSubRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6,
  },
  exerciseSubThumbEmpty: {
    width: 30, height: 30, borderRadius: 7, borderWidth: 1, borderStyle: 'dashed',
  },
  exerciseSubInfo: { flex: 1, minWidth: 0 },
  exerciseSubNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exerciseSubName: { flexShrink: 1, fontSize: 12.5, color: Colors.text, fontWeight: '600' },
  exerciseSubNote: { fontSize: 10, color: Colors.textMuted, fontStyle: 'italic', marginTop: 1 },
  exerciseTypeTag: {
    width: 16, height: 16, borderRadius: 4, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  exerciseTypeTagText: { fontSize: 9, fontWeight: '700' },
  exerciseSubSetsPill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: Colors.surfaceElevated, flexShrink: 0,
  },
  exerciseSubSetsPillText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  exerciseSubDeleteBtn: { padding: 4 },
  progressTrack: { height: 3, borderRadius: 999, backgroundColor: Colors.border, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  setsNow: { fontSize: 13, fontWeight: '700', color: Colors.text },
  setsDivider: { fontSize: 11, fontWeight: '400', color: Colors.textMuted },
  setsWeekTarget: { fontSize: 10, color: Colors.textMuted },
  doneChip: { fontSize: 10, fontWeight: '700' },

  outOfPlanBox: {
    marginHorizontal: 16, padding: 12, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.warning + '44', backgroundColor: Colors.warning + '10',
  },
  outOfPlanHeader: { marginBottom: 8 },
  outOfPlanTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  outOfPlanSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  outOfPlanList: { gap: 8 },
  outOfPlanRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  outOfPlanRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.warning + '20', paddingBottom: 10 },
  outOfPlanStatus: { fontSize: 10, fontWeight: '700', color: Colors.warning },
  outOfPlanActions: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  outOfPlanAddBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.warning,
  },
  outOfPlanAddBtnText: { fontSize: 11, fontWeight: '700', color: Colors.bg },

  emptyBox: {
    marginHorizontal: 20, marginTop: 12,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 14,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16, paddingVertical: 24, alignItems: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
