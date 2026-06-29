import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { X, Search, Zap } from 'lucide-react-native';
import {
  getNutritionFoods,
  getNutrientConfigs,
  createNutritionLog,
  type NutritionFoodItem,
  type NutrientConfigItem,
} from '@/src/lib/repository';
import { Colors } from '@/src/constants/colors';

const NUTRITION_ACCENT = '#4ADE80';

type MealType = 'morning' | 'noon' | 'evening' | 'snack';

const MEAL_OPTIONS: { key: MealType; label: string }[] = [
  { key: 'morning', label: 'Sáng' },
  { key: 'noon', label: 'Trưa' },
  { key: 'evening', label: 'Tối' },
  { key: 'snack', label: 'Bữa phụ' },
];

function calcNutrients(
  food: NutritionFoodItem,
  quantity: number,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, val] of Object.entries(food.nutrients_json)) {
    result[key] = parseFloat(((val / food.serving_size) * quantity).toFixed(1));
  }
  return result;
}

interface Props {
  visible: boolean;
  defaultMeal?: MealType;
  defaultDate: string; // YYYY-MM-DD
  onClose: () => void;
  onSaved: () => void;
}

export default function AddFoodLogModal({
  visible, defaultMeal = 'snack', defaultDate, onClose, onSaved,
}: Props) {
  const [step, setStep] = useState<'search' | 'detail' | 'quick'>('search');

  // search state
  const [foods, setFoods] = useState<NutritionFoodItem[]>([]);
  const [configs, setConfigs] = useState<NutrientConfigItem[]>([]);
  const [search, setSearch] = useState('');
  const [loadedLibrary, setLoadedLibrary] = useState(false);

  // detail state (library pick)
  const [selectedFood, setSelectedFood] = useState<NutritionFoodItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const [note, setNote] = useState('');

  // quick add state
  const [quickName, setQuickName] = useState('');
  const [quickNutrients, setQuickNutrients] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadLibrary = useCallback(async () => {
    if (loadedLibrary) return;
    const [fs, cfgs] = await Promise.all([getNutritionFoods(), getNutrientConfigs()]);
    setFoods(fs);
    setConfigs(cfgs);
    const defaults: Record<string, string> = {};
    for (const c of cfgs) defaults[c.key] = '';
    setQuickNutrients(defaults);
    setLoadedLibrary(true);
  }, [loadedLibrary]);

  const resetAndClose = () => {
    setStep('search');
    setSearch('');
    setSelectedFood(null);
    setQuantity('');
    setNote('');
    setQuickName('');
    setSaving(false);
    setError('');
    onClose();
  };

  const handleOpen = useCallback(() => {
    loadLibrary();
    setMeal(defaultMeal);
  }, [loadLibrary, defaultMeal]);

  // Trigger load when visible changes to true
  useEffect(() => { if (visible) handleOpen(); }, [visible]);

  const filteredFoods = useMemo(() => {
    if (!search.trim()) return foods;
    const q = search.trim().toLowerCase();
    return foods.filter((f) => f.name.toLowerCase().includes(q) || (f.brand || '').toLowerCase().includes(q));
  }, [foods, search]);

  const selectFood = (food: NutritionFoodItem) => {
    setSelectedFood(food);
    setQuantity(String(food.serving_size));
    setError('');
    setStep('detail');
  };

  const previewNutrients = useMemo(() => {
    if (!selectedFood || !quantity) return {};
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return {};
    return calcNutrients(selectedFood, qty);
  }, [selectedFood, quantity]);

  const saveFromLibrary = async () => {
    if (!selectedFood) return;
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) { setError('Nhập lượng hợp lệ'); return; }

    setSaving(true);
    setError('');
    try {
      const nutrients = calcNutrients(selectedFood, qty);
      await createNutritionLog({
        food_id: selectedFood.id,
        food_name: selectedFood.name,
        quantity: qty,
        nutrients_json: nutrients,
        meal_type: meal,
        note: note.trim() || null,
        logged_at: `${defaultDate} ${new Date().toTimeString().slice(0, 8)}`,
      });
      onSaved();
      resetAndClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setSaving(false);
    }
  };

  const saveQuick = async () => {
    if (!quickName.trim()) { setError('Nhập tên thực phẩm'); return; }
    const nutrients_json: Record<string, number> = {};
    for (const [k, v] of Object.entries(quickNutrients)) {
      const n = parseFloat(v);
      if (!isNaN(n) && n >= 0) nutrients_json[k] = n;
    }

    setSaving(true);
    setError('');
    try {
      await createNutritionLog({
        food_id: null,
        food_name: quickName.trim(),
        quantity: 1,
        nutrients_json,
        meal_type: meal,
        note: note.trim() || null,
        logged_at: `${defaultDate} ${new Date().toTimeString().slice(0, 8)}`,
      });
      onSaved();
      resetAndClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setSaving(false);
    }
  };

  const enabledConfigs = configs.filter((c) => c.is_enabled);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.overlay} onPress={resetAndClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheet}
      >
        <View style={styles.sheetHandle} />

        {/* ── Step: Search ── */}
        {step === 'search' && (
          <>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Thêm thực phẩm</Text>
              <TouchableOpacity onPress={resetAndClose}>
                <X color={Colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchRow}>
              <Search color={Colors.textMuted} size={14} />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm trong thư viện..."
                placeholderTextColor={Colors.textMuted}
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <X color={Colors.textMuted} size={13} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={styles.quickBtn} onPress={() => setStep('quick')}>
              <Zap color={NUTRITION_ACCENT} size={15} strokeWidth={2} />
              <Text style={styles.quickBtnText}>Thêm nhanh (không lưu vào thư viện)</Text>
            </TouchableOpacity>

            <ScrollView style={styles.foodList} keyboardShouldPersistTaps="handled">
              {filteredFoods.length === 0 ? (
                <Text style={styles.emptyText}>
                  {search ? 'Không tìm thấy. Thêm thực phẩm mới trong Thư viện.' : 'Thư viện trống. Thêm thực phẩm trước.'}
                </Text>
              ) : (
                filteredFoods.map((food) => (
                  <TouchableOpacity
                    key={food.id}
                    style={styles.foodRow}
                    onPress={() => selectFood(food)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.foodRowBody}>
                      <Text style={styles.foodRowName} numberOfLines={1}>{food.name}</Text>
                      {food.brand && <Text style={styles.foodRowBrand}>{food.brand}</Text>}
                      <Text style={styles.foodRowServing}>
                        {food.serving_size}{food.serving_unit}
                      </Text>
                    </View>
                    <View style={styles.foodRowMacros}>
                      {enabledConfigs.slice(0, 3).map((c) =>
                        food.nutrients_json[c.key] != null ? (
                          <Text key={c.key} style={styles.foodRowMacroText}>
                            {food.nutrients_json[c.key]}{c.unit}
                          </Text>
                        ) : null
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </>
        )}

        {/* ── Step: Detail (library pick) ── */}
        {step === 'detail' && selectedFood && (
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={() => setStep('search')}>
                <Text style={styles.backText}>← Quay lại</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={resetAndClose}>
                <X color={Colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            <Text style={styles.selectedFoodName}>{selectedFood.name}</Text>
            {selectedFood.brand && (
              <Text style={styles.selectedFoodBrand}>{selectedFood.brand}</Text>
            )}

            <Text style={styles.fieldLabel}>Lượng ({selectedFood.serving_unit})</Text>
            <TextInput
              style={styles.qtyInput}
              keyboardType="decimal-pad"
              value={quantity}
              onChangeText={setQuantity}
              placeholder={String(selectedFood.serving_size)}
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />

            {/* Macro preview */}
            {Object.keys(previewNutrients).length > 0 && (
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>Ước tính</Text>
                <View style={styles.previewGrid}>
                  {enabledConfigs.map((c) =>
                    previewNutrients[c.key] != null ? (
                      <View key={c.key} style={styles.previewItem}>
                        <Text style={styles.previewVal}>
                          {previewNutrients[c.key]}
                        </Text>
                        <Text style={styles.previewUnit}>{c.unit}</Text>
                        <Text style={styles.previewName}>{c.label}</Text>
                      </View>
                    ) : null
                  )}
                </View>
              </View>
            )}

            <Text style={styles.fieldLabel}>Bữa ăn</Text>
            <View style={styles.mealRow}>
              {MEAL_OPTIONS.map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.mealChip, meal === m.key && styles.mealChipActive]}
                  onPress={() => setMeal(m.key)}
                >
                  <Text style={[styles.mealChipText, meal === m.key && styles.mealChipTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Ghi chú (tuỳ chọn)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="..."
              placeholderTextColor={Colors.textMuted}
              value={note}
              onChangeText={setNote}
              multiline
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.confirmBtn, saving && { opacity: 0.6 }]}
              onPress={saveFromLibrary}
              disabled={saving}
            >
              <Text style={styles.confirmBtnText}>
                {saving ? 'Đang lưu...' : 'Lưu vào nhật ký'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── Step: Quick add ── */}
        {step === 'quick' && (
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={() => setStep('search')}>
                <Text style={styles.backText}>← Quay lại</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={resetAndClose}>
                <X color={Colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetTitle}>Thêm nhanh</Text>

            <Text style={styles.fieldLabel}>Tên thực phẩm *</Text>
            <TextInput
              style={styles.qtyInput}
              placeholder="VD: Cơm trắng, Ức gà..."
              placeholderTextColor={Colors.textMuted}
              value={quickName}
              onChangeText={setQuickName}
              autoFocus
            />

            <Text style={styles.fieldLabel}>Dinh dưỡng</Text>
            {enabledConfigs.map((c) => (
              <View key={c.key} style={styles.nutrientRow}>
                <Text style={styles.nutrientRowLabel}>
                  {c.label} ({c.unit})
                </Text>
                <TextInput
                  style={styles.nutrientInput}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={Colors.textMuted}
                  value={quickNutrients[c.key] || ''}
                  onChangeText={(t) =>
                    setQuickNutrients((prev) => ({ ...prev, [c.key]: t }))
                  }
                />
              </View>
            ))}

            <Text style={styles.fieldLabel}>Bữa ăn</Text>
            <View style={styles.mealRow}>
              {MEAL_OPTIONS.map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.mealChip, meal === m.key && styles.mealChipActive]}
                  onPress={() => setMeal(m.key)}
                >
                  <Text style={[styles.mealChipText, meal === m.key && styles.mealChipTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Ghi chú (tuỳ chọn)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="..."
              placeholderTextColor={Colors.textMuted}
              value={note}
              onChangeText={setNote}
              multiline
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.confirmBtn, saving && { opacity: 0.6 }]}
              onPress={saveQuick}
              disabled={saving}
            >
              <Text style={styles.confirmBtnText}>
                {saving ? 'Đang lưu...' : 'Lưu vào nhật ký'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '88%',
  },
  sheetHandle: {
    width: 36, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  backText: { fontSize: 14, color: NUTRITION_ACCENT, fontWeight: '600' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14 },

  quickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: NUTRITION_ACCENT + '14',
    borderRadius: 12, borderWidth: 1, borderColor: NUTRITION_ACCENT + '30',
    marginBottom: 12,
  },
  quickBtnText: { fontSize: 13, color: NUTRITION_ACCENT, fontWeight: '600' },

  foodList: { maxHeight: 360 },
  foodRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  foodRowBody: { flex: 1 },
  foodRowName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  foodRowBrand: { fontSize: 11, color: Colors.textSecondary },
  foodRowServing: { fontSize: 11, color: Colors.textMuted },
  foodRowMacros: { flexDirection: 'column', alignItems: 'flex-end', gap: 2 },
  foodRowMacroText: { fontSize: 11, color: Colors.textSecondary },
  emptyText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 24 },

  // Detail
  selectedFoodName: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  selectedFoodBrand: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16 },

  fieldLabel: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 14,
  },
  qtyInput: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, padding: 14,
    color: Colors.text, fontSize: 22, fontWeight: '700',
  },

  previewBox: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    padding: 14, marginTop: 12,
  },
  previewLabel: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10,
  },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  previewItem: { alignItems: 'center', minWidth: 64 },
  previewVal: { fontSize: 18, fontWeight: '700', color: NUTRITION_ACCENT },
  previewUnit: { fontSize: 10, color: Colors.textMuted },
  previewName: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  mealRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  mealChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  mealChipActive: { borderColor: NUTRITION_ACCENT, backgroundColor: NUTRITION_ACCENT + '20' },
  mealChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  mealChipTextActive: { color: NUTRITION_ACCENT },

  noteInput: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 12, color: Colors.text, fontSize: 14,
    minHeight: 60, textAlignVertical: 'top',
  },

  nutrientRow: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: 10,
  },
  nutrientRowLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text },
  nutrientInput: {
    width: 80, textAlign: 'right',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, padding: 8,
    color: Colors.text, fontSize: 15, fontWeight: '600',
  },

  errorText: { color: Colors.error, fontSize: 13, marginTop: 8 },
  confirmBtn: {
    backgroundColor: NUTRITION_ACCENT, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 20,
  },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: Colors.bg },
});
