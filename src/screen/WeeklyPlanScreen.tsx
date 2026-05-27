import { useCallback, useMemo, useRef, useState } from 'react';
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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, X } from 'lucide-react-native';
import { getMuscleGroups, getWorkoutLogs } from '@/src/lib/repository';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/context/AuthContext';
import {
  deleteWeeklyPlanEntry,
  getWeeklyPlanEntries,
  upsertWeeklyPlanEntry,
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

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;

  if (value.length !== 6) {
    return `rgba(232, 255, 90, ${alpha})`;
  }

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

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function WeeklyPlanScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userKey = user?.id || 'guest';
  const todayKey = getTodayKey();
  const dayScrollRef = useRef<ScrollView>(null);

  const [groups, setGroups] = useState<MuscleGroupWithCount[]>([]);
  const [plans, setPlans] = useState<WeeklyPlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actualSetsByMuscle, setActualSetsByMuscle] = useState<Record<string, number>>({});
  const [dayProgressLoading, setDayProgressLoading] = useState(false);

  const [selectedDay, setSelectedDay] = useState<WeekDayKey>(todayKey ?? 'mon');

  // ── Editor state ──
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDay, setFormDay] = useState<WeekDayKey>('mon');
  const [selectedMuscles, setSelectedMuscles] = useState<Record<string, string>>({});
  const [editNote, setEditNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Data loading ──

  const load = useCallback(async () => {
    const [nextGroups, nextPlans] = await Promise.all([
      getMuscleGroups() as Promise<MuscleGroupWithCount[]>,
      getWeeklyPlanEntries(userKey),
    ]);
    setGroups(nextGroups);
    setPlans(sortPlans(nextPlans));
  }, [userKey]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const loadDayProgress = useCallback(async (dayKey: WeekDayKey) => {
    setDayProgressLoading(true);
    try {
      const { start, end } = getDayBounds(dayKey);
      const logs = await getWorkoutLogs(start, end);
      const nextMap = logs.reduce<Record<string, number>>((acc, log: any) => {
        const muscleGroupId = log.muscle_group_id;
        acc[muscleGroupId] = (acc[muscleGroupId] || 0) + Number(log.sets || 0);
        return acc;
      }, {});
      setActualSetsByMuscle(nextMap);
    } finally {
      setDayProgressLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDayProgress(selectedDay);
    }, [loadDayProgress, selectedDay]),
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

  const plannedSetsByMuscle = useMemo(() => {
    return plans.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.muscleGroupId] = (acc[entry.muscleGroupId] || 0) + entry.sets;
      return acc;
    }, {});
  }, [plans]);

  const selectedEntries = byDay[selectedDay] ?? [];

  // ── Editor helpers ──

  const toggleMuscle = (id: string) => {
    setSelectedMuscles((prev) => {
      if (prev[id] !== undefined) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: '10' };
    });
  };

  const updateMuscleSets = (id: string, val: string) => {
    setSelectedMuscles((prev) => ({ ...prev, [id]: val }));
  };

  const openCreate = () => {
    setEditingId(null);
    setError('');
    setFormDay(selectedDay);
    setSelectedMuscles({});
    setEditNote('');
    setShowEditor(true);
  };

  const openEdit = (entry: WeeklyPlanEntry) => {
    setEditingId(entry.id);
    setError('');
    setFormDay(entry.dayKey);
    setSelectedMuscles({ [entry.muscleGroupId]: String(entry.sets) });
    setEditNote(entry.note || '');
    setShowEditor(true);
  };

  const submit = async () => {
    const muscleIds = Object.keys(selectedMuscles);
    if (muscleIds.length === 0) { setError('Vui lòng chọn ít nhất một nhóm cơ.'); return; }

    const entries = muscleIds.map((id) => ({ muscleGroupId: id, sets: Number(selectedMuscles[id]) }));
    if (entries.some((e) => !Number.isFinite(e.sets) || e.sets <= 0)) {
      setError('Sets cần là số lớn hơn 0.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const nextPlans = await upsertWeeklyPlanEntry(
          { id: editingId, dayKey: formDay, muscleGroupId: muscleIds[0], sets: entries[0].sets, note: editNote },
          userKey,
        );
        setPlans(sortPlans(nextPlans));
      } else {
        const results = await Promise.all(
          entries.map((e) =>
            upsertWeeklyPlanEntry({ dayKey: formDay, muscleGroupId: e.muscleGroupId, sets: e.sets, note: '' }, userKey),
          ),
        );
        setPlans(sortPlans(results[results.length - 1]));
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

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
          <View>
            <Text style={styles.title}>Kế hoạch tuần</Text>
            <Text style={styles.subtitle}>Chỉ để theo dõi. Bạn vẫn tập linh hoạt theo thực tế.</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
            <Plus color={Colors.bg} size={18} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* ── Summary stats — 2 cards only ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Tổng sets</Text>
            <Text style={styles.statValue}>{totalWeeklySets}</Text>
            <Text style={styles.statSub}>tuần này</Text>
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
          {/* Day header — sets count gộp vào subtitle */}
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
              {setsPerDay[selectedDay] > 0 ? ` · ${setsPerDay[selectedDay]} sets` : ''}
            </Text>
          </View>

          {/* Muscle entries */}
          {selectedEntries.length === 0 ? (
            <View style={styles.dayRestRow}>
              <Text style={styles.dayRestText}>Nghỉ ngơi — chưa có lịch tập</Text>
              <TouchableOpacity style={styles.dayAddInline} onPress={openCreate}>
                <Plus size={12} color={Colors.accent} strokeWidth={2.5} />
                <Text style={styles.dayAddInlineText}>Thêm</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.muscleList}>
              {selectedEntries.map((entry, idx) => {
                const col = colorByMuscle[entry.muscleGroupId] ?? getGroupTone();
                const isLast = idx === selectedEntries.length - 1;
                const actualSets = actualSetsByMuscle[entry.muscleGroupId] ?? 0;
                const targetSets = targetSetsByMuscle[entry.muscleGroupId] ?? 0;
                const pct = entry.sets > 0 ? Math.min(actualSets / entry.sets, 1) : 0;
                const done = actualSets >= entry.sets && entry.sets > 0;

                return (
                  <View key={entry.id} style={[styles.muscleRow, !isLast && styles.muscleRowBorder]}>
                    {/* Dot màu thay colorBar */}
                    <View style={[styles.entryDot, { backgroundColor: col.bar }]} />

                    {/* Tên + progress bar */}
                    <View style={styles.muscleInfo}>
                      <Text style={styles.muscleName} numberOfLines={1}>
                        {muscleNameById[entry.muscleGroupId] ?? 'Nhóm cơ đã xoá'} - {" "}
                        <Text style={[styles.setsNow, done && { color: col.bar }]}>
                        {dayProgressLoading ? '…' : actualSets}
                        <Text style={styles.setsDivider}> / {entry.sets}</Text>
                      </Text>
                      </Text>
                      {entry.note ? <Text style={styles.muscleNote} numberOfLines={1}>{entry.note}</Text> : null}
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: col.bar }]} />
                      </View>
                    </View>

                    {/* Số liệu + actions */}
                    <View style={styles.entryRight}>
                      {done
                        ? <Text style={[styles.doneChip, { color: col.bar }]}>✓ xong</Text>
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
        </View>

        {/* ── Empty state ── */}
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
          <Text style={styles.inputLabel}>Ngày tập</Text>
          <View style={styles.filterWrap}>
            {WEEK_DAYS.map((day) => (
              <TouchableOpacity
                key={day.key}
                style={[styles.chip, formDay === day.key && styles.chipActive]}
                onPress={() => setFormDay(day.key)}
              >
                <Text style={[styles.chipText, formDay === day.key && styles.chipTextActive]}>{day.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Multi-muscle selector */}
          <Text style={styles.inputLabel}>
            {editingId
              ? 'Nhóm cơ'
              : `Nhóm cơ${Object.keys(selectedMuscles).length > 0 ? ` (${Object.keys(selectedMuscles).length} đã chọn)` : ''}`}
          </Text>
          <View style={styles.musclePickerList}>
            {groups.map((group) => {
              const col = colorByMuscle[group.id];
              const isChosen = selectedMuscles[group.id] !== undefined;
              const targetSets = Number(group.target_sets_per_week || 0);
              const plannedWeeklySets = plannedSetsByMuscle[group.id] ?? 0;
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
                      <Text style={[styles.musclePickerName, isChosen && { color: col?.badgeText ?? Colors.accent, fontWeight: '700' }]}>
                        {group.name}
                      </Text>
                      <Text style={[styles.musclePickerMeta, isChosen && { color: col?.badgeText ?? Colors.textSecondary }]}>
                        Mục tiêu tuần {targetSets} sets · Đã plan {plannedWeeklySets} sets
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
              {saving
                ? 'Đang lưu...'
                : editingId
                  ? 'Lưu thay đổi'
                  : `Thêm${Object.keys(selectedMuscles).length > 1 ? ` ${Object.keys(selectedMuscles).length} nhóm cơ` : ' kế hoạch'}`}
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

  // Header
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

  // Stats row — 2 cards
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

  // Day picker strip
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

  // Day detail card
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

  // Rest row
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

  // Muscle entries
  muscleList: {},
  muscleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  muscleRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },

  // Dot màu — thay colorBar
  entryDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },

  muscleInfo: { flex: 1, minWidth: 0 },
  muscleName: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  muscleNote: { fontSize: 11, color: Colors.textSecondary, marginBottom: 4 },

  // Progress bar
  progressTrack: { height: 3, borderRadius: 999, backgroundColor: Colors.border, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },

  // Right side
  entryRight: { alignItems: 'flex-end', gap: 3, flexShrink: 0 },
  setsNow: { fontSize: 15, fontWeight: '700', color: Colors.text },
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

  // Empty
  emptyBox: {
    marginHorizontal: 20, marginTop: 12,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 14,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16, paddingVertical: 24, alignItems: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  // Sheet / modal
  filterWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  chipActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '1f' },
  chipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: Colors.accent, fontWeight: '700' },

  // Multi-muscle picker
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
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bg,
  },
  musclePickerCheckMark: { fontSize: 11, color: Colors.bg, fontWeight: '700', lineHeight: 14 },
  musclePickerName: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  musclePickerMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  musclePickerSetsWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  musclePickerSetsInput: {
    width: 48, textAlign: 'center',
    borderWidth: 1.5, borderRadius: 8,
    paddingVertical: 4, paddingHorizontal: 6,
    fontSize: 14, fontWeight: '700',
    color: Colors.text, backgroundColor: Colors.bg,
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
    width: 44, height: 4, borderRadius: 999,
    backgroundColor: Colors.textMuted,
    alignSelf: 'center', marginBottom: 12, opacity: 0.4,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
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
    marginTop: 14, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, backgroundColor: Colors.accent,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Colors.bg, fontWeight: '700', fontSize: 14 },
});