import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMuscleGroupsWithWeeklyStats, getMonthlyVolume, getWorkoutLogs } from '@/src/lib/repository';
import type { WeekStat } from '@/src/lib/repository';
import { HistoryTabSection } from '../components/dashboard-tabs/HistoryTab';
import type { HistoryPoint } from '../components/dashboard-tabs/HistoryTab';
import { OverviewTab, getProgressState } from '../components/dashboard-tabs/OverviewTab';
import type { ProgressTab } from '../components/dashboard-tabs/OverviewTab';
import { SlidingTabs } from '@/src/components/common/SlidingTabs';
import { SyncStatusChip } from '@/src/components/SyncStatusChip';
import { Colors } from '@/src/constants/colors';

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

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<WeekStat[]>([]);
  const [totalSets, setTotalSets] = useState(0);
  const [monthlyVolume, setMonthlyVolume] = useState(0);
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
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'history'>('overview');

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

  const weekLabel = useMemo(() => {
    const { start, end } = getWeekRange();
    return `${new Date(start).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} – ${new Date(end).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
  }, [weekKey]);

  const toggleCategory = useCallback((cat: string) => {
    setSelectedCategories((prev) => {
      const updated = new Set(prev);
      if (updated.has(cat)) {
        updated.delete(cat);
      } else {
        updated.add(cat);
      }
      return updated;
    });
  }, []);

  const categoryFilteredStats = useMemo(
    () =>
      selectedCategories.size === 0
        ? stats
        : stats.filter((s) => selectedCategories.has((s.category || 'Khác') as string)),
    [stats, selectedCategories],
  );

  const progressCounts = useMemo(
    () => ({
      completed: categoryFilteredStats.filter((s) => getProgressState(s) === 'completed').length,
      pending: categoryFilteredStats.filter((s) => getProgressState(s) === 'pending').length,
      over: categoryFilteredStats.filter((s) => getProgressState(s) === 'over').length,
    }),
    [categoryFilteredStats],
  );

  const effectiveProgressTab = useMemo<ProgressTab>(() => {
    if (categoryFilteredStats.length === 0) return progressTab;
    if (progressCounts[progressTab] > 0) return progressTab;
    const order: ProgressTab[] = ['pending', 'completed', 'over'];
    return order.find((t) => progressCounts[t] > 0) ?? progressTab;
  }, [progressCounts, progressTab, categoryFilteredStats.length]);

  useEffect(() => {
    if (effectiveProgressTab !== progressTab) {
      setProgressTab(effectiveProgressTab);
    }
  }, [effectiveProgressTab, progressTab]);

  const filteredStats = useMemo(
    () => categoryFilteredStats.filter((s) => getProgressState(s) === effectiveProgressTab),
    [categoryFilteredStats, effectiveProgressTab],
  );
  const displayedStats = filteredStats;

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

      <SlidingTabs
        tabs={[
          { key: 'overview', label: 'Tổng quan' },
          { key: 'history', label: 'Lịch sử' },
        ]}
        activeTab={dashboardTab}
        onTabChange={(key) => setDashboardTab(key as 'overview' | 'history')}
        containerStyle={{ backgroundColor: Colors.bg }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
        renderTabBar={({ activeTab, onSelect }) => (
          <View style={styles.dashboardTabRow}>
            <TouchableOpacity
              style={[styles.dashboardTabBtn, activeTab === 'overview' && styles.dashboardTabBtnActive]}
              onPress={() => onSelect('overview')}
            >
              <Text style={[styles.dashboardTabText, activeTab === 'overview' && styles.dashboardTabTextActive]}>
                Tổng quan
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dashboardTabBtn, activeTab === 'history' && styles.dashboardTabBtnActive]}
              onPress={() => onSelect('history')}
            >
              <Text style={[styles.dashboardTabText, activeTab === 'history' && styles.dashboardTabTextActive]}>
                Lịch sử
              </Text>
            </TouchableOpacity>
          </View>
        )}
        renderScreen={(key) =>
          key === 'overview' ? (
            <OverviewTab
              stats={stats}
              totalSets={totalSets}
              totalTargetSets={totalTargetSets}
              monthlyVolumeNumber={monthlyVolumeNumber}
              monthlyVolumeUnit={monthlyVolumeUnit}
              selectedCategories={selectedCategories}
              toggleCategory={toggleCategory}
              progressCounts={progressCounts}
              effectiveProgressTab={effectiveProgressTab}
              setProgressTab={setProgressTab}
              categoryFilteredStats={categoryFilteredStats}
              displayedStats={displayedStats}
            />
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
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textMuted, fontSize: 15 },

  // ── Header ──
  header: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: Colors.bg },
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
});
