import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Plus, Settings, BookOpen, Trash2, Calculator } from 'lucide-react-native';
import Svg, { Rect, Line, Text as SvgText, G } from 'react-native-svg';
import {
  getNutrientConfigs,
  getNutritionLogsForDate,
  getNutritionLogsForDateRange,
  getNutritionGoals,
  deleteNutritionLog,
  type NutrientConfigItem,
  type NutritionLogItem,
  type NutritionGoalItem,
} from '@/src/lib/repository';
import { Colors } from '@/src/constants/colors';
import AddFoodLogModal from './AddFoodLogModal';
import NutrientConfigScreen from './NutrientConfigScreen';
import FoodLibraryScreen from './FoodLibraryScreen';
import TDEECalculatorScreen from './TDEECalculatorScreen';

const NUTRITION_ACCENT = '#4ADE80';
const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

type MealType = 'morning' | 'noon' | 'evening' | 'snack';

const MEAL_LABELS: Record<MealType, string> = {
  morning: 'Sáng', noon: 'Trưa', evening: 'Tối', snack: 'Bữa phụ',
};
const MEAL_ORDER: MealType[] = ['morning', 'noon', 'evening', 'snack'];

// ── Date utils ───────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekDates(dateStr: string): string[] {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`;
  });
}

function formatDateLabel(dateStr: string): string {
  const today = todayStr();
  const yesterday = offsetDate(today, -1);
  if (dateStr === today) return 'Hôm nay';
  if (dateStr === yesterday) return 'Hôm qua';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function sumNutrients(logs: NutritionLogItem[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const log of logs) {
    for (const [k, v] of Object.entries(log.nutrients_json)) {
      totals[k] = parseFloat(((totals[k] || 0) + v).toFixed(1));
    }
  }
  return totals;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MacroBar({ value, target, color }: { value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  const over = target > 0 && value > target;
  return (
    <View style={barStyles.track}>
      <View style={[barStyles.fill, { width: `${pct * 100}%`, backgroundColor: over ? Colors.warning : color }]} />
    </View>
  );
}
const barStyles = StyleSheet.create({
  track: { height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
});

interface WeekDay { date: string; calories: number; hasLogs: boolean; }

function WeekStrip({
  weekDays, selectedDate, onSelect,
}: {
  weekDays: WeekDay[]; selectedDate: string; onSelect: (d: string) => void;
}) {
  const today = todayStr();
  return (
    <View style={weekStyles.row}>
      {weekDays.map((wd, i) => {
        const isSelected = wd.date === selectedDate;
        const isToday = wd.date === today;
        const dateNum = parseInt(wd.date.slice(8), 10);
        return (
          <TouchableOpacity
            key={wd.date}
            style={[weekStyles.cell, isSelected && weekStyles.cellSelected]}
            onPress={() => onSelect(wd.date)}
            activeOpacity={0.7}
          >
            <Text style={[weekStyles.dayLabel, isSelected && weekStyles.dayLabelSelected]}>
              {DAY_LABELS[i]}
            </Text>
            <Text style={[
              weekStyles.dateNum,
              isSelected && weekStyles.dateNumSelected,
              isToday && !isSelected && weekStyles.dateNumToday,
            ]}>
              {dateNum}
            </Text>
            <View style={weekStyles.dotRow}>
              {wd.hasLogs && (
                <View style={[weekStyles.dot, isSelected && weekStyles.dotSelected]} />
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const weekStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10,
  },
  cellSelected: { backgroundColor: NUTRITION_ACCENT + '22' },
  dayLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 },
  dayLabelSelected: { color: NUTRITION_ACCENT },
  dateNum: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary, marginVertical: 2 },
  dateNumSelected: { color: NUTRITION_ACCENT },
  dateNumToday: { color: Colors.text },
  dotRow: { height: 6, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.textMuted },
  dotSelected: { backgroundColor: NUTRITION_ACCENT },
});

function WeekChart({
  weekDays, calorieGoal, selectedDate, onSelect,
}: {
  weekDays: WeekDay[]; calorieGoal: number; selectedDate: string; onSelect: (d: string) => void;
}) {
  const [width, setWidth] = useState(280);
  const CHART_H = 72;
  const BAR_MARGIN = 4;
  const barW = Math.floor((width - BAR_MARGIN * 14) / 7);
  const maxVal = Math.max(calorieGoal || 0, ...weekDays.map((d) => d.calories), 1);

  const goalY = calorieGoal > 0 ? CHART_H - (calorieGoal / maxVal) * CHART_H : -1;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Svg width={width} height={CHART_H}>
        {weekDays.map((wd, i) => {
          const barH = Math.max(2, (wd.calories / maxVal) * CHART_H);
          const x = i * (barW + BAR_MARGIN * 2) + BAR_MARGIN;
          const isSelected = wd.date === selectedDate;
          const fill = isSelected ? NUTRITION_ACCENT : wd.calories > 0 ? NUTRITION_ACCENT + '55' : Colors.border;
          return (
            <G key={wd.date} onPress={() => onSelect(wd.date)}>
              <Rect
                x={x} y={CHART_H - barH} width={barW} height={barH}
                rx={3} fill={fill}
              />
            </G>
          );
        })}
        {calorieGoal > 0 && goalY >= 0 && (
          <Line
            x1={0} y1={goalY} x2={width} y2={goalY}
            stroke={Colors.warning} strokeWidth={1}
            strokeDasharray="4,3"
          />
        )}
      </Svg>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NutritionDayView() {
  const [date, setDate] = useState(todayStr());
  const [configs, setConfigs] = useState<NutrientConfigItem[]>([]);
  const [goals, setGoals] = useState<NutritionGoalItem[]>([]);
  const [logs, setLogs] = useState<NutritionLogItem[]>([]);
  const [weekLogs, setWeekLogs] = useState<NutritionLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showAddLog, setShowAddLog] = useState(false);
  const [addLogMeal, setAddLogMeal] = useState<MealType>('snack');
  const [showConfig, setShowConfig] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showTdee, setShowTdee] = useState(false);

  const weekDates = useMemo(() => getWeekDates(date), [date]);

  const load = useCallback(async (targetDate?: string) => {
    try {
      const d = targetDate || date;
      const week = getWeekDates(d);
      const [cfgs, gls, lgs, wls] = await Promise.all([
        getNutrientConfigs(),
        getNutritionGoals(),
        getNutritionLogsForDate(d),
        getNutritionLogsForDateRange(week[0], week[6]),
      ]);
      setConfigs(cfgs);
      setGoals(gls);
      setLogs(lgs);
      setWeekLogs(wls);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, []);

  const reload = useCallback(async () => { await load(date); }, [date, load]);

  const changeDate = async (newDate: string) => {
    if (newDate > todayStr()) return;
    setDate(newDate);
    setLoading(true);
    const week = getWeekDates(newDate);
    const [lgs, wls] = await Promise.all([
      getNutritionLogsForDate(newDate),
      getNutritionLogsForDateRange(week[0], week[6]),
    ]);
    setLogs(lgs);
    setWeekLogs(wls);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load(date);
    setRefreshing(false);
  };

  const removeLog = async (id: string) => {
    await deleteNutritionLog(id);
    await reload();
  };

  const openAdd = (meal: MealType = 'snack') => {
    setAddLogMeal(meal);
    setShowAddLog(true);
  };

  const enabledConfigs = useMemo(() => configs.filter((c) => c.is_enabled), [configs]);
  const totals = useMemo(() => sumNutrients(logs), [logs]);
  const goalMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of goals) m[g.nutrient_key] = g.target_value;
    return m;
  }, [goals]);

  // Week summary: calories per day + has logs
  const weekDays: WeekDay[] = useMemo(() => weekDates.map((d) => {
    const dayLogs = weekLogs.filter((l) => l.logged_at.startsWith(d));
    const calories = dayLogs.reduce((s, l) => s + (l.nutrients_json.calories || 0), 0);
    return { date: d, calories: Math.round(calories), hasLogs: dayLogs.length > 0 };
  }), [weekDates, weekLogs]);

  const logsByMeal = useMemo(() => {
    const map: Record<MealType, NutritionLogItem[]> = {
      morning: [], noon: [], evening: [], snack: [],
    };
    for (const log of logs) {
      const mt = (log.meal_type || 'snack') as MealType;
      if (map[mt]) map[mt].push(log);
    }
    return map;
  }, [logs]);

  const isToday = date === todayStr();
  const caloriesConfig = enabledConfigs.find((c) => c.key === 'calories');
  const otherConfigs = enabledConfigs.filter((c) => c.key !== 'calories');
  const calorieGoal = goalMap.calories || 0;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={NUTRITION_ACCENT} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NUTRITION_ACCENT} />
        }
      >
        {/* ── Week calendar card ── */}
        <View style={styles.calendarCard}>
          {/* Month / year + action buttons */}
          <View style={styles.calendarHeader}>
            <Text style={styles.monthLabel}>
              {new Date(date + 'T00:00:00').toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
            </Text>
            <View style={styles.actionBtns}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowTdee(true)}>
                <Calculator color={Colors.textSecondary} size={16} strokeWidth={1.8} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowLibrary(true)}>
                <BookOpen color={Colors.textSecondary} size={16} strokeWidth={1.8} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowConfig(true)}>
                <Settings color={Colors.textSecondary} size={16} strokeWidth={1.8} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Week navigation */}
          <View style={styles.weekNavRow}>
            <TouchableOpacity
              style={styles.weekNavBtn}
              onPress={() => changeDate(offsetDate(weekDates[0], -7))}
            >
              <Text style={styles.weekNavText}>‹ Tuần trước</Text>
            </TouchableOpacity>
            <Text style={styles.selectedDateLabel}>{formatDateLabel(date)}</Text>
            <TouchableOpacity
              style={styles.weekNavBtn}
              onPress={() => changeDate(offsetDate(weekDates[0], 7))}
              disabled={weekDates[6] >= todayStr()}
            >
              <Text style={[styles.weekNavText, weekDates[6] >= todayStr() && styles.weekNavDisabled]}>
                Tuần sau ›
              </Text>
            </TouchableOpacity>
          </View>

          <WeekStrip weekDays={weekDays} selectedDate={date} onSelect={changeDate} />

          {/* Calorie chart */}
          {(caloriesConfig || weekDays.some((d) => d.calories > 0)) && (
            <View style={styles.chartWrap}>
              <WeekChart
                weekDays={weekDays}
                calorieGoal={calorieGoal}
                selectedDate={date}
                onSelect={changeDate}
              />
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: NUTRITION_ACCENT }]} />
                  <Text style={styles.legendText}>Calo / ngày</Text>
                </View>
                {calorieGoal > 0 && (
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDash, { borderColor: Colors.warning }]} />
                    <Text style={styles.legendText}>Mục tiêu {calorieGoal} kcal</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* ── Macro summary card ── */}
        {enabledConfigs.length > 0 ? (
          <View style={styles.summaryCard}>
            {caloriesConfig && (
              <View style={styles.caloriesRow}>
                <View>
                  <Text style={styles.caloriesVal}>
                    {totals.calories || 0}
                    <Text style={styles.caloriesUnit}> kcal</Text>
                  </Text>
                  {calorieGoal > 0 && (
                    <Text style={styles.caloriesGoal}>/ {calorieGoal} kcal mục tiêu</Text>
                  )}
                </View>
                {calorieGoal > 0 && (
                  <Text style={styles.caloriesPct}>
                    {Math.round(((totals.calories || 0) / calorieGoal) * 100)}%
                  </Text>
                )}
              </View>
            )}
            {caloriesConfig && calorieGoal > 0 && (
              <MacroBar value={totals.calories || 0} target={calorieGoal} color={NUTRITION_ACCENT} />
            )}
            {otherConfigs.length > 0 && (
              <View style={styles.macroGrid}>
                {otherConfigs.map((c) => {
                  const val = totals[c.key] || 0;
                  const target = goalMap[c.key];
                  return (
                    <View key={c.key} style={styles.macroItem}>
                      <Text style={styles.macroVal}>{val}</Text>
                      <Text style={styles.macroUnit}>{c.unit}</Text>
                      <Text style={styles.macroName}>{c.label}</Text>
                      {target ? <MacroBar value={val} target={target} color={NUTRITION_ACCENT} /> : null}
                      {target ? <Text style={styles.macroTarget}>/ {target}</Text> : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : (
          <TouchableOpacity style={styles.configHint} onPress={() => setShowConfig(true)}>
            <Text style={styles.configHintText}>Nhấn để cấu hình chất dinh dưỡng cần theo dõi</Text>
          </TouchableOpacity>
        )}

        {/* ── Meal sections ── */}
        {MEAL_ORDER.map((mt) => {
          const mealLogs = logsByMeal[mt];
          return (
            <View key={mt} style={styles.mealSection}>
              <View style={styles.mealHeader}>
                <Text style={styles.mealTitle}>{MEAL_LABELS[mt]}</Text>
                {mealLogs.length > 0 && (
                  <Text style={styles.mealCount}>{mealLogs.length} món</Text>
                )}
                <TouchableOpacity style={styles.mealAddBtn} onPress={() => openAdd(mt)}>
                  <Plus color={NUTRITION_ACCENT} size={16} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              {mealLogs.length === 0 ? (
                <TouchableOpacity style={styles.mealEmpty} onPress={() => openAdd(mt)}>
                  <Text style={styles.mealEmptyText}>+ Thêm món</Text>
                </TouchableOpacity>
              ) : (
                mealLogs.map((log) => (
                  <View key={log.id} style={styles.logCard}>
                    <View style={styles.logAccent} />
                    <View style={styles.logBody}>
                      <View style={styles.logTopRow}>
                        <Text style={styles.logName} numberOfLines={1}>{log.food_name}</Text>
                        <TouchableOpacity
                          onPress={() => removeLog(log.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 color={Colors.textMuted} size={13} strokeWidth={2} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.logMacros}>
                        {enabledConfigs.map((c) =>
                          log.nutrients_json[c.key] != null ? (
                            <Text key={c.key} style={styles.logMacroText}>
                              {log.nutrients_json[c.key]}{c.unit}
                              <Text style={styles.logMacroLabel}> {c.label.toLowerCase()}</Text>
                            </Text>
                          ) : null
                        )}
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          );
        })}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity style={styles.fab} onPress={() => openAdd()} activeOpacity={0.85}>
        <Plus color={Colors.bg} size={22} strokeWidth={2.5} />
      </TouchableOpacity>

      {/* ── Modals ── */}
      <AddFoodLogModal
        visible={showAddLog}
        defaultMeal={addLogMeal}
        defaultDate={date}
        onClose={() => setShowAddLog(false)}
        onSaved={reload}
      />
      <NutrientConfigScreen
        visible={showConfig}
        onClose={() => { setShowConfig(false); reload(); }}
      />
      <FoodLibraryScreen
        visible={showLibrary}
        onClose={() => setShowLibrary(false)}
      />
      <TDEECalculatorScreen
        visible={showTdee}
        onClose={() => setShowTdee(false)}
        onApplied={reload}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },

  // ── Calendar card ──
  calendarCard: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    padding: 14, gap: 10,
  },
  calendarHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  monthLabel: { fontSize: 13, fontWeight: '700', color: Colors.text },
  actionBtns: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  weekNavRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  weekNavBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  weekNavText: { fontSize: 12, fontWeight: '600', color: NUTRITION_ACCENT },
  weekNavDisabled: { color: Colors.textMuted },
  selectedDateLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },

  chartWrap: { gap: 6 },
  chartLegend: { flexDirection: 'row', gap: 14, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendDash: {
    width: 14, height: 0, borderTopWidth: 1.5,
    borderStyle: 'dashed', borderColor: Colors.warning,
  },
  legendText: { fontSize: 10, color: Colors.textMuted },

  // ── Summary card ──
  summaryCard: {
    marginHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    padding: 16, marginBottom: 12, gap: 12,
  },
  caloriesRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  caloriesVal: { fontSize: 32, fontWeight: '800', color: Colors.text },
  caloriesUnit: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  caloriesGoal: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  caloriesPct: { fontSize: 22, fontWeight: '700', color: NUTRITION_ACCENT },

  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  macroItem: { minWidth: 72, gap: 2 },
  macroVal: { fontSize: 18, fontWeight: '700', color: Colors.text },
  macroUnit: { fontSize: 10, color: Colors.textMuted },
  macroName: { fontSize: 11, color: Colors.textSecondary, marginBottom: 4 },
  macroTarget: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  configHint: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: NUTRITION_ACCENT + '14',
    borderRadius: 12, borderWidth: 1, borderColor: NUTRITION_ACCENT + '30',
    padding: 14, alignItems: 'center',
  },
  configHintText: { fontSize: 13, color: NUTRITION_ACCENT, fontWeight: '600' },

  // ── Meal sections ──
  mealSection: { marginHorizontal: 16, marginBottom: 14 },
  mealHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  mealTitle: {
    fontSize: 12, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, flex: 1,
  },
  mealCount: { fontSize: 11, color: Colors.textMuted },
  mealAddBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: NUTRITION_ACCENT + '18',
    borderWidth: 1, borderColor: NUTRITION_ACCENT + '40',
    alignItems: 'center', justifyContent: 'center',
  },
  mealEmpty: {
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    borderStyle: 'dashed', alignItems: 'center',
  },
  mealEmptyText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },

  logCard: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden', marginBottom: 6,
  },
  logAccent: { width: 3, backgroundColor: NUTRITION_ACCENT },
  logBody: { flex: 1, padding: 12 },
  logTopRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 6,
  },
  logName: { fontSize: 14, fontWeight: '600', color: Colors.text, flex: 1, marginRight: 8 },
  logMacros: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  logMacroText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  logMacroLabel: { fontWeight: '400', color: Colors.textMuted },

  fab: {
    position: 'absolute', bottom: 20, right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: NUTRITION_ACCENT,
    alignItems: 'center', justifyContent: 'center',
    elevation: 4,
    shadowColor: NUTRITION_ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 6,
  },
});
