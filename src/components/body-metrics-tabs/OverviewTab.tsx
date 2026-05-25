import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/src/constants/colors';
import type { BodyMeasurement } from '@/src/types/database';

interface OverviewTabProps {
  summaryMetrics: readonly string[];
  latestMetrics: Map<string, BodyMeasurement>;
  historyByMetric: Map<string, BodyMeasurement[]>;
  selectedMetric: string;
  onSelectMetric: (metric: string) => void;
  selectedHistory: BodyMeasurement[];
  selectedMax: number;
  getMetricLabel: (key: string) => string;
  getMetricUnit: (key: string) => string;
  getTrendTone: (key: string, delta: number | null) => 'good' | 'warn' | 'neutral';
  formatDateShort: (value?: string | null) => string;
}

function OverviewTabComponent({
  summaryMetrics,
  latestMetrics,
  historyByMetric,
  selectedMetric,
  onSelectMetric,
  selectedHistory,
  selectedMax,
  getMetricLabel,
  getMetricUnit,
  getTrendTone,
  formatDateShort,
}: OverviewTabProps) {
  return (
    <>
      <View style={styles.statGrid}>
        {summaryMetrics.map((key) => {
          const latest = latestMetrics.get(key);
          const history = historyByMetric.get(key) ?? [];
          const delta = history.length >= 2 ? history[0].value - history[1].value : null;
          const tone = getTrendTone(key, delta);
          const isSelected = selectedMetric === key;

          return (
            <TouchableOpacity
              key={key}
              style={[styles.statCard, isSelected && styles.statCardActive]}
              onPress={() => onSelectMetric(key)}
              activeOpacity={0.75}
            >
              <Text style={styles.statLabel}>{getMetricLabel(key)}</Text>
              <Text style={[styles.statValue, isSelected && styles.statValueAccent]}>
                {latest != null ? `${latest.value}` : '—'}
                {latest ? <Text style={styles.statUnit}> {getMetricUnit(key)}</Text> : null}
              </Text>
              {delta != null ? (
                <Text
                  style={[
                    styles.statDelta,
                    tone === 'good' && styles.deltaGood,
                    tone === 'warn' && styles.deltaWarn,
                  ]}
                >
                  {delta > 0 ? '+' : ''}
                  {delta.toFixed(2)} so với lần trước
                </Text>
              ) : (
                <Text style={styles.statDeltaNeutral}>Chưa đủ dữ liệu</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Xu hướng</Text>
        <Text style={styles.sectionHint}>{getMetricLabel(selectedMetric)}</Text>
      </View>

      {selectedHistory.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Chưa có dữ liệu cho chỉ số này</Text>
        </View>
      ) : (
        <View style={styles.chartCard}>
          <View style={styles.chartInner}>
            {selectedHistory.map((item) => (
              <View key={item.id} style={styles.chartCol}>
                <Text style={styles.chartVal}>{item.value}</Text>
                <View style={styles.chartBarBg}>
                  <View
                    style={[
                      styles.chartBarFill,
                      { height: `${Math.max((item.value / selectedMax) * 100, 8)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.chartLabel}>{formatDateShort(item.measured_at)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  );
}

export const OverviewTab = memo(OverviewTabComponent);

const styles = StyleSheet.create({
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statCardActive: { borderColor: Colors.accent, backgroundColor: Colors.surfaceElevated },
  statLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500', marginBottom: 5 },
  statValue: { fontSize: 24, fontWeight: '700', color: Colors.text, lineHeight: 28 },
  statValueAccent: { color: Colors.accent },
  statUnit: { fontSize: 12, fontWeight: '400', color: Colors.textMuted },
  statDelta: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  statDeltaNeutral: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  deltaGood: { color: Colors.success },
  deltaWarn: { color: Colors.warning },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  sectionHint: { fontSize: 12, color: Colors.textSecondary },
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 16,
    marginBottom: 8,
  },
  chartInner: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, minHeight: 132 },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6, minWidth: 44 },
  chartVal: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600' },
  chartBarBg: {
    width: '100%',
    height: 72,
    backgroundColor: Colors.border,
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: { width: '100%', backgroundColor: Colors.accent, borderRadius: 8 },
  chartLabel: { fontSize: 10, color: Colors.textMuted },
  emptyBox: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  emptyText: { fontSize: 13, color: Colors.textMuted, lineHeight: 20 },
});
