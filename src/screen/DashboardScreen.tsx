import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMuscleGroupsWithStats, getMonthlyVolume, getWorkoutLogs } from '@/src/lib/repository';
import type { MuscleGroupStat } from '@/src/lib/repository';
import { HistoryTabSection } from '../components/dashboard-tabs/HistoryTab';
import type { HistoryPoint } from '../components/dashboard-tabs/HistoryTab';
import { OverviewTab, getProgressState } from '../components/dashboard-tabs/OverviewTab';
import type { ProgressTab } from '../components/dashboard-tabs/OverviewTab';
import { SlidingTabs } from '@/src/components/common/SlidingTabs';
import { RectTabBar } from '@/src/components/common/RectTabBar';
import { SyncStatusChip } from '@/src/components/SyncStatusChip';
import { useSync } from '@/src/context/SyncContext';
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
  const { lastSyncAt } = useSync();
  const [stats, setStats] = useState<MuscleGroupStat[]>([]);
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
  // Chỉ true trong lần load đầu tiên — các lần load() sau (do focus lại màn
  // hình hoặc do 1 lượt sync nền hoàn tất) chạy ngầm, không bật lại
  // historyLoading để tránh tab "Lịch sử" chớp về màn hình loading liên tục.
  const hasLoadedHistoryRef = useRef(false);

  // Chống load() chạy chồng: useFocusEffect (mount/focus) và useEffect theo
  // lastSyncAt có thể nổ ra gần như đồng thời lúc mới mở app (sync ban đầu
  // xong ngay sau khi màn hình vừa focus) — nếu đang có 1 lượt load() chạy
  // dở thì không chạy chồng thêm 1 lượt nữa, chỉ đánh dấu "pending" để chạy
  // lại đúng 1 lần ngay sau khi lượt đang chạy xong (đảm bảo vẫn phản ánh
  // dữ liệu mới nhất sau sync, không lùi lại thành throttle theo thời gian
  // vì thời điểm sync xong không đoán trước được).
  const isLoadingRef = useRef(false);
  const pendingReloadRef = useRef(false);

  // Total target sets across all muscle groups (theo mục tiêu tác động)
  const totalTargetSets = useMemo(
    () => stats.reduce((s, r) => s + r.targetImpactPerWeek, 0),
    [stats],
  );

  const load = useCallback(async () => {
    if (isLoadingRef.current) {
      pendingReloadRef.current = true;
      return;
    }
    isLoadingRef.current = true;
    const isInitialHistoryLoad = !hasLoadedHistoryRef.current;
    try {
      const { start, end } = getWeekRange();
      const { start: mStart, end: mEnd } = getMonthRange();
      const result = await getMuscleGroupsWithStats(start, end, mStart, mEnd);
      setStats(result);
      setTotalSets(result.reduce((s, r) => s + r.weekly_impact_sets, 0));

      const volume = await getMonthlyVolume(mStart, mEnd);
      setMonthlyVolume(volume);

      if (isInitialHistoryLoad) setHistoryLoading(true);
      const weekPeriods = Array.from({ length: 5 }, (_, idx) => getWeekRangeByOffset(4 - idx));
      const monthPeriods = Array.from({ length: 5 }, (_, idx) => getMonthRangeByOffset(4 - idx));

      // FIX: trước đây gọi getWorkoutLogs() riêng cho từng kỳ (10 query mỗi
      // lần focus màn hình). Khoảng 5 tháng đã bao trùm khoảng 5 tuần, nên
      // chỉ cần 1 query phủ toàn bộ khoảng rộng nhất rồi bucket lại theo
      // từng kỳ ngay trên client (so sánh chuỗi ISO là đủ vì cùng định dạng).
      const allPeriodBounds = [...weekPeriods, ...monthPeriods];
      const overallStart = allPeriodBounds.reduce(
        (min, p) => (p.start < min ? p.start : min),
        allPeriodBounds[0].start,
      );
      const overallEnd = allPeriodBounds.reduce(
        (max, p) => (p.end > max ? p.end : max),
        allPeriodBounds[0].end,
      );
      const allLogs = (await getWorkoutLogs(overallStart, overallEnd)) as any[];
      const logsInPeriod = (start: string, end: string) =>
        allLogs.filter((log) => log.logged_at >= start && log.logged_at <= end);

      const nextWeekly = weekPeriods.map((period) => {
        const periodLogs = logsInPeriod(period.start, period.end);
        return {
          key: period.key,
          label: period.label,
          title: period.title,
          sets: sumSets(periodLogs),
          reps: sumReps(periodLogs),
          volume: sumVolume(periodLogs),
          isCurrent: period.isCurrent,
        };
      });
      const nextMonthly = monthPeriods.map((period) => {
        const periodLogs = logsInPeriod(period.start, period.end);
        return {
          key: period.key,
          label: period.label,
          title: period.title,
          sets: sumSets(periodLogs),
          reps: sumReps(periodLogs),
          volume: sumVolume(periodLogs),
          isCurrent: period.isCurrent,
        };
      });

      setWeeklyHistory(nextWeekly);
      setMonthlyHistory(nextMonthly);
      // Giữ nguyên lựa chọn hiện tại của người dùng nếu vẫn còn tồn tại
      // trong dữ liệu mới — chỉ nhảy về kỳ mới nhất khi chưa chọn gì hoặc
      // lựa chọn cũ không còn (tránh việc tự nhảy về "Hiện tại" mỗi khi
      // nền tự sync trong lúc người dùng đang xem 1 tuần/tháng cũ).
      setSelectedWeekKey((prev) =>
        prev && nextWeekly.some((w) => w.key === prev) ? prev : (nextWeekly[nextWeekly.length - 1]?.key ?? null),
      );
      setSelectedMonthKey((prev) =>
        prev && nextMonthly.some((m) => m.key === prev) ? prev : (nextMonthly[nextMonthly.length - 1]?.key ?? null),
      );
    } finally {
      if (isInitialHistoryLoad) setHistoryLoading(false);
      hasLoadedHistoryRef.current = true;
      setLoading(false);
      isLoadingRef.current = false;
      if (pendingReloadRef.current) {
        pendingReloadRef.current = false;
        load();
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // FIX: đăng nhập lần đầu, sync ban đầu (kéo dữ liệu từ Supabase về SQLite
  // local) chạy song song và xong SAU khi useFocusEffect ở trên đã load xong
  // (lúc đó local DB còn trống) — nếu không lắng nghe sự kiện sync xong thì
  // màn hình sẽ đứng im với dữ liệu trống cho tới khi người dùng focus lại
  // (chuyển tab đi rồi quay lại). Load lại mỗi khi có 1 lượt sync hoàn tất.
  useEffect(() => {
    if (lastSyncAt) load();
  }, [lastSyncAt, load]);

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
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={[styles.loadingText, { marginTop: 12 }]}>Đang tải...</Text>
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
          <RectTabBar
            tabs={[
              { key: 'overview', label: 'Tổng quan' },
              { key: 'history', label: 'Lịch sử' },
            ]}
            activeTab={activeTab}
            onSelect={onSelect}
          />
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
});
