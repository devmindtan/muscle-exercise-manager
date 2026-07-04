import { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '@/src/constants/colors';
import { FriendActivityDay } from '@/src/services/socialService';

const CELL_SIZE = 11;
const CELL_GAP = 3;
const WEEKS_TO_SHOW = 26; // ~6 months — fits a mobile sheet without excessive scroll
const MONTH_LABELS = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];

// Sequential single-hue ramp (accent, alpha-blended over the app's dark
// surface) — level 0 is "no activity" using the neutral border color,
// levels 1-4 ramp lightness monotonically toward full accent brightness.
const LEVEL_COLORS = [Colors.border, '#454B22', '#717B31', '#A3B242', Colors.accent];

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDayLabel(d: Date) {
  return `${d.getDate()} thg ${d.getMonth() + 1}`;
}

interface DayCell {
  date: Date;
  key: string;
  totalSets: number;
  level: number;
  isFuture: boolean;
}

export function ActivityHeatmap({ days }: { days: FriendActivityDay[] }) {
  const scrollRef = useRef<ScrollView>(null);
  const [selected, setSelected] = useState<DayCell | null>(null);

  const { weeks, monthMarkers, maxValue } = useMemo(() => {
    const byDate = new Map<string, number>();
    let max = 0;
    for (const d of days) {
      byDate.set(d.date, d.totalSets);
      if (d.totalSets > max) max = d.totalSets;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Align the grid end to the coming Sunday and start N weeks back on a Monday.
    const endOfWeek = new Date(today);
    const todayDow = (today.getDay() + 6) % 7; // 0=Mon..6=Sun
    endOfWeek.setDate(today.getDate() + (6 - todayDow));
    const start = new Date(endOfWeek);
    start.setDate(endOfWeek.getDate() - WEEKS_TO_SHOW * 7 + 1);

    const weeksArr: DayCell[][] = [];
    const markers: { weekIndex: number; label: string }[] = [];
    let lastMonth = -1;
    const cursor = new Date(start);

    for (let w = 0; w < WEEKS_TO_SHOW; w++) {
      const col: DayCell[] = [];
      for (let d = 0; d < 7; d++) {
        const key = toDateKey(cursor);
        const isFuture = cursor > today;
        col.push({
          date: new Date(cursor),
          key,
          totalSets: byDate.get(key) ?? 0,
          level: isFuture ? -1 : levelFor(byDate.get(key) ?? 0, max),
          isFuture,
        });
        if (cursor.getMonth() !== lastMonth && d === 0) {
          lastMonth = cursor.getMonth();
          markers.push({ weekIndex: w, label: MONTH_LABELS[lastMonth] });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      weeksArr.push(col);
    }

    return { weeks: weeksArr, monthMarkers: markers, maxValue: max };
  }, [days]);

  function levelFor(value: number, max: number): number {
    if (value <= 0) return 0;
    if (max <= 0) return 0;
    const ratio = value / max;
    return Math.min(4, Math.max(1, Math.ceil(ratio * 4)));
  }

  return (
    <View style={styles.container}>
      <View style={styles.gridRow}>
        <View style={styles.weekdayCol}>
          <Text style={styles.weekdayLabel}> </Text>
          <Text style={styles.weekdayLabel}>T2</Text>
          <Text style={styles.weekdayLabel}> </Text>
          <Text style={styles.weekdayLabel}>T4</Text>
          <Text style={styles.weekdayLabel}> </Text>
          <Text style={styles.weekdayLabel}>T6</Text>
          <Text style={styles.weekdayLabel}> </Text>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          <View>
            <View style={styles.monthRow}>
              {weeks.map((_, w) => {
                const marker = monthMarkers.find((m) => m.weekIndex === w);
                return (
                  <View key={w} style={[styles.monthLabelSlot, { width: CELL_SIZE + CELL_GAP }]}>
                    {marker && (
                      <Text style={styles.monthLabel} numberOfLines={1}>
                        {marker.label}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
            <View style={styles.weeksRow}>
              {weeks.map((col, w) => (
                <View key={w} style={styles.weekCol}>
                  {col.map((cell) => (
                    <TouchableOpacity
                      key={cell.key}
                      disabled={cell.isFuture}
                      onPress={() => setSelected(cell)}
                      style={[
                        styles.cell,
                        { backgroundColor: cell.isFuture ? 'transparent' : LEVEL_COLORS[cell.level] },
                        selected?.key === cell.key && styles.cellSelected,
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      <Text style={styles.caption}>
        {selected
          ? `${formatDayLabel(selected.date)}: ${selected.totalSets} sets`
          : maxValue > 0
            ? 'Chạm vào 1 ô để xem chi tiết'
            : 'Chưa có buổi tập nào được ghi lại'}
      </Text>

      <View style={styles.legendRow}>
        <Text style={styles.legendText}>Ít hơn</Text>
        {LEVEL_COLORS.map((c, i) => (
          <View key={i} style={[styles.legendSwatch, { backgroundColor: c }]} />
        ))}
        <Text style={styles.legendText}>Nhiều hơn</Text>
      </View>
    </View>
  );
}

const MONTH_ROW_HEIGHT = 14;

const styles = StyleSheet.create({
  container: { gap: 8, alignSelf: 'stretch' },
  gridRow: { flexDirection: 'row' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 0 },
  weekdayCol: { justifyContent: 'space-between', paddingTop: MONTH_ROW_HEIGHT, marginRight: 4 },
  weekdayLabel: {
    fontSize: 9, color: Colors.textMuted,
    height: CELL_SIZE + CELL_GAP, lineHeight: CELL_SIZE + CELL_GAP,
  },
  monthRow: { flexDirection: 'row', height: MONTH_ROW_HEIGHT, overflow: 'visible' },
  monthLabelSlot: { height: MONTH_ROW_HEIGHT, overflow: 'visible' },
  monthLabel: {
    fontSize: 9, color: Colors.textMuted,
    position: 'absolute', left: 0, top: 0, width: 40,
  },
  weeksRow: { flexDirection: 'row' },
  weekCol: { marginRight: CELL_GAP },
  cell: {
    width: CELL_SIZE, height: CELL_SIZE, borderRadius: 3, marginBottom: CELL_GAP,
  },
  cellSelected: { borderWidth: 1.5, borderColor: Colors.text },
  caption: { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  legendText: { fontSize: 10, color: Colors.textMuted },
  legendSwatch: { width: 10, height: 10, borderRadius: 2, marginHorizontal: 1 },
});
