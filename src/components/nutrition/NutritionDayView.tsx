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
import { ChevronLeft, ChevronRight, Plus, Settings, BookOpen, Trash2 } from 'lucide-react-native';
import {
  getNutrientConfigs,
  getNutritionLogsForDate,
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

const NUTRITION_ACCENT = '#4ADE80';

type MealType = 'morning' | 'noon' | 'evening' | 'snack';

const MEAL_LABELS: Record<MealType, string> = {
  morning: 'Sáng',
  noon: 'Trưa',
  evening: 'Tối',
  snack: 'Bữa phụ',
};
const MEAL_ORDER: MealType[] = ['morning', 'noon', 'evening', 'snack'];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(dateStr: string): string {
  const today = todayStr();
  const yesterday = offsetDate(today, -1);
  if (dateStr === today) return 'Hôm nay';
  if (dateStr === yesterday) return 'Hôm qua';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

function MacroBar({ value, target, color }: { value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  const over = target > 0 && value > target;
  return (
    <View style={styles.macroBarTrack}>
      <View
        style={[
          styles.macroBarFill,
          { width: `${pct * 100}%`, backgroundColor: over ? Colors.warning : color },
        ]}
      />
    </View>
  );
}

export default function NutritionDayView() {
  const [date, setDate] = useState(todayStr());
  const [configs, setConfigs] = useState<NutrientConfigItem[]>([]);
  const [goals, setGoals] = useState<NutritionGoalItem[]>([]);
  const [logs, setLogs] = useState<NutritionLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showAddLog, setShowAddLog] = useState(false);
  const [addLogMeal, setAddLogMeal] = useState<MealType>('snack');
  const [showConfig, setShowConfig] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  const load = useCallback(async (targetDate?: string) => {
    try {
      const d = targetDate || date;
      const [cfgs, gls, lgs] = await Promise.all([
        getNutrientConfigs(),
        getNutritionGoals(),
        getNutritionLogsForDate(d),
      ]);
      setConfigs(cfgs);
      setGoals(gls);
      setLogs(lgs);
    } finally {
      setLoading(false);
    }
  }, [date]);

  // Load on first render
  useEffect(() => { load(); }, []);

  const reload = useCallback(async () => {
    await load(date);
  }, [date, load]);

  const changeDate = async (delta: number) => {
    const newDate = offsetDate(date, delta);
    setDate(newDate);
    setLoading(true);
    const [lgs] = await Promise.all([getNutritionLogsForDate(newDate)]);
    setLogs(lgs);
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
        {/* ── Date nav + actions ── */}
        <View style={styles.topBar}>
          <View style={styles.dateNav}>
            <TouchableOpacity onPress={() => changeDate(-1)} style={styles.navBtn}>
              <ChevronLeft color={Colors.textSecondary} size={20} />
            </TouchableOpacity>
            <Text style={styles.dateLabel}>{formatDateLabel(date)}</Text>
            <TouchableOpacity
              onPress={() => changeDate(1)}
              style={[styles.navBtn, isToday && styles.navBtnDisabled]}
              disabled={isToday}
            >
              <ChevronRight color={isToday ? Colors.textMuted : Colors.textSecondary} size={20} />
            </TouchableOpacity>
          </View>
          <View style={styles.actionBtns}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowLibrary(true)}>
              <BookOpen color={Colors.textSecondary} size={18} strokeWidth={1.8} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowConfig(true)}>
              <Settings color={Colors.textSecondary} size={18} strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Macro summary card ── */}
        {enabledConfigs.length > 0 ? (
          <View style={styles.summaryCard}>
            {/* Calories - main */}
            {caloriesConfig && (
              <View style={styles.caloriesRow}>
                <View>
                  <Text style={styles.caloriesVal}>
                    {totals.calories || 0}
                    <Text style={styles.caloriesUnit}> kcal</Text>
                  </Text>
                  {goalMap.calories ? (
                    <Text style={styles.caloriesGoal}>/ {goalMap.calories} kcal mục tiêu</Text>
                  ) : null}
                </View>
                {goalMap.calories ? (
                  <Text style={styles.caloriesPct}>
                    {Math.round(((totals.calories || 0) / goalMap.calories) * 100)}%
                  </Text>
                ) : null}
              </View>
            )}
            {caloriesConfig && goalMap.calories && (
              <MacroBar
                value={totals.calories || 0}
                target={goalMap.calories}
                color={NUTRITION_ACCENT}
              />
            )}

            {/* Other macros grid */}
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
                      {target ? (
                        <MacroBar value={val} target={target} color={NUTRITION_ACCENT} />
                      ) : null}
                      {target ? (
                        <Text style={styles.macroTarget}>/ {target}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.configHint}
            onPress={() => setShowConfig(true)}
          >
            <Text style={styles.configHintText}>
              Nhấn để cấu hình chất dinh dưỡng cần theo dõi
            </Text>
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
                <TouchableOpacity
                  style={styles.mealAddBtn}
                  onPress={() => openAdd(mt)}
                >
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

        {/* ── FAB placeholder to keep scrollable content from overlapping FAB ── */}
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
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  dateNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.35 },
  dateLabel: { fontSize: 15, fontWeight: '700', color: Colors.text, minWidth: 90, textAlign: 'center' },
  actionBtns: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // Summary card
  summaryCard: {
    marginHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  caloriesRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  caloriesVal: { fontSize: 32, fontWeight: '800', color: Colors.text },
  caloriesUnit: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  caloriesGoal: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  caloriesPct: { fontSize: 22, fontWeight: '700', color: NUTRITION_ACCENT },

  macroBarTrack: {
    height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden',
  },
  macroBarFill: { height: '100%', borderRadius: 2 },

  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  macroItem: { minWidth: 72, gap: 2 },
  macroVal: { fontSize: 18, fontWeight: '700', color: Colors.text },
  macroUnit: { fontSize: 10, color: Colors.textMuted },
  macroName: { fontSize: 11, color: Colors.textSecondary, marginBottom: 4 },
  macroTarget: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  configHint: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: NUTRITION_ACCENT + '14',
    borderRadius: 12, borderWidth: 1, borderColor: NUTRITION_ACCENT + '30',
    padding: 14, alignItems: 'center',
  },
  configHintText: { fontSize: 13, color: NUTRITION_ACCENT, fontWeight: '600' },

  // Meal section
  mealSection: { marginHorizontal: 16, marginBottom: 14 },
  mealHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
  },
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
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  mealEmptyText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },

  // Log card
  logCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 6,
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

  // FAB
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: NUTRITION_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: NUTRITION_ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
});
