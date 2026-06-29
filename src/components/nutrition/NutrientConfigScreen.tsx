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
  Alert,
} from 'react-native';
import { X, ChevronRight, Plus, Trash2 } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getNutrientConfigs,
  getNutritionGoals,
  saveNutrientConfig,
  saveNutritionGoal,
  deleteNutritionGoalByKey,
  createNutrientConfig,
  deleteNutrientConfig,
  generateUUID,
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

interface AddNutrientForm {
  label: string;
  unit: string;
  key: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

function slugify(str: string): string {
  return str.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function NutrientConfigScreen({ visible, onClose }: Props) {
  const [configs, setConfigs] = useState<NutrientConfigItem[]>([]);
  const [goals, setGoals] = useState<NutritionGoalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<GoalEditState | null>(null);

  // Add custom nutrient
  const [showAddNutrient, setShowAddNutrient] = useState(false);
  const [addForm, setAddForm] = useState<AddNutrientForm>({ label: '', unit: 'g', key: '' });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');
  const [keyManuallySet, setKeyManuallySet] = useState(false);

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
    if (isNaN(val) || val <= 0) { setEditingGoal(null); return; }
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

  const openAddNutrient = () => {
    setAddForm({ label: '', unit: 'g', key: '' });
    setKeyManuallySet(false);
    setAddError('');
    setShowAddNutrient(true);
  };

  const onLabelChange = (text: string) => {
    setAddForm((f) => ({
      ...f,
      label: text,
      key: keyManuallySet ? f.key : slugify(text),
    }));
  };

  const saveCustomNutrient = async () => {
    const label = addForm.label.trim();
    const key = addForm.key.trim();
    const unit = addForm.unit.trim() || 'g';
    if (!label) { setAddError('Nhập tên chất dinh dưỡng'); return; }
    if (!key || !/^[a-z0-9_]+$/.test(key)) {
      setAddError('Key chỉ dùng a-z, 0-9, _ và không có dấu cách'); return;
    }
    if (configs.some((c) => c.key === key)) {
      setAddError('Key đã tồn tại, chọn tên khác'); return;
    }
    setAddSaving(true);
    setAddError('');
    try {
      await createNutrientConfig({ label, key, unit });
      await load();
      setShowAddNutrient(false);
    } catch (e: any) {
      setAddError(e?.message || 'Lỗi không xác định');
    } finally {
      setAddSaving(false);
    }
  };

  const handleDelete = (config: NutrientConfigItem) => {
    Alert.alert(
      'Xoá chất dinh dưỡng',
      `Xoá "${config.label}" khỏi danh sách? Dữ liệu đã lưu trong nhật ký vẫn còn.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá', style: 'destructive',
          onPress: async () => {
            await deleteNutrientConfig(config.id);
            await load();
          },
        },
      ]
    );
  };

  const enabledConfigs = configs.filter((c) => c.is_enabled);
  const disabledConfigs = configs.filter((c) => !c.is_enabled);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Cấu hình dinh dưỡng</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.addBtn} onPress={openAddNutrient}>
              <Plus color={Colors.bg} size={17} strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color={Colors.textSecondary} size={22} />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={NUTRITION_ACCENT} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.sectionLabel}>Đang theo dõi ({enabledConfigs.length})</Text>
            {enabledConfigs.map((cfg) => {
              const goal = goals.find((g) => g.nutrient_key === cfg.key);
              return (
                <View key={cfg.id} style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.nutrientLabel}>{cfg.label}</Text>
                    <Text style={styles.nutrientUnit}>{cfg.unit}</Text>
                  </View>
                  <TouchableOpacity style={styles.goalBtn} onPress={() => openGoalEdit(cfg)}>
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
                  <TouchableOpacity
                    style={styles.deleteIconBtn}
                    onPress={() => handleDelete(cfg)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 color={Colors.error} size={14} />
                  </TouchableOpacity>
                </View>
              );
            })}

            {disabledConfigs.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 24 }]}>
                  Không theo dõi ({disabledConfigs.length})
                </Text>
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
                    <TouchableOpacity
                      style={styles.deleteIconBtn}
                      onPress={() => handleDelete(cfg)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 color={Colors.error} size={14} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            <TouchableOpacity style={styles.addNutrientBanner} onPress={openAddNutrient}>
              <Plus color={NUTRITION_ACCENT} size={16} strokeWidth={2.5} />
              <Text style={styles.addNutrientBannerText}>Thêm chất dinh dưỡng tùy chỉnh</Text>
            </TouchableOpacity>

            <Text style={styles.hint}>
              Bật/tắt để chọn chất theo dõi hàng ngày. Nhấn mục tiêu để đặt lượng cần đạt.
              Nhấn "+" để thêm chất dinh dưỡng mới (VD: Vitamin D, Omega-3, Kali...).
            </Text>
          </ScrollView>
        )}
      </View>

      {/* Goal edit bottom sheet */}
      {editingGoal && (
        <Modal visible transparent animationType="slide">
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setEditingGoal(null)} />
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
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeGoal(editingGoal.config.key)}>
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

      {/* Add custom nutrient modal */}
      <Modal visible={showAddNutrient} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowAddNutrient(false)} />
        <View style={[styles.sheet, styles.addSheet]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Thêm chất dinh dưỡng</Text>

          <Text style={styles.addLabel}>Tên hiển thị *</Text>
          <TextInput
            style={styles.addInput}
            placeholder="VD: Vitamin D, Omega-3, Kali..."
            placeholderTextColor={Colors.textMuted}
            value={addForm.label}
            onChangeText={onLabelChange}
            autoFocus
          />

          <Text style={styles.addLabel}>Đơn vị</Text>
          <TextInput
            style={styles.addInput}
            placeholder="g, mg, mcg, IU..."
            placeholderTextColor={Colors.textMuted}
            value={addForm.unit}
            onChangeText={(t) => setAddForm((f) => ({ ...f, unit: t }))}
          />

          <Text style={styles.addLabel}>Key (định danh nội bộ)</Text>
          <TextInput
            style={[styles.addInput, styles.keyInput]}
            placeholder="tu_dong_tao"
            placeholderTextColor={Colors.textMuted}
            value={addForm.key}
            onChangeText={(t) => { setKeyManuallySet(true); setAddForm((f) => ({ ...f, key: t })); }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.keyHint}>Tự tạo từ tên. Chỉ a-z, 0-9 và dấu gạch dưới.</Text>

          {addError ? <Text style={styles.addError}>{addError}</Text> : null}

          <TouchableOpacity
            style={[styles.confirmBtn, { marginTop: 16 }, addSaving && { opacity: 0.6 }]}
            onPress={saveCustomNutrient}
            disabled={addSaving}
          >
            <Text style={styles.confirmBtnText}>
              {addSaving ? 'Đang lưu...' : 'Thêm'}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: NUTRITION_ACCENT,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtn: { padding: 4 },

  content: { padding: 20, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 8, gap: 8,
  },
  rowDisabled: { opacity: 0.55 },
  rowLeft: { flex: 1, gap: 2 },
  nutrientLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  nutrientUnit: { fontSize: 11, color: Colors.textMuted },
  disabledText: { color: Colors.textSecondary },
  deleteIconBtn: { padding: 4 },

  goalBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border,
  },
  goalText: { fontSize: 12, fontWeight: '600', color: NUTRITION_ACCENT },
  goalTextEmpty: { color: Colors.textMuted },

  addNutrientBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 16, paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: NUTRITION_ACCENT + '14',
    borderRadius: 12, borderWidth: 1,
    borderColor: NUTRITION_ACCENT + '40', borderStyle: 'dashed',
    justifyContent: 'center',
  },
  addNutrientBannerText: { fontSize: 14, fontWeight: '700', color: NUTRITION_ACCENT },

  hint: {
    fontSize: 12, color: Colors.textMuted, lineHeight: 18, marginTop: 16, textAlign: 'center',
  },

  // Goal sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  addSheet: { paddingBottom: 50 },
  sheetHandle: {
    width: 36, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  goalInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 16, marginBottom: 20,
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

  // Add nutrient form
  addLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  addInput: {
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.text, marginBottom: 14,
  },
  keyInput: { fontFamily: 'monospace', color: Colors.textSecondary },
  keyHint: { fontSize: 11, color: Colors.textMuted, marginTop: -10, marginBottom: 8 },
  addError: { fontSize: 13, color: Colors.error, marginBottom: 8 },
});
