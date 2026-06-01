import { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { getWorkoutLogs } from '@/src/lib/repository';
import { Colors } from '@/src/constants/colors';
import { SyncStatusChip } from '@/src/components/SyncStatusChip';

type PeriodPoint = {
  key: string;
  label: string;
  title: string;
  sets: number;
  reps: number;
  isCurrent: boolean;
};

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

function HistoryCompareChart({
  points,
  selectedKey,
  onSelect,
}: {
  points: PeriodPoint[];
  selectedKey: string | null;
  onSelect: (point: PeriodPoint) => void;
}) {
  const maxSets = Math.max(...points.map((p) => p.sets), 1);
  const maxReps = Math.max(...points.map((p) => p.reps), 1);

  return (
    <View style={styles.chartWrap}>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.accent }]} />
          <Text style={styles.legendText}>Sets</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
          <Text style={styles.legendText}>Reps</Text>
        </View>
      </View>

      <View style={styles.barsRow}>
        {points.map((point) => {
          const setsPct = Math.max((point.sets / maxSets) * 100, point.sets > 0 ? 8 : 0);
          const repsPct = Math.max((point.reps / maxReps) * 100, point.reps > 0 ? 8 : 0);
          const isSelected = selectedKey === point.key;
          return (
            <TouchableOpacity
              key={point.key}
              style={[
                styles.barCol,
                point.isCurrent && styles.barColCurrent,
                isSelected && styles.barColSelected,
              ]}
              onPress={() => onSelect(point)}
              activeOpacity={0.8}
            >
              <View style={styles.barPair}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${setsPct}%`,
                        backgroundColor: point.isCurrent ? Colors.accent : Colors.accent + '99',
                      },
                    ]}
                  />
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${repsPct}%`,
                        backgroundColor: point.isCurrent ? Colors.success : Colors.success + '99',
                      },
                    ]}
                  />
                </View>
              </View>
              <Text style={[styles.barLabel, point.isCurrent && styles.barLabelCurrent]} numberOfLines={1}>
                {point.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function DashboardHistoryScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weeklyHistory, setWeeklyHistory] = useState<PeriodPoint[]>([]);
  const [monthlyHistory, setMonthlyHistory] = useState<PeriodPoint[]>([]);
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
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
        isCurrent: period.isCurrent,
      }));

      const nextMonthly = monthPeriods.map((period, index) => ({
        key: period.key,
        label: period.label,
        title: period.title,
        sets: sumSets(monthlyLogsByPeriod[index] as any[]),
        reps: sumReps(monthlyLogsByPeriod[index] as any[]),
        isCurrent: period.isCurrent,
      }));

      setWeeklyHistory(nextWeekly);
      setMonthlyHistory(nextMonthly);
      setSelectedWeekKey(nextWeekly[nextWeekly.length - 1]?.key ?? null);
      setSelectedMonthKey(nextMonthly[nextMonthly.length - 1]?.key ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const selectedWeek = useMemo(
    () => weeklyHistory.find((point) => point.key === selectedWeekKey) ?? weeklyHistory[weeklyHistory.length - 1] ?? null,
    [selectedWeekKey, weeklyHistory],
  );

  const selectedMonth = useMemo(
    () => monthlyHistory.find((point) => point.key === selectedMonthKey) ?? monthlyHistory[monthlyHistory.length - 1] ?? null,
    [selectedMonthKey, monthlyHistory],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        <View style={[styles.header, { paddingTop: insets.top + 15 }]}> 
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Tuần này</Text>
              <Text style={styles.headerSub}>Lịch sử so sánh theo tuần và tháng</Text>
            </View>
            <SyncStatusChip />
          </View>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity style={styles.tabBtn} onPress={() => router.back()}>
            <Text style={styles.tabText}>Tổng quan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, styles.tabBtnActive]} onPress={() => undefined}>
            <Text style={[styles.tabText, styles.tabTextActive]}>Lịch sử</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <Text style={styles.loadingText}>Đang tải lịch sử...</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Theo tuần</Text>
                <Text style={styles.cardMeta}>5 mốc gần nhất (gồm hiện tại)</Text>
              </View>
              <HistoryCompareChart
                points={weeklyHistory}
                selectedKey={selectedWeek?.key ?? null}
                onSelect={(point) => setSelectedWeekKey(point.key)}
              />
              {selectedWeek ? (
                <View style={styles.detailBox}>
                  <Text style={styles.detailTitle}>{selectedWeek.title}</Text>
                  <Text style={styles.detailText}>{selectedWeek.sets} sets</Text>
                  <Text style={styles.detailText}>{selectedWeek.reps} reps</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Theo tháng</Text>
                <Text style={styles.cardMeta}>5 mốc gần nhất (gồm hiện tại)</Text>
              </View>
              <HistoryCompareChart
                points={monthlyHistory}
                selectedKey={selectedMonth?.key ?? null}
                onSelect={(point) => setSelectedMonthKey(point.key)}
              />
              {selectedMonth ? (
                <View style={styles.detailBox}>
                  <Text style={styles.detailTitle}>{selectedMonth.title}</Text>
                  <Text style={styles.detailText}>{selectedMonth.sets} sets</Text>
                  <Text style={styles.detailText}>{selectedMonth.reps} reps</Text>
                </View>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 28 },

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

  tabRow: {
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
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: Colors.accent + '1f',
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  tabText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  tabTextActive: { color: Colors.accent },

  loadingCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
  },
  loadingText: { fontSize: 13, color: Colors.textMuted },

  card: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  cardHeader: { marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  cardMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 3 },

  chartWrap: { gap: 8 },
  legendRow: { flexDirection: 'row', gap: 14, marginBottom: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: Colors.textSecondary },

  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    minHeight: 128,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 3,
    paddingBottom: 4,
    borderRadius: 8,
  },
  barColCurrent: {
    backgroundColor: Colors.accent + '10',
    borderWidth: 1,
    borderColor: Colors.accent + '33',
  },
  barColSelected: {
    borderWidth: 1,
    borderColor: Colors.textSecondary + '66',
    backgroundColor: Colors.surfaceElevated,
  },
  barPair: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 88, width: '100%' },
  barTrack: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    backgroundColor: Colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: 6 },
  barLabel: { fontSize: 9, color: Colors.textMuted, marginTop: 5 },
  barLabelCurrent: { color: Colors.accent, fontWeight: '700' },

  detailBox: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  detailTitle: { fontSize: 12, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  detailText: { fontSize: 12, color: Colors.textSecondary },
});
