import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { X, ChevronRight } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getNutrientConfigs,
  getNutritionGoals,
  saveNutrientConfig,
  saveNutritionGoal,
  deleteNutritionGoalByKey,
  type NutrientConfigItem,
  type NutritionGoalItem,
} from '@/src/lib/repository';
import { Colors } from '@/src/constants/colors';

const NUTRITION_ACCENT = '#4ADE80';

interface GoalEditState {
  config: NutrientConfigItem;
  goal: NutritionGoalItem | null;
  inputValue: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function NutrientConfigScreen({ visible, onClose }: Props) {
  const [configs, setConfigs] = useState<NutrientConfigItem[]>([]);
  const [goals, setGoals] = useState<NutritionGoalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<GoalEditState | null>(null);

  const load = useCallback(async () => {
    try {
      const [cfgs, gls] = await Promise.all([getNutrientConfigs(), getNutritionGoals()]);
      setConfigs(cfgs);
      setGoals(gls);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { if (visible) load(); }, [visible, load]));

  const toggleEnabled = async (config: NutrientConfigItem) => {
    const updated = { ...config, is_enabled: !config.is_enabled };
    setSaving(config.id);
    try {
      await saveNutrientConfig(updated);
      setConfigs((prev) => prev.map((c) => (c.id === config.id ? updated : c)));
    } finally {
      setSaving(null);
    }
  };

  const openGoalEdit = (config: NutrientConfigItem) => {
    const goal = goals.find((g) => g.nutrient_key === config.key) || null;
    setEditingGoal({ config, goal, inputValue: goal ? String(goal.target_value) : '' });
  };

  const saveGoal = async () => {
    if (!editingGoal) return;
    const val = parseFloat(editingGoal.inputValue);
    if (isNaN(val) || val <= 0) {
      setEditingGoal(null);
      return;
    }
    setSaving(editingGoal.config.id);
    try {
      await saveNutritionGoal({
        nutrient_key: editingGoal.config.key,
        target_value: val,
        unit: editingGoal.config.unit,
        existingId: editingGoal.goal?.id,
      });
      await load();
    } finally {
      setSaving(null);
      setEditingGoal(null);
    }
  };

  const removeGoal = async (nutrientKey: string) => {
    await deleteNutritionGoalByKey(nutrientKey);
    await load();
    setEditingGoal(null);
  };

  const enabledConfigs = configs.filter((c) => c.is_enabled);
  const disabledConfigs = configs.filter((c) => !c.is_enabled);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Cấu hình chất dinh dưỡng</Text>
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
            <Text style={styles.sectionLabel}>Đang theo dõi</Text>
            {enabledConfigs.map((cfg) => {
              const goal = goals.find((g) => g.nutrient_key === cfg.key);
              return (
                <View key={cfg.id} style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.nutrientLabel}>{cfg.label}</Text>
                    <Text style={styles.nutrientUnit}>{cfg.unit}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.goalBtn}
                    onPress={() => openGoalEdit(cfg)}
                  >
                    <Text style={[styles.goalText, !goal && styles.goalTextEmpty]}>
                      {goal ? `${goal.target_value} ${cfg.unit}/ngày` : 'Đặt mục tiêu'}
                    </Text>
                    <ChevronRight color={Colors.textMuted} size={14} />
                  </TouchableOpacity>
                  <Switch
                    value={cfg.is_enabled}
                    onValueChange={() => toggleEnabled(cfg)}
                    trackColor={{ false: Colors.border, true: NUTRITION_ACCENT + '60' }}
                    thumbColor={cfg.is_enabled ? NUTRITION_ACCENT : Colors.textMuted}
                    disabled={saving === cfg.id}
                  />
                </View>
              );
            })}

            {disabledConfigs.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Không theo dõi</Text>
                {disabledConfigs.map((cfg) => (
                  <View key={cfg.id} style={[styles.row, styles.rowDisabled]}>
                    <View style={styles.rowLeft}>
                      <Text style={[styles.nutrientLabel, styles.disabledText]}>{cfg.label}</Text>
                      <Text style={[styles.nutrientUnit, styles.disabledText]}>{cfg.unit}</Text>
                    </View>
                    <Switch
                      value={false}
                      onValueChange={() => toggleEnabled(cfg)}
                      trackColor={{ false: Colors.border, true: NUTRITION_ACCENT + '60' }}
                      thumbColor={Colors.textMuted}
                      disabled={saving === cfg.id}
                    />
                  </View>
                ))}
              </>
            )}

            <Text style={styles.hint}>
              Bật/tắt để chọn chất cần theo dõi. Nhấn "Đặt mục tiêu" để đặt lượng mục tiêu hàng ngày.
            </Text>
          </ScrollView>
        )}
      </View>

      {/* Goal edit bottom sheet */}
      {editingGoal && (
        <Modal visible transparent animationType="slide">
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setEditingGoal(null)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              Mục tiêu {editingGoal.config.label} / ngày
            </Text>
            <View style={styles.goalInputRow}>
              <TextInput
                style={styles.goalInput}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                value={editingGoal.inputValue}
                onChangeText={(t) => setEditingGoal((s) => s ? { ...s, inputValue: t } : s)}
                autoFocus
              />
              <Text style={styles.goalInputUnit}>{editingGoal.config.unit}</Text>
            </View>
            <View style={styles.sheetBtns}>
              {editingGoal.goal && (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeGoal(editingGoal.config.key)}
                >
                  <Text style={styles.removeBtnText}>Xóa mục tiêu</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.confirmBtn} onPress={saveGoal}>
                <Text style={styles.confirmBtnText}>Lưu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },
  closeBtn: { padding: 4 },

  content: { padding: 20, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    gap: 8,
  },
  rowDisabled: { opacity: 0.55 },
  rowLeft: { flex: 1, gap: 2 },
  nutrientLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  nutrientUnit: { fontSize: 11, color: Colors.textMuted },
  disabledText: { color: Colors.textSecondary },

  goalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  goalText: { fontSize: 12, fontWeight: '600', color: NUTRITION_ACCENT },
  goalTextEmpty: { color: Colors.textMuted },

  hint: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: 20,
    textAlign: 'center',
  },

  // Goal edit sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 36, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  goalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  goalInput: { flex: 1, paddingVertical: 14, fontSize: 24, fontWeight: '700', color: Colors.text },
  goalInputUnit: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  sheetBtns: { flexDirection: 'row', gap: 10 },
  removeBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: Colors.error + '20', borderWidth: 1, borderColor: Colors.error + '40',
  },
  removeBtnText: { fontSize: 14, fontWeight: '700', color: Colors.error },
  confirmBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: NUTRITION_ACCENT,
  },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: Colors.bg },
});
