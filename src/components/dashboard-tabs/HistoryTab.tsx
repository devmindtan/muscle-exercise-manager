import { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { TrendingUp, TrendingDown, Minus, Activity, Layers, Dumbbell } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';

export type HistoryPoint = {
  key: string;
  label: string;
  title: string;
  sets: number;
  reps: number;
  volume: number;
  isCurrent: boolean;
};

function formatVolume(volume: number) {
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)} tấn`;
  }

  return `${Math.round(volume).toLocaleString('vi-VN')} kg`;
}

function AnimatedBar({
  pct,
  color,
  delay = 0,
}: {
  pct: number;
  color: string;
  delay?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 500,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, delay, pct]);

  const heightPct = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      style={[
        histStyles.animatedBar,
        { height: heightPct, backgroundColor: color, borderRadius: 5 },
      ]}
    />
  );
}

function TrendIndicator({ current, prev }: { current: number; prev: number }) {
  if (prev === 0 && current === 0) {
    return <Minus size={12} color={Colors.textMuted} strokeWidth={2.5} />;
  }

  const diff = current - prev;
  const pct = prev > 0 ? Math.round(Math.abs(diff / prev) * 100) : 100;

  if (diff > 0) {
    return (
      <View style={histStyles.trendRow}>
        <TrendingUp size={11} color={Colors.success} strokeWidth={2.5} />
        <Text style={[histStyles.trendText, { color: Colors.success }]}>+{pct}%</Text>
      </View>
    );
  }

  if (diff < 0) {
    return (
      <View style={histStyles.trendRow}>
        <TrendingDown size={11} color="#FF6B6B" strokeWidth={2.5} />
        <Text style={[histStyles.trendText, { color: '#FF6B6B' }]}>-{pct}%</Text>
      </View>
    );
  }

  return <Minus size={12} color={Colors.textMuted} strokeWidth={2.5} />;
}

export function HistoryCompareChart({
  points,
  selectedKey,
  onSelect,
  mode = 'week',
}: {
  points: HistoryPoint[];
  selectedKey: string | null;
  onSelect: (point: HistoryPoint) => void;
  mode?: 'week' | 'month';
}) {
  const maxSets = Math.max(...points.map((point) => point.sets), 1);
  const maxReps = Math.max(...points.map((point) => point.reps), 1);
  const peakSets = Math.max(...points.map((point) => point.sets), 0);

  const selectedIdx = selectedKey ? points.findIndex((point) => point.key === selectedKey) : -1;
  const selectedPoint = selectedIdx >= 0 ? points[selectedIdx] : points[points.length - 1] ?? null;
  const prevPoint = selectedIdx > 0 ? points[selectedIdx - 1] : null;

  return (
    <View style={histStyles.chartContainer}>
      <View style={histStyles.legendRow}>
        <View style={histStyles.legendItem}>
          <View style={[histStyles.legendDot, { backgroundColor: Colors.accent }]} />
          <Text style={histStyles.legendText}>Sets</Text>
        </View>
        <View style={histStyles.legendItem}>
          <View style={[histStyles.legendDot, { backgroundColor: Colors.success }]} />
          <Text style={histStyles.legendText}>Reps</Text>
        </View>
        {selectedPoint ? (
          <Text style={histStyles.legendHint}>
            {mode === 'week' ? 'Chọn cột để xem chi tiết' : 'Chọn cột để xem chi tiết'}
          </Text>
        ) : null}
      </View>

      <View style={histStyles.barsRow}>
        {points.map((point, idx) => {
          const setsPct = Math.max((point.sets / maxSets) * 100, point.sets > 0 ? 6 : 0);
          const repsPct = Math.max((point.reps / maxReps) * 100, point.reps > 0 ? 6 : 0);
          const isSelected = selectedKey === point.key;
          const isActive = isSelected || point.isCurrent;

          return (
            <TouchableOpacity
              key={point.key}
              style={[
                histStyles.barCol,
                point.isCurrent && histStyles.barColCurrent,
                isSelected && histStyles.barColSelected,
              ]}
              onPress={() => onSelect(point)}
              activeOpacity={0.75}
            >
              {point.sets === peakSets && point.sets > 0 ? (
                <Text style={histStyles.barTopLabel}>{point.sets}</Text>
              ) : null}

              <View style={histStyles.barPair}>
                <View style={histStyles.barTrack}>
                  <AnimatedBar
                    pct={setsPct}
                    color={isActive ? Colors.accent : Colors.accent + '55'}
                    delay={idx * 60}
                  />
                </View>
                <View style={histStyles.barTrack}>
                  <AnimatedBar
                    pct={repsPct}
                    color={isActive ? Colors.success : Colors.success + '55'}
                    delay={idx * 60 + 30}
                  />
                </View>
              </View>

              <Text
                style={[histStyles.barLabel, point.isCurrent && histStyles.barLabelCurrent]}
                numberOfLines={1}
              >
                {point.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedPoint ? (
        <View style={histStyles.detailCard}>
          <View style={histStyles.detailHeader}>
            <Text style={histStyles.detailTitle}>{selectedPoint.title}</Text>
            {selectedPoint.isCurrent ? (
              <View style={histStyles.currentBadge}>
                <Text style={histStyles.currentBadgeText}>Hien tai</Text>
              </View>
            ) : null}
          </View>

          <View style={histStyles.detailStatsRow}>
            <View style={histStyles.detailStat}>
              <View style={histStyles.detailStatIconRow}>
                <Layers size={13} color={Colors.accent} strokeWidth={2} />
                <Text style={histStyles.detailStatLabel}>Sets</Text>
              </View>
              <Text style={[histStyles.detailStatValue, { color: Colors.accent }]}>
                {selectedPoint.sets.toLocaleString('vi-VN')}
              </Text>
              {prevPoint ? <TrendIndicator current={selectedPoint.sets} prev={prevPoint.sets} /> : null}
            </View>

            <View style={histStyles.detailDivider} />

            <View style={histStyles.detailStat}>
              <View style={histStyles.detailStatIconRow}>
                <Activity size={13} color={Colors.success} strokeWidth={2} />
                <Text style={histStyles.detailStatLabel}>Reps</Text>
              </View>
              <Text style={[histStyles.detailStatValue, { color: Colors.success }]}>
                {selectedPoint.reps.toLocaleString('vi-VN')}
              </Text>
              {prevPoint ? <TrendIndicator current={selectedPoint.reps} prev={prevPoint.reps} /> : null}
            </View>

            <View style={histStyles.detailDivider} />

            <View style={histStyles.detailStat}>
              <View style={histStyles.detailStatIconRow}>
                <TrendingUp size={13} color={Colors.textSecondary} strokeWidth={2} />
                <Text style={histStyles.detailStatLabel}>Reps/set</Text>
              </View>
              <Text style={[histStyles.detailStatValue, { color: Colors.text }]}> 
                {selectedPoint.sets > 0 ? (selectedPoint.reps / selectedPoint.sets).toFixed(1) : '—'}
              </Text>
            </View>
          </View>

          <View style={histStyles.volumeCard}>
            <View style={histStyles.volumeHeader}>
              <View style={histStyles.volumeLabelRow}>
                <Dumbbell size={14} color={Colors.warning ?? Colors.textSecondary} strokeWidth={2} />
                <Text style={histStyles.volumeLabel}>Khối lượng</Text>
              </View>
              {prevPoint ? <TrendIndicator current={selectedPoint.volume} prev={prevPoint.volume} /> : null}
            </View>
            <Text style={histStyles.volumeValue}>{formatVolume(selectedPoint.volume)}</Text>
          </View>

          {prevPoint ? (
            <Text style={histStyles.detailCompareHint}>
              So với kỳ trước: {prevPoint.sets} sets · {prevPoint.reps} reps · {formatVolume(prevPoint.volume)}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function HistoryTabSection({
  historyLoading,
  weeklyHistory,
  monthlyHistory,
  selectedWeekKey,
  selectedMonthKey,
  setSelectedWeekKey,
  setSelectedMonthKey,
}: {
  historyLoading: boolean;
  weeklyHistory: HistoryPoint[];
  monthlyHistory: HistoryPoint[];
  selectedWeekKey: string | null;
  selectedMonthKey: string | null;
  setSelectedWeekKey: (key: string) => void;
  setSelectedMonthKey: (key: string) => void;
}) {
  const selectedWeekPoint = useMemo(
    () => weeklyHistory.find((point) => point.key === selectedWeekKey) ?? weeklyHistory[weeklyHistory.length - 1] ?? null,
    [selectedWeekKey, weeklyHistory],
  );
  const selectedMonthPoint = useMemo(
    () => monthlyHistory.find((point) => point.key === selectedMonthKey) ?? monthlyHistory[monthlyHistory.length - 1] ?? null,
    [selectedMonthKey, monthlyHistory],
  );

  if (historyLoading) {
    return (
      <View style={histStyles.loadingCard}>
        <View style={histStyles.loadingDot} />
        <Text style={histStyles.loadingText}>Dang tai lich su...</Text>
      </View>
    );
  }

  return (
    <>
      <View style={histStyles.sectionCard}>
        <View style={histStyles.sectionHeader}>
          <View>
            <Text style={histStyles.sectionTitle}>Theo tuần</Text>
            <Text style={histStyles.sectionMeta}>5 tuần gần nhất</Text>
          </View>
          <View style={histStyles.sectionBadge}>
            <Text style={histStyles.sectionBadgeText}>Weekly</Text>
          </View>
        </View>
        <HistoryCompareChart
          points={weeklyHistory}
          selectedKey={selectedWeekPoint?.key ?? null}
          onSelect={(point) => setSelectedWeekKey(point.key)}
          mode="week"
        />
      </View>

      <View style={histStyles.sectionCard}>
        <View style={histStyles.sectionHeader}>
          <View>
            <Text style={histStyles.sectionTitle}>Theo tháng</Text>
            <Text style={histStyles.sectionMeta}>5 tháng gần nhất</Text>
          </View>
          <View style={[histStyles.sectionBadge, { backgroundColor: Colors.success + '20' }]}>
            <Text style={[histStyles.sectionBadgeText, { color: Colors.success }]}>Monthly</Text>
          </View>
        </View>
        <HistoryCompareChart
          points={monthlyHistory}
          selectedKey={selectedMonthPoint?.key ?? null}
          onSelect={(point) => setSelectedMonthKey(point.key)}
          mode="month"
        />
      </View>
    </>
  );
}

const histStyles = StyleSheet.create({
  sectionCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  sectionMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sectionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.accent + '20',
  },
  sectionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  chartContainer: {
    gap: 12,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  legendHint: {
    fontSize: 10,
    color: Colors.textMuted,
    marginLeft: 'auto',
    fontStyle: 'italic',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    minHeight: 120,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 3,
    paddingTop: 18,
    paddingBottom: 4,
    borderRadius: 10,
  },
  barColCurrent: {
    backgroundColor: Colors.accent + '0d',
    borderWidth: 1,
    borderColor: Colors.accent + '44',
  },
  barColSelected: {
    backgroundColor: Colors.surfaceElevated ?? Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.accent + '88',
  },
  barTopLabel: {
    position: 'absolute',
    top: 4,
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  barPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 88,
    width: '100%',
  },
  barTrack: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    backgroundColor: Colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  animatedBar: {
    width: '100%',
  },
  barLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 5,
    textAlign: 'center',
  },
  barLabelCurrent: {
    color: Colors.accent,
    fontWeight: '700',
  },
  detailCard: {
    backgroundColor: Colors.surfaceElevated ?? Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 10,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Colors.accent + '20',
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.accent,
  },
  detailStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailStat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  detailDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  detailStatIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailStatLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  detailStatValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '700',
  },
  detailCompareHint: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    marginTop: -2,
  },
  volumeCard: {
    backgroundColor: Colors.surfaceElevated ?? Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  volumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  volumeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  volumeLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  volumeValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  loadingCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 32,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
