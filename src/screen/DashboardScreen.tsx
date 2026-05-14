import { useState, useCallback } from 'react';
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
import { TrendingUp, ChevronRight } from 'lucide-react-native';
import { getMuscleGroupsWithWeeklyStats } from '@/src/lib/repository';
import type { WeekStat } from '@/src/lib/repository';
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

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<WeekStat[]>([]);
  const [totalSets, setTotalSets] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { start, end } = getWeekRange();
      const result = await getMuscleGroupsWithWeeklyStats(start, end);
      const sorted = [...result].sort((a, b) => a.progress - b.progress);
      setStats(sorted);
      setTotalSets(result.reduce((s, r) => s + r.weekly_sets, 0));
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

  const { start, end } = getWeekRange();
  const weekLabel = `${new Date(start).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} – ${new Date(end).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;

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
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Tuần này</Text>
              <Text style={styles.headerSub}>{weekLabel}</Text>
            </View>
            <SyncStatusChip />
          </View>
        </View>

        {/* Summary card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <TrendingUp color={Colors.accent} size={20} strokeWidth={2} />
            <Text style={styles.summaryLabel}>Tổng sets tuần này</Text>
          </View>
          <Text style={styles.summaryNumber}>{totalSets}</Text>
          <Text style={styles.summaryHint}>
            {stats.filter((s) => s.progress >= 1).length}/{stats.length} nhóm cơ
            đạt mục tiêu
          </Text>
        </View>

        {/* Muscle group list */}
        {stats.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Chưa có nhóm cơ nào</Text>
            <Text style={styles.emptyText}>
              Vào tab &quot;Nhóm cơ&quot; để thêm nhóm cơ và bài tập
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Tiến độ nhóm cơ</Text>
            {stats.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.muscleCard}
                onPress={() => router.push(`/muscles/${s.id}`)}
                activeOpacity={0.75}
              >
                <View style={styles.muscleRow}>
                  <View style={[styles.dot, { backgroundColor: s.color }]} />
                  <View style={styles.muscleInfo}>
                    <Text style={styles.muscleName}>{s.name}</Text>
                    <View style={styles.setsRow}>
                      <Text
                        style={[
                          styles.setsActual,
                          {
                            color:
                              s.progress >= 1 ? Colors.success : Colors.accent,
                          },
                        ]}
                      >
                        {s.weekly_sets}
                      </Text>
                      <Text style={styles.setsSlash}> / </Text>
                      <Text style={styles.setsTarget}>
                        {s.targetSetsPerWeek} sets
                      </Text>
                    </View>
                  </View>
                  <ChevronRight
                    color={Colors.textMuted}
                    size={16}
                    strokeWidth={1.8}
                  />
                </View>
                <ProgressBar
                  value={s.weekly_sets}
                  target={s.targetSetsPerWeek}
                  color={s.color || Colors.accent}
                />
                {s.targetSetsPerWeek > s.weekly_sets && (
                  <Text style={styles.remaining}>
                    Còn {s.targetSetsPerWeek - s.weekly_sets} sets
                  </Text>
                )}
                {s.progress >= 1 && (
                  <Text style={styles.done}>Đã đạt mục tiêu tuần</Text>
                )}
              </TouchableOpacity>
            ))}
          </>
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

  summaryCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  summaryNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.accent,
    lineHeight: 52,
  },
  summaryHint: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginHorizontal: 20,
    marginBottom: 12,
  },

  muscleCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  muscleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  muscleInfo: { flex: 1 },
  muscleName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  setsRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  setsActual: { fontSize: 20, fontWeight: '700' },
  setsSlash: { fontSize: 14, color: Colors.textMuted },
  setsTarget: { fontSize: 13, color: Colors.textMuted },

  progressTrack: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },

  remaining: { fontSize: 11, color: Colors.textMuted, marginTop: 8 },
  done: {
    fontSize: 11,
    color: Colors.success,
    marginTop: 8,
    fontWeight: '500',
  },

  emptyBox: {
    margin: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
