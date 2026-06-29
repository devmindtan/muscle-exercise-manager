import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  AppState,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, X } from 'lucide-react-native';
import { getMuscleGroups, getWorkoutLogs } from '@/src/lib/repository';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/context/AuthContext';
import {
  deleteWeeklyPlanEntry,
  getWeeklyPlanEntries,
  upsertWeeklyPlanEntry,
  upsertWeeklyPlanEntries,
  WEEK_DAYS,
  WeekDayKey,
  WeeklyPlanEntry,
} from '@/src/services/weeklyPlanService';
import { MuscleGroup } from '@/src/types/database';

type MuscleGroupWithCount = MuscleGroup & { exercise_count?: number };

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_LABEL_FULL: Record<WeekDayKey, string> = {
  mon: 'Thứ 2', tue: 'Thứ 3', wed: 'Thứ 4',
  thu: 'Thứ 5', fri: 'Thứ 6', sat: 'Thứ 7', sun: 'Chủ nhật',
};

const DAY_ORDER_MAP: Record<WeekDayKey, number> = WEEK_DAYS.reduce((acc, day) => {
  acc[day.key] = day.order;
  return acc;
}, {} as Record<WeekDayKey, number>);

const CATEGORIES = ['Ngực', 'Lưng', 'Vai', 'Tay', 'Chân', 'Bụng', 'Khác'];

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;
  if (value.length !== 6) return `rgba(232, 255, 90, ${alpha})`;
  const intValue = Number.parseInt(value, 16);
  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getGroupAccent(groupColor?: string | null) {
  return groupColor && groupColor.trim() ? groupColor : Colors.accent;
}

function getGroupTone(groupColor?: string | null) {
  const accent = getGroupAccent(groupColor);
  return {
    bar: accent,
    badgeBg: hexToRgba(accent, 0.14),
    badgeBorder: hexToRgba(accent, 0.35),
    badgeText: accent,
  };
}

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actualSetsByMuscle, setActualSetsByMuscle] = useState<Record<string, number>>({});
  const [weeklyActualSetsByMuscle, setWeeklyActualSetsByMuscle] = useState<Record<string, number>>({});
  const [dayProgressLoading, setDayProgressLoading] = useState(false);
  const [weekProgressLoading, setWeekProgressLoading] = useState(false);

  const [selectedDay, setSelectedDay] = useState<WeekDayKey>(todayKey ?? 'mon');
  const selectedDayRef = useRef<WeekDayKey>(todayKey ?? 'mon');
  selectedDayRef.current = selectedDay;

  // ── Editor state ──
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  // ── Data loading ──

  const load = useCallback(async () => {
    const [nextGroups, nextPlans] = await Promise.all([
      getMuscleGroups() as Promise<MuscleGroupWithCount[]>,
      getWeeklyPlanEntries(userKey),
    ]);
    setGroups(nextGroups);
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

  const setsPerDay = useMemo(() => {
    const map: Record<WeekDayKey, number> = {} as any;
    WEEK_DAYS.forEach((d) => { map[d.key] = byDay[d.key].reduce((s, e) => s + e.sets, 0); });
    return map;
  }, [byDay]);

  const persistedPlannedByMuscle = useMemo(() => {
    return plans.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.muscleGroupId] = (acc[entry.muscleGroupId] || 0) + entry.sets;
      return acc;
    }, {});
  }, [plans]);

  const existingPlanByDayMuscle = useMemo(() => {
    const map = new Map<string, WeeklyPlanEntry>();
    plans.forEach((entry) => {
      map.set(`${entry.dayKey}::${entry.muscleGroupId}`, entry);
    });
    return map;
  }, [plans]);

  // FIX: draftDeltaByMuscle chỉ dùng cho create mode
  // Edit mode tính riêng trong musclePickerRow để tránh nhầm lẫn
  const draftDeltaByMuscle = useMemo(() => {
    if (editingId) return {} as Record<string, number>;

    const source = {
      ...createDaySelections,
      [formDayCreate]: selectedMuscles,
    };

    return WEEK_DAYS.reduce<Record<string, number>>((acc, day) => {
      const musclesForDay = source[day.key] || {};
      Object.entries(musclesForDay).forEach(([muscleGroupId, setsRaw]) => {
        const nextSets = Number(setsRaw);
        if (!Number.isFinite(nextSets) || nextSets <= 0) return;
        const existing = existingPlanByDayMuscle.get(`${day.key}::${muscleGroupId}`);
        const existingSets = existing?.sets || 0;
        acc[muscleGroupId] = (acc[muscleGroupId] || 0) + (nextSets - existingSets);
      });
      return acc;
    }, {});
  }, [editingId, createDaySelections, existingPlanByDayMuscle, formDayCreate, selectedMuscles]);

  const editingEntry = useMemo(
    () => (editingId ? plans.find((entry) => entry.id === editingId) ?? null : null),
    [editingId, plans],
  );

  const dayActualTotal = useMemo(
    () => Object.values(actualSetsByMuscle).reduce((sum, val) => sum + val, 0),
    [actualSetsByMuscle],
  );

  const filteredGroups = useMemo(() => {
    if (selectedCategories.size === 0) return groups;
    return groups.filter((group) => selectedCategories.has(group.category || 'Khác'));
  }, [groups, selectedCategories]);

  const selectedEntries = useMemo(() => byDay[selectedDay] ?? [], [byDay, selectedDay]);
  const selectedEntryIds = useMemo(
    () => new Set(selectedEntries.map((entry) => entry.muscleGroupId)),
    [selectedEntries],
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

  const configuredCreateDaysCount = useMemo(
    () => Object.values(createDaySelections).filter((value) => value && Object.keys(value).length > 0).length,
    [createDaySelections],
  );

  // ── Editor helpers ──

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
        setCreateDaySelections((dayPrev) => ({
          ...dayPrev,
          [formDayCreate]: next,
        }));
      }
      return next;
    });
  };

  const updateMuscleSets = (id: string, val: string) => {
    setSelectedMuscles((prev) => {
      const next = { ...prev, [id]: val };
      if (!editingId) {
        setCreateDaySelections((dayPrev) => ({
          ...dayPrev,
          [formDayCreate]: next,
        }));
      }
      return next;
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setError('');
    setFormDayCreate(selectedDay);
    setCreateDaySelections({});
    setSelectedMuscles({});
    setEditNote('');
    setSelectedCategories(new Set());
    setShowEditor(true);
  };

  const switchCreateDay = (dayKey: WeekDayKey) => {
    setFormDayCreate(dayKey);
    setSelectedMuscles({ ...(createDaySelections[dayKey] || {}) });
  };

  const openEdit = (entry: WeeklyPlanEntry) => {
    setEditingId(entry.id);
    setError('');
    setFormDaySingle(entry.dayKey);
    setCreateDaySelections({});
    setSelectedMuscles({ [entry.muscleGroupId]: String(entry.sets) });
    setEditNote(entry.note || '');
    setSelectedCategories(new Set());
    setShowEditor(true);
  };

  const openAddToPlanFromOutside = (muscleGroupId: string, sets: number) => {
    setEditingId(null);
    setError('');
    setFormDayCreate(selectedDay);
    setCreateDaySelections({
      [selectedDay]: { [muscleGroupId]: String(Math.max(1, Math.round(sets))) },
    });
    setSelectedMuscles({ [muscleGroupId]: String(Math.max(1, Math.round(sets))) });
    setEditNote('');
    setSelectedCategories(new Set());
    setShowEditor(true);
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
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
          { id: editingId, dayKey: formDaySingle, muscleGroupId: muscleIds[0], sets: muscleEntries[0].sets, note: editNote },
          userKey,
        );
        setPlans(sortPlans(nextPlans));
      } else {
        const source = {
          ...createDaySelections,
          [formDayCreate]: selectedMuscles,
        };
        const payload = WEEK_DAYS.flatMap(({ key }) => {
          const musclesForDay = source[key] || {};
          return Object.entries(musclesForDay)
            .map(([muscleGroupId, setsRaw]) => {
              const existing = plans.find(
                (plan) => plan.dayKey === key && plan.muscleGroupId === muscleGroupId,
              );
              return {
                id: existing?.id,
                dayKey: key,
                muscleGroupId,
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
        const nextPlans = await upsertWeeklyPlanEntries(payload, userKey);
        setPlans(sortPlans(nextPlans));
      }
      setShowEditor(false);
      setEditingId(null);
    } catch {
      setError('Không thể lưu kế hoạch. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const nextPlans = await deleteWeeklyPlanEntry(id, userKey);
    setPlans(sortPlans(nextPlans));
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>Đang tải kế hoạch...</Text>
      </View>
    );
  }

  const selectedDate = getDateForDayKey(selectedDay);

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

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: 12 }]}>
          <View>
            <Text style={styles.title}>Kế hoạch tuần</Text>
            <Text style={styles.subtitle}>Chỉ để theo dõi. Bạn vẫn tập linh hoạt theo thực tế.</Text>
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

          {selectedEntries.length === 0 && outOfPlanEntries.length === 0 ? (
            <View style={styles.dayRestRow}>
              <Text style={styles.dayRestText}>Nghỉ ngơi — chưa có lịch tập</Text>
              <TouchableOpacity style={styles.dayAddInline} onPress={openCreate}>
                <Plus size={12} color={Colors.accent} strokeWidth={2.5} />
                <Text style={styles.dayAddInlineText}>Thêm</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.daySections}>
              {selectedEntries.length > 0 && (
                <View style={styles.muscleList}>
                  {selectedEntries.map((entry, idx) => {
                    const col = colorByMuscle[entry.muscleGroupId] ?? getGroupTone();
                    const isLast = idx === selectedEntries.length - 1;
                    const actualSets = actualSetsByMuscle[entry.muscleGroupId] ?? 0;
                    const targetSets = targetSetsByMuscle[entry.muscleGroupId] ?? 0;
                    const pct = entry.sets > 0 ? Math.min(actualSets / entry.sets, 1) : 0;
                    const done = actualSets >= entry.sets && entry.sets > 0;
                    const doneAccent = done ? Colors.success : col.bar;
                    return (
                      <View key={entry.id} style={[styles.muscleRow, !isLast && styles.muscleRowBorder]}>
                        <View style={[styles.entryDot, { backgroundColor: doneAccent }]} />
                        <View style={styles.muscleInfo}>
                          <Text style={styles.muscleName} numberOfLines={1}>
                            {muscleNameById[entry.muscleGroupId] ?? 'Nhóm cơ đã xoá'}{' '}
                            <Text style={[styles.setsNow, done && { color: Colors.success }]}>
                              {dayProgressLoading ? '…' : actualSets}
                              <Text style={styles.setsDivider}> / {entry.sets}</Text>
                            </Text>
                          </Text>
                          {entry.note ? <Text style={styles.muscleNote} numberOfLines={1}>{entry.note}</Text> : null}
                          <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: doneAccent }]} />
                          </View>
                        </View>
                        <View style={styles.entryRight}>
                          {done
                            ? <Text style={[styles.doneChip, { color: Colors.success }]}>✓ xong</Text>
                            : <Text style={styles.setsWeekTarget}>mục tiêu {targetSets}s/tuần</Text>
                          }
                          <View style={styles.actionRow}>
                            <TouchableOpacity style={styles.actionEdit} onPress={() => openEdit(entry)}>
                              <Text style={styles.actionEditText}>Sửa</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionDelete} onPress={() => remove(entry.id)}>
                              <Text style={styles.actionDeleteText}>Xoá</Text>
                            </TouchableOpacity>
                          </View>
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

      {/* ── Editor Sheet ── */}
      <Modal visible={showEditor} transparent animationType="slide" onRequestClose={() => setShowEditor(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowEditor(false)} />
        <ScrollView style={styles.sheet} keyboardShouldPersistTaps="handled" bounces={false}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{editingId ? 'Sửa kế hoạch' : 'Thêm kế hoạch'}</Text>
            <TouchableOpacity onPress={() => setShowEditor(false)}>
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

              // FIX: tính projectedPlannedSets đúng cho cả create và edit mode
              let projectedPlannedSets: number;
              if (editingId) {
                // Edit mode: thay sets cũ của entry đang sửa bằng giá trị mới
                const currentInputSets = Number(selectedMuscles[group.id] || 0);
                const isThisEntryMuscle = editingEntry?.muscleGroupId === group.id;
                if (isThisEntryMuscle) {
                  // Tổng kế hoạch = (tổng tất cả entries) - (sets cũ của entry này) + (sets mới đang nhập)
                  projectedPlannedSets = persistedPlannedSets - (editingEntry?.sets ?? 0) + currentInputSets;
                } else {
                  projectedPlannedSets = persistedPlannedSets;
                }
              } else {
                // Create mode: dùng delta như cũ
                const draftContribution = draftDeltaByMuscle[group.id] ?? 0;
                const safeDraftContribution = Number.isFinite(draftContribution) ? draftContribution : 0;
                projectedPlannedSets = Math.max(persistedPlannedSets + safeDraftContribution, 0);
              }

              // FIX: mergedWeeklyProgress = actual (từ workout logs) + planned (kế hoạch)
              // Hai con số này KHÔNG chồng lên nhau:
              // - actualWeeklySets = số sets đã thực tế tập (từ workout_logs)
              // - projectedPlannedSets = số sets đã lên kế hoạch (từ weekly_plan_entries)
              // Mục đích hiển thị: cho thấy "đã tập bao nhiêu vs đã kế hoạch bao nhiêu"
              // so với mục tiêu tuần.
              // NHƯNG nếu mục đích là "thiếu bao nhiêu sets nữa để đủ mục tiêu", thì
              // chỉ dùng actualWeeklySets + projectedPlannedSets khi chúng không overlap.
              // Thực ra: planned sets và actual sets là 2 chiều độc lập.
              // → Hiển thị remain = targetSets - projectedPlannedSets (chỉ dựa trên kế hoạch)
              // để người dùng biết kế hoạch đã đủ mục tiêu chưa.
              const remain = Math.max(targetSets - projectedPlannedSets, 0);
              const reached = targetSets > 0
                ? projectedPlannedSets >= targetSets
                : projectedPlannedSets > 0;

              return (
                <View
                  key={group.id}
                  style={[
                    styles.musclePickerRow,
                    isChosen && { borderColor: col?.bar ?? Colors.accent, backgroundColor: col?.badgeBg ?? Colors.accent + '10' },
                  ]}
                >
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
                        {/* FIX: hiển thị actual sets riêng để người dùng không nhầm */}
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
      </Modal>
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
  title: { fontSize: 28, fontWeight: '700', color: Colors.text, letterSpacing: -0.5 },
  subtitle: { marginTop: 4, fontSize: 12, color: Colors.textMuted, lineHeight: 18, maxWidth: 260 },
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
  muscleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  muscleRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  entryDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  muscleInfo: { flex: 1, minWidth: 0 },
  muscleName: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  muscleNote: { fontSize: 11, color: Colors.textSecondary, marginBottom: 4 },
  progressTrack: { height: 3, borderRadius: 999, backgroundColor: Colors.border, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  entryRight: { alignItems: 'flex-end', gap: 3, flexShrink: 0 },
  setsNow: { fontSize: 13, fontWeight: '700', color: Colors.text },
  setsDivider: { fontSize: 11, fontWeight: '400', color: Colors.textMuted },
  setsWeekTarget: { fontSize: 10, color: Colors.textMuted },
  doneChip: { fontSize: 10, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 5, marginTop: 4 },
  actionEdit: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.surfaceElevated,
  },
  actionEditText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  actionDelete: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1,
    borderColor: Colors.error + '44', backgroundColor: Colors.error + '10',
  },
  actionDeleteText: { fontSize: 11, fontWeight: '600', color: Colors.error },

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
  outOfPlanMiniBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1,
  },
  outOfPlanMiniBadgeText: { fontSize: 10, fontWeight: '700' },

  emptyBox: {
    marginHorizontal: 20, marginTop: 12,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 14,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16, paddingVertical: 24, alignItems: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

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
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: Colors.surface,
  },
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
});