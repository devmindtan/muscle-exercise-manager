import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { TrendingUp, ChevronRight, Dumbbell } from 'lucide-react-native';
import { getMuscleGroupsWithWeeklyStats, getMonthlyVolume, getWorkoutLogs } from '@/src/lib/repository';
import type { WeekStat } from '@/src/lib/repository';
import { HistoryTabSection } from '../components/dashboard-tabs/HistoryTab';
import type { HistoryPoint } from '../components/dashboard-tabs/HistoryTab';
import { SyncStatusChip } from '@/src/components/SyncStatusChip';
import { Colors } from '@/src/constants/colors';

type DashboardTab = 'overview' | 'history';

function getWeekRange() {
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

function getWeekKey() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return `${monday.getFullYear()}-${monday.getMonth() + 1}-${monday.getDate()}`;
}

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function getWeekStart(baseDate: Date) {
  const day = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getWeekRangeByOffset(offset: number) {
  const now = new Date();
  const monday = getWeekStart(now);
  monday.setDate(monday.getDate() - offset * 7);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const startLabel = monday.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  const endLabel = sunday.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

  return {
    key: `week-${monday.toISOString()}`,
    label: offset === 0 ? 'Hiện tại' : `${startLabel}-${endLabel}`,
    title: offset === 0 ? 'Tuần hiện tại' : `${startLabel} - ${endLabel}`,
    start: monday.toISOString(),
    end: sunday.toISOString(),
    isCurrent: offset === 0,
  };
}

function getMonthRangeByOffset(offset: number) {
  const now = new Date();
  const anchor = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  const monthLabel = start.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' });

  return {
    key: `month-${start.toISOString()}`,
    label: offset === 0 ? 'Hiện tại' : monthLabel,
    title: offset === 0 ? 'Tháng hiện tại' : monthLabel,
    start: start.toISOString(),
    end: end.toISOString(),
    isCurrent: offset === 0,
  };
}

function sumSets(logs: any[]) {
  return logs.reduce((sum, log) => sum + Number(log?.sets || 0), 0);
}

function sumReps(logs: any[]) {
  return logs.reduce((sum, log) => {
    const sets = Number(log?.sets || 0);
    const reps = Number(log?.reps || 0);
    return sum + (Number.isFinite(sets) && Number.isFinite(reps) ? sets * reps : 0);
  }, 0);
}

function sumVolume(logs: any[]) {
  return logs.reduce((sum, log) => {
    const volume = Number(log?.volume ?? log?.volume_kg ?? log?.volumeKg ?? 0);
    if (Number.isFinite(volume) && volume > 0) {
      return sum + volume;
    }

    const sets = Number(log?.sets || 0);
    const reps = Number(log?.reps || 0);
    const weightKg = Number(log?.weight ?? log?.weight_kg ?? log?.weightKg ?? 0);
    return sum + (Number.isFinite(sets) && Number.isFinite(reps) && Number.isFinite(weightKg) ? sets * reps * weightKg : 0);
  }, 0);
}

const CATEGORIES = ['Ngực', 'Lưng', 'Vai', 'Tay', 'Chân', 'Bụng', 'Khác'];

type ProgressTab = 'completed' | 'pending' | 'over';

function getProgressState(stat: WeekStat): ProgressTab {
  if (stat.targetSetsPerWeek > 0 && stat.weekly_sets > stat.targetSetsPerWeek) {
    return 'over';
  }
  if (stat.targetSetsPerWeek > 0 && stat.weekly_sets === stat.targetSetsPerWeek) {
    return 'completed';
  }
  return 'pending';
}

function getProgressCopy(stat: WeekStat) {
  const status = getProgressState(stat);
  const remaining = Math.max(stat.targetSetsPerWeek - stat.weekly_sets, 0);
  const exceeded = Math.max(stat.weekly_sets - stat.targetSetsPerWeek, 0);
  const progressPercent =
    stat.targetSetsPerWeek > 0
      ? Math.round((stat.weekly_sets / stat.targetSetsPerWeek) * 100)
      : 0;

  if (status === 'over') {
    return {
      status,
      badgeLabel: 'Vượt',
      badgeStyle: styles.statusOver,
      badgeTextStyle: styles.statusOverText,
      helperText: `Vượt ${exceeded} sets so với mục tiêu tuần`,
      accentColor: Colors.success,
      progressText: `${progressPercent}%`,
    };
  }
  if (status === 'completed') {
    return {
      status,
      badgeLabel: 'Hoàn thành',
      badgeStyle: styles.statusCompleted,
      badgeTextStyle: styles.statusCompletedText,
      helperText: 'Đã chạm đúng mục tiêu tuần',
      accentColor: Colors.accent,
      progressText: `${progressPercent}%`,
    };
  }
  return {
    status,
    badgeLabel: 'Chưa đủ',
    badgeStyle: styles.statusPending,
    badgeTextStyle: styles.statusPendingText,
    helperText: `Còn ${remaining} sets để đạt mục tiêu`,
    accentColor: Colors.accent,
    progressText: `${progressPercent}%`,
  };
}

function ProgressBar({
  value,
  color,
  target,
}: {
  value: number;
  color: string;
  target: number;
}) {
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  const over = target > 0 && value > target;
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          {
            width: `${pct * 100}%`,
            backgroundColor: over ? Colors.success : color,
          },
        ]}
      />
    </View>
  );
}

// Segmented goal bar in summary card
function GoalSegmentBar({
  completed,
  over,
  total,
}: {
  completed: number;
  over: number;
  total: number;
}) {
  const pctDone = total > 0 ? (completed / total) * 100 : 0;
  const pctOver = total > 0 ? (over / total) * 100 : 0;
  return (
    <View style={styles.segmentTrack}>
      {pctDone > 0 && (
        <View style={[styles.segmentFill, { width: `${pctDone}%`, backgroundColor: Colors.accent }]} />
      )}
      {pctOver > 0 && (
        <View style={[styles.segmentFill, { width: `${pctOver}%`, backgroundColor: Colors.success }]} />
      )}
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<WeekStat[]>([]);
  const [totalSets, setTotalSets] = useState(0);
  const [monthlyVolume, setMonthlyVolume] = useState(0);
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('overview');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [weeklyHistory, setWeeklyHistory] = useState<HistoryPoint[]>([]);
  const [monthlyHistory, setMonthlyHistory] = useState<HistoryPoint[]>([]);
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [progressTab, setProgressTab] = useState<ProgressTab>('pending');
  const [weekKey, setWeekKey] = useState(getWeekKey());

  // Total target sets across all muscle groups
  const totalTargetSets = useMemo(
    () => stats.reduce((s, r) => s + r.targetSetsPerWeek, 0),
    [stats],
  );

  const load = useCallback(async () => {
    try {
      const { start, end } = getWeekRange();
      const result = await getMuscleGroupsWithWeeklyStats(start, end);
      setStats(result);
      setTotalSets(result.reduce((s, r) => s + r.weekly_sets, 0));

      const { start: mStart, end: mEnd } = getMonthRange();
      const volume = await getMonthlyVolume(mStart, mEnd);
      setMonthlyVolume(volume);

      setHistoryLoading(true);
      const weekPeriods = Array.from({ length: 5 }, (_, idx) => getWeekRangeByOffset(4 - idx));
      const monthPeriods = Array.from({ length: 5 }, (_, idx) => getMonthRangeByOffset(4 - idx));

      const [weeklyLogsByPeriod, monthlyLogsByPeriod] = await Promise.all([
        Promise.all(weekPeriods.map((period) => getWorkoutLogs(period.start, period.end))),
        Promise.all(monthPeriods.map((period) => getWorkoutLogs(period.start, period.end))),
      ]);

      const nextWeekly = weekPeriods.map((period, index) => ({
        key: period.key,
        label: period.label,
        title: period.title,
        sets: sumSets(weeklyLogsByPeriod[index] as any[]),
        reps: sumReps(weeklyLogsByPeriod[index] as any[]),
        volume: sumVolume(weeklyLogsByPeriod[index] as any[]),
        isCurrent: period.isCurrent,
      }));
      const nextMonthly = monthPeriods.map((period, index) => ({
        key: period.key,
        label: period.label,
        title: period.title,
        sets: sumSets(monthlyLogsByPeriod[index] as any[]),
        reps: sumReps(monthlyLogsByPeriod[index] as any[]),
        volume: sumVolume(monthlyLogsByPeriod[index] as any[]),
        isCurrent: period.isCurrent,
      }));

      setWeeklyHistory(nextWeekly);
      setMonthlyHistory(nextMonthly);
      setSelectedWeekKey(nextWeekly[nextWeekly.length - 1]?.key ?? null);
      setSelectedMonthKey(nextMonthly[nextMonthly.length - 1]?.key ?? null);
    } finally {
      setHistoryLoading(false);
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const nextWeekKey = getWeekKey();
      if (nextWeekKey !== weekKey) {
        setWeekKey(nextWeekKey);
        setSelectedCategories(new Set());
        setProgressTab('pending');
        load();
      }
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [load, weekKey]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const { start, end } = getWeekRange();
  const weekLabel = `${new Date(start).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} – ${new Date(end).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;

  const toggleCategory = (cat: string) => {
    const updated = new Set(selectedCategories);
    if (updated.has(cat)) {
      updated.delete(cat);
    } else {
      updated.add(cat);
    }
    setSelectedCategories(updated);
  };

  const categoryFilteredStats =
    selectedCategories.size === 0
      ? stats
      : stats.filter((s) => {
          const category = (s.category || 'Khác') as string;
          return selectedCategories.has(category);
        });

  const progressCounts = useMemo(
    () => ({
      completed: categoryFilteredStats.filter((s) => getProgressState(s) === 'completed').length,
      pending: categoryFilteredStats.filter((s) => getProgressState(s) === 'pending').length,
      over: categoryFilteredStats.filter((s) => getProgressState(s) === 'over').length,
    }),
    [categoryFilteredStats],
  );

  const filteredStats = categoryFilteredStats.filter((s) => getProgressState(s) === progressTab);
  const hasStatsForCurrentTab = filteredStats.length > 0;
  const displayedStats = hasStatsForCurrentTab ? filteredStats : categoryFilteredStats;

  // Monthly volume: number only, unit in hint
  const monthlyVolumeNumber =
    monthlyVolume >= 1000
      ? (monthlyVolume / 1000).toFixed(1)
      : Math.round(monthlyVolume).toLocaleString('vi-VN');
  const monthlyVolumeUnit = monthlyVolume >= 1000 ? 'tấn' : 'kg';

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
          />
        }
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Tuần này</Text>
              <Text style={styles.headerSub}>{weekLabel}</Text>
            </View>
            <SyncStatusChip />
          </View>
        </View>

        <View style={styles.dashboardTabRow}>
          <TouchableOpacity
            style={[styles.dashboardTabBtn, dashboardTab === 'overview' && styles.dashboardTabBtnActive]}
            onPress={() => setDashboardTab('overview')}
          >
            <Text style={[styles.dashboardTabText, dashboardTab === 'overview' && styles.dashboardTabTextActive]}>
              Tổng quan
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dashboardTabBtn, dashboardTab === 'history' && styles.dashboardTabBtnActive]}
            onPress={() => setDashboardTab('history')}
          >
            <Text style={[styles.dashboardTabText, dashboardTab === 'history' && styles.dashboardTabTextActive]}>
              Lịch sử
            </Text>
          </TouchableOpacity>
        </View>

        {dashboardTab === 'overview' ? (
          <>
            {/* ── 2-col stat grid: sets + volume ── */}
            <View style={styles.statGrid}>
              <View style={styles.statCard}>
                <View style={styles.statLabelRow}>
                  <TrendingUp color={Colors.accent} size={14} strokeWidth={2} />
                  <Text style={styles.statLabel}>Sets tuần này</Text>
                </View>
                <View style={styles.statValueRow}>
                  <Text style={[styles.statValue, { color: Colors.accent }]}>{totalSets}</Text>
                  <Text style={styles.statValueDivider}>/{totalTargetSets}</Text>
                </View>
                <Text style={styles.statHint}>
                  {stats.filter((s) => getProgressState(s) !== 'pending').length}/{stats.length} nhóm cơ
                </Text>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statLabelRow}>
                  <Dumbbell color={Colors.textSecondary} size={14} strokeWidth={2} />
                  <Text style={styles.statLabel}>Khối lượng / tháng</Text>
                </View>
                <Text style={styles.statValue}>{monthlyVolumeNumber}</Text>
                <Text style={styles.statHint}>sets × reps × kg ({monthlyVolumeUnit}) </Text>
              </View>
            </View>

            <View style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <Text style={styles.goalTitle}>Mục tiêu tuần</Text>
                <Text style={styles.goalRatio}>
                  {progressCounts.completed + progressCounts.over}/{stats.length} nhóm cơ
                </Text>
              </View>

              <GoalSegmentBar
                completed={progressCounts.completed}
                over={progressCounts.over}
                total={stats.length}
              />

              <View style={styles.goalChipRow}>
                <View style={[styles.goalChip, styles.statusCompleted]}>
                  <Text style={[styles.goalChipText, styles.statusCompletedText]}>
                    Hoàn thành {progressCounts.completed}
                  </Text>
                </View>
                <View style={[styles.goalChip, styles.statusPending]}>
                  <Text style={[styles.goalChipText, styles.statusPendingText]}>
                    Chưa {progressCounts.pending}
                  </Text>
                </View>
                <View style={[styles.goalChip, styles.statusOver]}>
                  <Text style={[styles.goalChipText, styles.statusOverText]}>
                    Vượt {progressCounts.over}
                  </Text>
                </View>
              </View>
            </View>

            {stats.length > 0 && (
              <View style={styles.filterSection}>
                <View style={styles.filterWrap}>
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategories.has(cat);
                    const count = stats.filter((s) => (s.category || 'Khác') === cat).length;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.filterChip, isSelected && styles.filterChipActive]}
                        onPress={() => toggleCategory(cat)}
                      >
                        <Text
                          style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}
                        >
                          {cat} ({count})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {stats.length > 0 && (
              <View style={styles.progressTabs}>
                {(
                  [
                    { key: 'completed', label: 'Hoàn thành', count: progressCounts.completed },
                    { key: 'pending', label: 'Chưa', count: progressCounts.pending },
                    { key: 'over', label: 'Vượt', count: progressCounts.over },
                  ] as const
                ).map((tab) => {
                  const isActive = progressTab === tab.key;
                  const isDisabled = tab.count === 0;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      style={[
                        styles.progressTab,
                        isActive && styles.progressTabActive,
                        isDisabled && styles.progressTabDisabled,
                      ]}
                      onPress={() => {
                        if (isDisabled) return;
                        setProgressTab(tab.key);
                      }}
                      disabled={isDisabled}
                    >
                      <Text
                        style={[
                          styles.progressTabText,
                          isActive && styles.progressTabTextActive,
                          isDisabled && styles.progressTabTextDisabled,
                        ]}
                      >
                        {tab.label}
                      </Text>
                      <View
                        style={[
                          styles.progressTabBadge,
                          isActive && styles.progressTabBadgeActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.progressTabBadgeText,
                            isActive && styles.progressTabBadgeTextActive,
                            isDisabled && styles.progressTabBadgeTextDisabled,
                          ]}
                        >
                          {tab.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {stats.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Chưa có nhóm cơ nào</Text>
                <Text style={styles.emptyText}>
                  Vào tab &quot;Nhóm cơ&quot; để thêm nhóm cơ và bài tập
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Tiến độ nhóm cơ ({displayedStats.length})</Text>

                {!hasStatsForCurrentTab && (
                  <View style={styles.filterHintBox}>
                    <Text style={styles.filterHintText}>
                      Không có nhóm cơ cho trạng thái đã chọn. Đang hiển thị tất cả nhóm trong bộ lọc hiện tại.
                    </Text>
                  </View>
                )}

                {displayedStats.map((s) => {
                  const progressCopy = getProgressCopy(s);
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={styles.muscleCard}
                      onPress={() => router.push(`/muscles/${s.id}`)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.muscleRow}>
                        <View style={[styles.dot, { backgroundColor: s.color }]} />
                        <View style={styles.muscleInfo}>
                          <View style={styles.muscleNameRow}>
                            <Text style={styles.muscleName}>{s.name}</Text>
                            <Text style={styles.exerciseCount}> · {s.exerciseCount} bài</Text>
                          </View>
                        </View>
                        <View style={[styles.statusChip, progressCopy.badgeStyle]}>
                          <Text style={[styles.statusChipText, progressCopy.badgeTextStyle]}>
                            {progressCopy.badgeLabel}
                          </Text>
                        </View>
                        <ChevronRight color={Colors.textMuted} size={16} strokeWidth={1.8} />
                      </View>

                      <View style={styles.setsRow}>
                        <Text style={[styles.setsActual, { color: progressCopy.accentColor }]}> 
                          {s.weekly_sets}
                        </Text>
                        <Text style={styles.setsSlash}> / </Text>
                        <Text style={styles.setsTarget}>{s.targetSetsPerWeek} sets</Text>
                      </View>

                      <ProgressBar
                        value={s.weekly_sets}
                        target={s.targetSetsPerWeek}
                        color={progressCopy.accentColor || s.color || Colors.accent}
                      />

                      <View style={styles.progressMetaRow}>
                        <Text style={styles.progressHelper}>{progressCopy.helperText}</Text>
                        <Text style={styles.progressPercent}>{progressCopy.progressText}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </>
        ) : (
          <HistoryTabSection
            historyLoading={historyLoading}
            weeklyHistory={weeklyHistory}
            monthlyHistory={monthlyHistory}
            selectedWeekKey={selectedWeekKey}
            selectedMonthKey={selectedMonthKey}
            setSelectedWeekKey={setSelectedWeekKey}
            setSelectedMonthKey={setSelectedMonthKey}
          />
        )}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textMuted, fontSize: 15 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  // ── Header ──
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  headerSub: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },

  dashboardTabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    gap: 6,
  },
  dashboardTabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  dashboardTabBtnActive: {
    backgroundColor: Colors.accent + '1f',
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  dashboardTabText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  dashboardTabTextActive: { color: Colors.accent },

  // ── 2-col stat grid ──
  statGrid: {
    flexDirection: 'row',
    marginHorizontal: 20,
    gap: 12,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  statLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  // Row for "totalSets / totalTargetSets"
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  statValueDivider: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
    lineHeight: 36,
  },
  statHint: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },

  // ── Goal progress card ──
  goalCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  goalTitle: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  goalRatio: { fontSize: 12, color: Colors.textMuted },

  segmentTrack: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: 12,
  },
  segmentFill: { height: '100%' },

  goalChipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  goalChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  goalChipText: { fontSize: 11, fontWeight: '700' },

  // ── Category filter ──
  filterSection: { paddingHorizontal: 20, marginBottom: 20 },
  filterWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  filterChipText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.bg, fontWeight: '700' },

  // ── Section title + tabs ──
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  progressTabs: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  progressTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressTabDisabled: {
    opacity: 0.45,
  },
  progressTabActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.surfaceElevated,
  },
  progressTabText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  progressTabTextDisabled: { color: Colors.textMuted },
  progressTabTextActive: { color: Colors.accent },
  progressTabBadge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: Colors.border,
    alignItems: 'center',
  },
  progressTabBadgeActive: { backgroundColor: Colors.accent + '20' },
  progressTabBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  progressTabBadgeTextDisabled: { color: Colors.textMuted },
  progressTabBadgeTextActive: { color: Colors.accent },
  filterHintBox: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  filterHintText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // ── Muscle cards ──
  muscleCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  muscleInfo: { flex: 1 },
  muscleNameRow: { flexDirection: 'row', alignItems: 'baseline' },
  muscleName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  exerciseCount: { fontSize: 12, color: Colors.textMuted, fontWeight: '400' },

  setsRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  setsActual: { fontSize: 22, fontWeight: '700' },
  setsSlash: { fontSize: 14, color: Colors.textMuted },
  setsTarget: { fontSize: 13, color: Colors.textMuted },

  progressTrack: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: { height: '100%', borderRadius: 2 },

  progressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  progressHelper: { fontSize: 11, color: Colors.textMuted, flex: 1 },
  progressPercent: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },

  // ── Status chips ──
  statusChip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  statusCompleted: { backgroundColor: Colors.accent + '20' },
  statusCompletedText: { color: Colors.accent },
  statusPending: { backgroundColor: Colors.textMuted + '1a' },
  statusPendingText: { color: Colors.textSecondary },
  statusOver: { backgroundColor: Colors.success + '20' },
  statusOverText: { color: Colors.success },

  // ── Empty states ──
  emptyBox: {
    margin: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});