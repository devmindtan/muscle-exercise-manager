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
import Svg, { Rect, Line, G, Circle } from 'react-native-svg';
import {
  getNutrientConfigs,
  getNutritionLogsForDate,
  getNutritionLogsForDateRange,
  getNutritionGoals,
  deleteNutritionLog,
  getTdeeSettings,
  getLatestInBodySnapshot,
  type NutrientConfigItem,
  type NutritionLogItem,
  type NutritionGoalItem,
  type TdeeSettingsItem,
  type InBodySnapshot,
} from '@/src/lib/repository';
import { Colors } from '@/src/constants/colors';
import AddFoodLogModal from './AddFoodLogModal';
import NutrientConfigScreen from './NutrientConfigScreen';
import FoodLibraryScreen from './FoodLibraryScreen';
import TDEECalculatorScreen from './TDEECalculatorScreen';

const NUTRITION_ACCENT = '#4ADE80';
const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const FULL_DAY_NAMES = ['CHỦ NHẬT', 'THỨ HAI', 'THỨ BA', 'THỨ TƯ', 'THỨ NĂM', 'THỨ SÁU', 'THỨ BẢY'];
const NUTRIENT_COLORS: Record<string, string> = {
  protein: '#60A5FA',
  carbs: '#FBBF24',
  fat: '#F97316',
  fiber: '#34D399',
};

type MealType = 'morning' | 'noon' | 'evening' | 'snack';

const MEAL_LABELS: Record<MealType, string> = {
  morning: 'Sáng', noon: 'Trưa', evening: 'Tối', snack: 'Bữa phụ',
};
const MEAL_ORDER: MealType[] = ['morning', 'noon', 'evening', 'snack'];

// ── Date utils ────────────────────────────────────────────────────────────────

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
  const day = d.getDay();
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

function fmtNum(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
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
  cell: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
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
              <Rect x={x} y={CHART_H - barH} width={barW} height={barH} rx={3} fill={fill} />
            </G>
          );
        })}
        {calorieGoal > 0 && goalY >= 0 && (
          <Line
            x1={0} y1={goalY} x2={width} y2={goalY}
            stroke={Colors.warning} strokeWidth={1} strokeDasharray="4,3"
          />
        )}
      </Svg>
    </View>
  );
}

function CircleGauge({ value, total }: { value: number; total: number }) {
  const SIZE = 64;
  const R = 25;
  const circ = 2 * Math.PI * R;
  const pct = total > 0 ? Math.min(value / total, 1) : 0;
  const over = pct >= 1;
  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={Colors.border} strokeWidth={5} fill="none" />
        <Circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          stroke={over ? Colors.warning : NUTRITION_ACCENT}
          strokeWidth={5} fill="none"
          strokeDasharray={`${circ}`}
          strokeDashoffset={`${circ * (1 - pct)}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <Text style={gaugeStyles.pct}>{Math.round(pct * 100)}%</Text>
    </View>
  );
}
const gaugeStyles = StyleSheet.create({
  pct: { fontSize: 12, fontWeight: '700', color: Colors.text },
});

// ── Main component ────────────────────────────────────────────────────────────

export default function NutritionDayView() {
  const [date, setDate] = useState(todayStr());
  const [configs, setConfigs] = useState<NutrientConfigItem[]>([]);
  const [goals, setGoals] = useState<NutritionGoalItem[]>([]);
  const [logs, setLogs] = useState<NutritionLogItem[]>([]);
  const [weekLogs, setWeekLogs] = useState<NutritionLogItem[]>([]);
  const [tdeeSettings, setTdeeSettings] = useState<TdeeSettingsItem | null>(null);
  const [inBodySnapshot, setInBodySnapshot] = useState<InBodySnapshot | null>(null);
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
      const [cfgs, gls, lgs, wls, tdeeCfg, snap] = await Promise.all([
        getNutrientConfigs(),
        getNutritionGoals(),
        getNutritionLogsForDate(d),
        getNutritionLogsForDateRange(week[0], week[6]),
        getTdeeSettings(),
        getLatestInBodySnapshot(),
      ]);
      setConfigs(cfgs);
      setGoals(gls);
      setLogs(lgs);
      setWeekLogs(wls);
      setTdeeSettings(tdeeCfg);
      setInBodySnapshot(snap);
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
    if (tdeeSettings?.id && tdeeSettings.bmr_method === 'katch_mccardl' && inBodySnapshot?.lbm != null) {
      const bmr = Math.round(370 + 21.6 * inBodySnapshot.lbm);
      const tdee = Math.round(bmr / (tdeeSettings.bmr_pct / 100));
      m.calories = tdee;
      m.protein = Math.round(inBodySnapshot.lbm * tdeeSettings.protein_multiplier);
    }
    return m;
  }, [goals, tdeeSettings, inBodySnapshot]);

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

  const caloriesConfig = useMemo(() => enabledConfigs.find((c) => c.key === 'calories'), [enabledConfigs]);
  const otherConfigs = useMemo(() => enabledConfigs.filter((c) => c.key !== 'calories'), [enabledConfigs]);
  const calorieGoal = goalMap.calories || 0;
  const calConsumed = totals.calories || 0;
  const calRemaining = Math.max(0, calorieGoal - calConsumed);

  const dateObj = new Date(date + 'T00:00:00');
  const dayName = FULL_DAY_NAMES[dateObj.getDay()];
  const dayShortDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={NUTRITION_ACCENT} />
      </View>
    );
  }

  return (
    <>
      {/* ── Fixed header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerDay}>{dayName} · {dayShortDate}</Text>
          <Text style={styles.headerTitle}>{formatDateLabel(date)}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowTdee(true)}>
            <Calculator color={Colors.textSecondary} size={16} strokeWidth={1.8} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowLibrary(true)}>
            <BookOpen color={Colors.textSecondary} size={16} strokeWidth={1.8} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowConfig(true)}>
            <Settings color={Colors.textSecondary} size={16} strokeWidth={1.8} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => openAdd()}>
            <Plus color={Colors.bg} size={18} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NUTRITION_ACCENT} />
        }
      >
        {/* ── Week calendar card ── */}
        <View style={styles.calendarCard}>
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
                    <View style={styles.legendDash} />
                    <Text style={styles.legendText}>Mục tiêu {fmtNum(calorieGoal)} kcal</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* ── Calories summary card ── */}
        {enabledConfigs.length > 0 ? (
          <View style={styles.summaryCard}>
            <Text style={styles.sectionLabel}>ĐÃ NẠP HÔM NAY</Text>
            <View style={styles.caloriesMain}>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.caloriesValRow}>
                  <Text style={styles.caloriesVal}>{fmtNum(calConsumed)}</Text>
                  <Text style={styles.caloriesUnit}> kcal</Text>
                </View>
                {calorieGoal > 0 && (
                  <Text style={styles.caloriesGoalText}>Mục tiêu {fmtNum(calorieGoal)} kcal</Text>
                )}
              </View>
              {calorieGoal > 0 && (
                <View style={styles.caloriesGaugeSide}>
                  <Text style={styles.remainingVal}>{fmtNum(calRemaining)}</Text>
                  <Text style={styles.remainingLabel}>còn lại</Text>
                  <CircleGauge value={calConsumed} total={calorieGoal} />
                </View>
              )}
            </View>
            {calorieGoal > 0 && (
              <MacroBar value={calConsumed} target={calorieGoal} color={NUTRITION_ACCENT} />
            )}
          </View>
        ) : (
          <TouchableOpacity style={styles.configHint} onPress={() => setShowConfig(true)}>
            <Text style={styles.configHintText}>Nhấn để cấu hình chất dinh dưỡng cần theo dõi</Text>
          </TouchableOpacity>
        )}

        {/* ── Nutrients horizontal scroll ── */}
        {otherConfigs.length > 0 && (
          <View style={styles.nutrientsSection}>
            <Text style={[styles.sectionLabel, { paddingHorizontal: 16 }]}>CHẤT DINH DƯỠNG</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.nutrientsScroll}
            >
              {otherConfigs.map((c) => {
                const val = totals[c.key] || 0;
                const target = goalMap[c.key];
                const color = NUTRIENT_COLORS[c.key] || NUTRITION_ACCENT;
                return (
                  <View key={c.key} style={styles.nutrientCard}>
                    <Text style={[styles.nutrientVal, { color }]}>{val}</Text>
                    <Text style={styles.nutrientUnit}>{c.unit}</Text>
                    <Text style={styles.nutrientName}>{c.label}</Text>
                    {target ? (
                      <>
                        <MacroBar value={val} target={target} color={color} />
                        <Text style={styles.nutrientTarget}>/ {target}{c.unit}</Text>
                      </>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Meals section ── */}
        <View style={styles.mealsSection}>
          <Text style={styles.sectionLabel}>BỮA ĂN HÔM NAY</Text>
          {MEAL_ORDER.map((mt) => {
            const mealLogs = logsByMeal[mt];
            const mealCals = mealLogs.reduce((s, l) => s + (l.nutrients_json.calories || 0), 0);
            return (
              <View key={mt} style={styles.mealGroup}>
                <View style={styles.mealHeader}>
                  <Text style={styles.mealTitle}>{MEAL_LABELS[mt]}</Text>
                  {mealLogs.length > 0 && (
                    <Text style={styles.mealCals}>{fmtNum(mealCals)} kcal</Text>
                  )}
                  <TouchableOpacity style={styles.mealAddBtn} onPress={() => openAdd(mt)}>
                    <Plus color={NUTRITION_ACCENT} size={14} strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
                {mealLogs.map((log) => (
                  <View key={log.id} style={styles.mealItem}>
                    <Text style={styles.mealItemBullet}>•</Text>
                    <Text style={styles.mealItemName} numberOfLines={1}>{log.food_name}</Text>
                    <View style={styles.mealItemRight}>
                      {log.nutrients_json.calories != null && (
                        <Text style={styles.mealItemCals}>{fmtNum(log.nutrients_json.calories)} kcal</Text>
                      )}
                      <TouchableOpacity
                        onPress={() => removeLog(log.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 color={Colors.textMuted} size={12} strokeWidth={1.8} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                {mealLogs.length === 0 && (
                  <TouchableOpacity style={styles.mealEmpty} onPress={() => openAdd(mt)}>
                    <Text style={styles.mealEmptyText}>+ Thêm món</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerDay: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: NUTRITION_ACCENT,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Layout ──
  content: { paddingBottom: 20 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
  },

  // ── Calendar card ──
  calendarCard: {
    marginHorizontal: 16, marginTop: 14, marginBottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    padding: 14, gap: 10,
  },
  weekNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    padding: 16, gap: 12,
  },
  caloriesMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  caloriesValRow: { flexDirection: 'row', alignItems: 'flex-end' },
  caloriesVal: { fontSize: 36, fontWeight: '800', color: Colors.text, lineHeight: 42 },
  caloriesUnit: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary, marginBottom: 5 },
  caloriesGoalText: { fontSize: 11, color: Colors.textMuted },
  caloriesGaugeSide: { alignItems: 'center', gap: 2 },
  remainingVal: { fontSize: 18, fontWeight: '700', color: NUTRITION_ACCENT },
  remainingLabel: { fontSize: 10, color: Colors.textMuted },

  configHint: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: NUTRITION_ACCENT + '14',
    borderRadius: 12, borderWidth: 1, borderColor: NUTRITION_ACCENT + '30',
    padding: 14, alignItems: 'center',
  },
  configHintText: { fontSize: 13, color: NUTRITION_ACCENT, fontWeight: '600' },

  // ── Nutrients section ──
  nutrientsSection: { marginBottom: 12 },
  nutrientsScroll: { paddingHorizontal: 16, gap: 10 },
  nutrientCard: {
    width: 88,
    backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    padding: 12, gap: 2,
  },
  nutrientVal: { fontSize: 22, fontWeight: '800' },
  nutrientUnit: { fontSize: 10, color: Colors.textMuted },
  nutrientName: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600', marginBottom: 6 },
  nutrientTarget: { fontSize: 9, color: Colors.textMuted, marginTop: 2 },

  // ── Meals section ──
  mealsSection: { marginHorizontal: 16 },
  mealGroup: {
    backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 10, overflow: 'hidden',
  },
  mealHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 8,
  },
  mealTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, flex: 1 },
  mealCals: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  mealAddBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: NUTRITION_ACCENT + '18',
    borderWidth: 1, borderColor: NUTRITION_ACCENT + '40',
    alignItems: 'center', justifyContent: 'center',
  },
  mealItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.border, gap: 8,
  },
  mealItemBullet: { fontSize: 16, color: NUTRITION_ACCENT, lineHeight: 20 },
  mealItemName: { flex: 1, fontSize: 13, color: Colors.text, fontWeight: '500' },
  mealItemRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mealItemCals: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  mealEmpty: {
    paddingVertical: 12, paddingHorizontal: 14,
    borderTopWidth: 1, borderTopColor: Colors.border,
    alignItems: 'center',
  },
  mealEmptyText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
});
