import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { X, ChevronDown, CheckCircle } from 'lucide-react-native';
import {
  getTdeeSettings,
  saveTdeeSettings,
  getLatestInBodySnapshot,
  saveNutritionGoal,
  getNutritionGoals,
  type TdeeSettingsItem,
  type InBodySnapshot,
} from '@/src/lib/repository';
import { Colors } from '@/src/constants/colors';

const NUTRITION_ACCENT = '#4ADE80';
const INFO_COLOR = '#60A5FA';

interface Props {
  visible: boolean;
  onClose: () => void;
  onApplied: () => void;
}

type BmrMethod = TdeeSettingsItem['bmr_method'];
type GoalType = TdeeSettingsItem['goal_type'];

const GOAL_LABELS: Record<GoalType, string> = {
  cut: 'Giảm mỡ (Cut)',
  maintain: 'Duy trì',
  bulk: 'Tăng cơ (Bulk)',
};

const GOAL_PROTEIN_BONUS: Record<GoalType, string> = {
  cut: '2.0–2.4 g/kg LBM để bảo toàn cơ',
  maintain: '1.6–2.0 g/kg LBM',
  bulk: '1.8–2.2 g/kg LBM để hỗ trợ phát triển',
};

const BMR_METHOD_LABELS: Record<BmrMethod, string> = {
  katch_mccardl: 'Katch-McArdle (từ LBM — chính xác nhất)',
  mifflin: 'Nhập BMR thủ công',
  custom: 'Nhập BMR thủ công',
};

function calcBmrKatch(lbm_kg: number): number {
  return Math.round(370 + 21.6 * lbm_kg);
}

function calcTdee(bmr: number, bmrPct: number): number {
  if (bmrPct <= 0) return 0;
  return Math.round(bmr / (bmrPct / 100));
}

function calcComponent(tdee: number, pct: number): number {
  return Math.round(tdee * (pct / 100));
}

function formatDate(isoStr: string | null): string {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Stepper component: -/+ buttons with value display
function PctStepper({
  label, value, min, max, step = 1, onChange, color = Colors.textSecondary,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; onChange: (v: number) => void; color?: string;
}) {
  return (
    <View style={stepperStyles.wrap}>
      <View style={stepperStyles.left}>
        <View style={[stepperStyles.dot, { backgroundColor: color }]} />
        <Text style={stepperStyles.label}>{label}</Text>
      </View>
      <View style={stepperStyles.controls}>
        <TouchableOpacity
          style={stepperStyles.btn}
          onPress={() => onChange(Math.max(min, value - step))}
        >
          <Text style={stepperStyles.btnText}>−</Text>
        </TouchableOpacity>
        <Text style={stepperStyles.val}>{value}%</Text>
        <TouchableOpacity
          style={stepperStyles.btn}
          onPress={() => onChange(Math.min(max, value + step))}
        >
          <Text style={stepperStyles.btnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const stepperStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  btnText: { fontSize: 18, fontWeight: '700', color: Colors.text, lineHeight: 22 },
  val: { fontSize: 15, fontWeight: '800', color: Colors.text, minWidth: 40, textAlign: 'center' },
});

export default function TDEECalculatorScreen({ visible, onClose, onApplied }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snapshot, setSnapshot] = useState<InBodySnapshot | null>(null);
  const [settings, setSettings] = useState<TdeeSettingsItem>({
    id: '', bmr_method: 'katch_mccardl', custom_bmr: null,
    bmr_pct: 65, neat_pct: 15, tef_pct: 10, eat_pct: 10,
    protein_multiplier: 1.8, goal_type: 'maintain',
  });
  const [customBmrInput, setCustomBmrInput] = useState('');
  const [multiplierInput, setMultiplierInput] = useState('1.8');
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [applied, setApplied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [snap, cfg] = await Promise.all([getLatestInBodySnapshot(), getTdeeSettings()]);
      setSnapshot(snap);
      setSettings(cfg);
      setCustomBmrInput(cfg.custom_bmr ? String(cfg.custom_bmr) : '');
      setMultiplierInput(String(cfg.protein_multiplier));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (visible) { setApplied(false); load(); } }, [visible]);

  // Derived calculations
  const useCustomBmr = settings.bmr_method !== 'katch_mccardl';
  const lbm = snapshot?.lbm ?? null;
  const autoBmr = lbm !== null ? calcBmrKatch(lbm) : null;
  const activeBmr = useCustomBmr
    ? (parseFloat(customBmrInput) || null)
    : autoBmr;
  const tdee = activeBmr ? calcTdee(activeBmr, settings.bmr_pct) : null;
  const neatKcal = tdee ? calcComponent(tdee, settings.neat_pct) : null;
  const tefKcal = tdee ? calcComponent(tdee, settings.tef_pct) : null;
  const eatKcal = tdee ? calcComponent(tdee, settings.eat_pct) : null;
  const pctSum = settings.bmr_pct + settings.neat_pct + settings.tef_pct + settings.eat_pct;
  const pctValid = pctSum === 100;
  const proteinMultiplier = parseFloat(multiplierInput) || settings.protein_multiplier;
  const proteinGoal = lbm !== null ? Math.round(lbm * proteinMultiplier) : null;

  const update = (patch: Partial<TdeeSettingsItem>) =>
    setSettings((s) => ({ ...s, ...patch }));

  const apply = async () => {
    if (!tdee || !pctValid) return;
    setSaving(true);
    try {
      const finalSettings: TdeeSettingsItem = {
        ...settings,
        custom_bmr: useCustomBmr ? (parseFloat(customBmrInput) || null) : null,
        protein_multiplier: proteinMultiplier,
      };
      await saveTdeeSettings(finalSettings);
      const existingGoals = await getNutritionGoals();

      // Save calorie goal
      const existingCalGoal = existingGoals.find((g) => g.nutrient_key === 'calories');
      await saveNutritionGoal({
        nutrient_key: 'calories', target_value: tdee, unit: 'kcal',
        existingId: existingCalGoal?.id,
      });

      // Save protein goal if available
      if (proteinGoal !== null) {
        const existingProtGoal = existingGoals.find((g) => g.nutrient_key === 'protein');
        await saveNutritionGoal({
          nutrient_key: 'protein', target_value: proteinGoal, unit: 'g',
          existingId: existingProtGoal?.id,
        });
      }

      setApplied(true);
      setTimeout(() => { onApplied(); onClose(); }, 1000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Tính TDEE & Protein</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X color={Colors.textSecondary} size={22} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={NUTRITION_ACCENT} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>

            {/* ── InBody snapshot ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Dữ liệu InBody mới nhất</Text>
              {snapshot?.measured_at ? (
                <Text style={styles.cardSub}>Đo ngày {formatDate(snapshot.measured_at)}</Text>
              ) : (
                <Text style={[styles.cardSub, { color: Colors.warning }]}>
                  Chưa có dữ liệu InBody — nhập thủ công BMR bên dưới
                </Text>
              )}
              <View style={styles.metricsRow}>
                <MetricBox label="Cân nặng" value={snapshot?.weight ?? null} unit="kg" />
                <MetricBox label="SMM" value={snapshot?.skeletal_muscle_mass ?? null} unit="kg" />
                <MetricBox label="Fat Mass" value={snapshot?.body_fat_mass ?? null} unit="kg" />
                <MetricBox label="LBM" value={lbm} unit="kg" highlight />
              </View>
              {lbm !== null && autoBmr !== null && (
                <View style={styles.bmrAutoRow}>
                  <Text style={styles.bmrAutoLabel}>BMR tự tính (Katch-McArdle)</Text>
                  <Text style={styles.bmrAutoVal}>{autoBmr} kcal/ngày</Text>
                </View>
              )}
            </View>

            {/* ── BMR method ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Phương pháp tính BMR</Text>
              <View style={styles.methodRow}>
                <TouchableOpacity
                  style={[styles.methodBtn, !useCustomBmr && styles.methodBtnActive]}
                  onPress={() => update({ bmr_method: 'katch_mccardl' })}
                  disabled={lbm === null}
                >
                  <Text style={[styles.methodBtnText, !useCustomBmr && styles.methodBtnTextActive]}>
                    Katch-McArdle
                  </Text>
                  {lbm === null && <Text style={styles.methodDisabled}>(cần InBody)</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.methodBtn, useCustomBmr && styles.methodBtnActive]}
                  onPress={() => update({ bmr_method: 'custom' })}
                >
                  <Text style={[styles.methodBtnText, useCustomBmr && styles.methodBtnTextActive]}>
                    Nhập tay
                  </Text>
                </TouchableOpacity>
              </View>

              {useCustomBmr && (
                <View style={styles.customBmrRow}>
                  <Text style={styles.label}>BMR (kcal/ngày)</Text>
                  <TextInput
                    style={styles.bmrInput}
                    keyboardType="decimal-pad"
                    placeholder="VD: 1600"
                    placeholderTextColor={Colors.textMuted}
                    value={customBmrInput}
                    onChangeText={setCustomBmrInput}
                  />
                </View>
              )}

              {activeBmr !== null && (
                <View style={styles.activeBmrBadge}>
                  <Text style={styles.activeBmrText}>BMR đang dùng: {activeBmr} kcal</Text>
                </View>
              )}
            </View>

            {/* ── TDEE components ── */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Phân rã TDEE</Text>
                <View style={[styles.sumBadge, pctValid ? styles.sumOk : styles.sumErr]}>
                  <Text style={[styles.sumText, pctValid ? styles.sumOkText : styles.sumErrText]}>
                    {pctSum}%
                  </Text>
                </View>
              </View>
              {!pctValid && (
                <Text style={styles.sumHint}>Tổng phần trăm phải = 100%</Text>
              )}

              <PctStepper label="BMR (nghỉ hoàn toàn)" value={settings.bmr_pct}
                min={50} max={80} onChange={(v) => update({ bmr_pct: v })} color="#818CF8" />
              <PctStepper label="NEAT (hoạt động thường ngày)" value={settings.neat_pct}
                min={5} max={30} onChange={(v) => update({ neat_pct: v })} color="#F59E0B" />
              <PctStepper label="TEF (tiêu hóa thức ăn)" value={settings.tef_pct}
                min={5} max={15} onChange={(v) => update({ tef_pct: v })} color="#EC4899" />
              <PctStepper label="EAT (tập luyện có chủ đích)" value={settings.eat_pct}
                min={0} max={30} onChange={(v) => update({ eat_pct: v })} color={NUTRITION_ACCENT} />

              {/* TDEE result */}
              {tdee !== null && pctValid && (
                <View style={styles.tdeeResult}>
                  <View style={styles.tdeeMain}>
                    <Text style={styles.tdeeVal}>{tdee}</Text>
                    <Text style={styles.tdeeUnit}>kcal / ngày</Text>
                  </View>
                  <View style={styles.tdeeBreakdown}>
                    <BreakdownItem color="#818CF8" label="BMR" kcal={activeBmr!} />
                    <BreakdownItem color="#F59E0B" label="NEAT" kcal={neatKcal!} />
                    <BreakdownItem color="#EC4899" label="TEF" kcal={tefKcal!} />
                    <BreakdownItem color={NUTRITION_ACCENT} label="EAT" kcal={eatKcal!} />
                  </View>
                </View>
              )}
            </View>

            {/* ── Protein target ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Mục tiêu Protein</Text>

              {/* Goal type picker */}
              <TouchableOpacity
                style={styles.goalPickerBtn}
                onPress={() => setShowGoalPicker(true)}
              >
                <Text style={styles.goalPickerLabel}>Mục tiêu hiện tại</Text>
                <View style={styles.goalPickerRight}>
                  <Text style={styles.goalPickerVal}>{GOAL_LABELS[settings.goal_type]}</Text>
                  <ChevronDown color={Colors.textMuted} size={14} />
                </View>
              </TouchableOpacity>

              <Text style={styles.goalHint}>{GOAL_PROTEIN_BONUS[settings.goal_type]}</Text>

              {/* Multiplier stepper */}
              <View style={styles.multiplierRow}>
                <Text style={styles.label}>Hệ số protein (g / kg LBM)</Text>
                <View style={stepperStyles.controls}>
                  <TouchableOpacity
                    style={stepperStyles.btn}
                    onPress={() => {
                      const v = Math.max(1.0, parseFloat(multiplierInput) - 0.1);
                      setMultiplierInput(v.toFixed(1));
                    }}
                  >
                    <Text style={stepperStyles.btnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={[stepperStyles.val, { minWidth: 52 }]}>
                    {parseFloat(multiplierInput).toFixed(1)}
                  </Text>
                  <TouchableOpacity
                    style={stepperStyles.btn}
                    onPress={() => {
                      const v = Math.min(3.0, parseFloat(multiplierInput) + 0.1);
                      setMultiplierInput(v.toFixed(1));
                    }}
                  >
                    <Text style={stepperStyles.btnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {lbm !== null && proteinGoal !== null ? (
                <View style={styles.proteinResult}>
                  <Text style={styles.proteinVal}>{proteinGoal}<Text style={styles.proteinUnit}> g</Text></Text>
                  <Text style={styles.proteinSub}>
                    = {lbm.toFixed(1)} kg LBM × {proteinMultiplier.toFixed(1)} g/kg
                  </Text>
                </View>
              ) : (
                <View style={[styles.proteinResult, { backgroundColor: Colors.surfaceElevated }]}>
                  <Text style={styles.noLbmText}>
                    Cần có dữ liệu InBody (cân nặng + body fat) để tự tính.
                    Nhập BMR thủ công để tính TDEE, và đặt mục tiêu protein tay trong cấu hình chất dinh dưỡng.
                  </Text>
                </View>
              )}
            </View>

            {/* ── Apply button ── */}
            <TouchableOpacity
              style={[
                styles.applyBtn,
                (!tdee || !pctValid || saving) && styles.applyBtnDisabled,
                applied && styles.applyBtnSuccess,
              ]}
              onPress={apply}
              disabled={!tdee || !pctValid || saving || applied}
            >
              {applied ? (
                <View style={styles.applyRow}>
                  <CheckCircle color={Colors.bg} size={18} strokeWidth={2.5} />
                  <Text style={styles.applyBtnText}>Đã áp dụng!</Text>
                </View>
              ) : saving ? (
                <ActivityIndicator color={Colors.bg} size="small" />
              ) : (
                <Text style={styles.applyBtnText}>
                  {tdee && pctValid ? `Áp dụng — ${tdee} kcal${proteinGoal ? ` / ${proteinGoal}g protein` : ''}` : 'Tổng % phải = 100%'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>

      {/* Goal type picker modal */}
      <Modal visible={showGoalPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowGoalPicker(false)}
        />
        <View style={styles.pickerSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.pickerTitle}>Mục tiêu của bạn</Text>
          {(Object.keys(GOAL_LABELS) as GoalType[]).map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.pickerOption, settings.goal_type === g && styles.pickerOptionActive]}
              onPress={() => { update({ goal_type: g }); setShowGoalPicker(false); }}
            >
              <View>
                <Text style={[styles.pickerOptionText, settings.goal_type === g && styles.pickerOptionTextActive]}>
                  {GOAL_LABELS[g]}
                </Text>
                <Text style={styles.pickerOptionHint}>{GOAL_PROTEIN_BONUS[g]}</Text>
              </View>
              {settings.goal_type === g && (
                <CheckCircle color={NUTRITION_ACCENT} size={18} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </Modal>
  );
}

function MetricBox({ label, value, unit, highlight }: {
  label: string; value: number | null; unit: string; highlight?: boolean;
}) {
  return (
    <View style={[metricBoxStyles.box, highlight && metricBoxStyles.boxHighlight]}>
      <Text style={[metricBoxStyles.val, highlight && metricBoxStyles.valHighlight]}>
        {value !== null ? value.toFixed(1) : '—'}
      </Text>
      <Text style={metricBoxStyles.unit}>{unit}</Text>
      <Text style={metricBoxStyles.label}>{label}</Text>
    </View>
  );
}

const metricBoxStyles = StyleSheet.create({
  box: {
    flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', paddingVertical: 10,
  },
  boxHighlight: { borderColor: NUTRITION_ACCENT, backgroundColor: NUTRITION_ACCENT + '14' },
  val: { fontSize: 18, fontWeight: '800', color: Colors.text },
  valHighlight: { color: NUTRITION_ACCENT },
  unit: { fontSize: 10, color: Colors.textMuted },
  label: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
});

function BreakdownItem({ color, label, kcal }: { color: string; label: string; kcal: number }) {
  return (
    <View style={breakdownStyles.item}>
      <View style={[breakdownStyles.dot, { backgroundColor: color }]} />
      <Text style={breakdownStyles.label}>{label}</Text>
      <Text style={breakdownStyles.kcal}>{kcal} kcal</Text>
    </View>
  );
}

const breakdownStyles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  kcal: { fontSize: 13, fontWeight: '700', color: Colors.text },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },
  closeBtn: { padding: 4 },
  content: { padding: 16, gap: 12 },

  card: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, gap: 12,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardSub: { fontSize: 12, color: Colors.textMuted },

  metricsRow: { flexDirection: 'row', gap: 8 },

  bmrAutoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  bmrAutoLabel: { fontSize: 13, color: Colors.textSecondary },
  bmrAutoVal: { fontSize: 14, fontWeight: '800', color: NUTRITION_ACCENT },

  methodRow: { flexDirection: 'row', gap: 8 },
  methodBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border,
  },
  methodBtnActive: { borderColor: NUTRITION_ACCENT, backgroundColor: NUTRITION_ACCENT + '18' },
  methodBtnText: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  methodBtnTextActive: { color: NUTRITION_ACCENT },
  methodDisabled: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  customBmrRow: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  bmrInput: {
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 20, fontWeight: '700', color: Colors.text,
  },
  activeBmrBadge: {
    backgroundColor: NUTRITION_ACCENT + '18', borderRadius: 8,
    borderWidth: 1, borderColor: NUTRITION_ACCENT + '40',
    paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center',
  },
  activeBmrText: { fontSize: 13, fontWeight: '700', color: NUTRITION_ACCENT },

  sumBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  sumOk: { backgroundColor: NUTRITION_ACCENT + '20' },
  sumErr: { backgroundColor: Colors.error + '20' },
  sumText: { fontSize: 13, fontWeight: '800' },
  sumOkText: { color: NUTRITION_ACCENT },
  sumErrText: { color: Colors.error },
  sumHint: { fontSize: 12, color: Colors.error, marginTop: -4 },

  tdeeResult: {
    backgroundColor: Colors.surfaceElevated, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, gap: 12, marginTop: 4,
  },
  tdeeMain: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  tdeeVal: { fontSize: 40, fontWeight: '900', color: Colors.text },
  tdeeUnit: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  tdeeBreakdown: { gap: 2 },

  goalPickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: Colors.surfaceElevated, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  goalPickerLabel: { fontSize: 13, color: Colors.textSecondary },
  goalPickerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  goalPickerVal: { fontSize: 14, fontWeight: '700', color: Colors.text },

  goalHint: { fontSize: 12, color: Colors.textMuted, lineHeight: 18 },

  multiplierRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },

  proteinResult: {
    backgroundColor: NUTRITION_ACCENT + '14', borderRadius: 12,
    borderWidth: 1, borderColor: NUTRITION_ACCENT + '40',
    padding: 16, alignItems: 'center', gap: 4,
  },
  proteinVal: { fontSize: 36, fontWeight: '900', color: NUTRITION_ACCENT },
  proteinUnit: { fontSize: 16, fontWeight: '600' },
  proteinSub: { fontSize: 12, color: Colors.textSecondary },
  noLbmText: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },

  applyBtn: {
    backgroundColor: NUTRITION_ACCENT, borderRadius: 14,
    paddingVertical: 18, alignItems: 'center', marginTop: 4,
  },
  applyBtnDisabled: { backgroundColor: Colors.border },
  applyBtnSuccess: { backgroundColor: Colors.success },
  applyRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  applyBtnText: { fontSize: 16, fontWeight: '800', color: Colors.bg },

  // Goal picker
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  pickerSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40, gap: 4,
  },
  sheetHandle: {
    width: 36, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 12,
  },
  pickerTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  pickerOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceElevated,
    marginBottom: 6,
  },
  pickerOptionActive: { borderColor: NUTRITION_ACCENT, backgroundColor: NUTRITION_ACCENT + '14' },
  pickerOptionText: { fontSize: 14, fontWeight: '700', color: Colors.text },
  pickerOptionTextActive: { color: NUTRITION_ACCENT },
  pickerOptionHint: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
});
