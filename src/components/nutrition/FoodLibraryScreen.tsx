import { useState, useCallback, useMemo } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { X, Plus, Search, ChevronRight, Trash2, ChevronDown, ChevronUp, RefreshCw, PenLine } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getNutritionFoods,
  getNutrientConfigs,
  createNutritionFood,
  updateNutritionFood,
  deleteNutritionFood,
  type NutritionFoodItem,
  type NutrientConfigItem,
} from '@/src/lib/repository';
import { Colors } from '@/src/constants/colors';

const NUTRITION_ACCENT = '#4ADE80';

function computeAutoCalories(nutrients: Record<string, string>): number | null {
  const p = parseFloat(nutrients.protein ?? '');
  const c = parseFloat(nutrients.carb ?? '');
  const f = parseFloat(nutrients.fat ?? '');
  const hasAny = !isNaN(p) || !isNaN(c) || !isNaN(f);
  if (!hasAny) return null;
  return parseFloat((
    (isNaN(p) ? 0 : p) * 4 +
    (isNaN(c) ? 0 : c) * 4 +
    (isNaN(f) ? 0 : f) * 9
  ).toFixed(1));
}

type FoodForm = {
  name: string;
  brand: string;
  serving_size: string;
  serving_unit: string;
  note: string;
  nutrients: Record<string, string>; // keyed nutrients from configs
  extra: Array<{ key: string; label: string; value: string }>; // ad-hoc key-value rows
};

const BLANK_FORM: FoodForm = {
  name: '', brand: '', serving_size: '100', serving_unit: 'g', note: '',
  nutrients: {}, extra: [],
};

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function FoodLibraryScreen({ visible, onClose }: Props) {
  const [foods, setFoods] = useState<NutritionFoodItem[]>([]);
  const [configs, setConfigs] = useState<NutrientConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingFood, setEditingFood] = useState<NutritionFoodItem | null>(null);
  const [form, setForm] = useState<FoodForm>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [showDisabledNutrients, setShowDisabledNutrients] = useState(false);
  const [calAutoMode, setCalAutoMode] = useState(true);
  const [hiddenNutrientKeys, setHiddenNutrientKeys] = useState<Set<string>>(new Set());

  const hideNutrientField = (key: string) =>
    setHiddenNutrientKeys((prev) => new Set([...prev, key]));

  const resetHiddenFields = () => setHiddenNutrientKeys(new Set());

  // Auto-computed calories from form.nutrients.protein/carb/fat
  const autoCalories = useMemo(
    () => computeAutoCalories(form.nutrients),
    [form.nutrients.protein, form.nutrients.carb, form.nutrients.fat],
  );

  const load = useCallback(async () => {
    try {
      const [fs, cfgs] = await Promise.all([getNutritionFoods(), getNutrientConfigs()]);
      setFoods(fs);
      setConfigs(cfgs);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { if (visible) load(); }, [visible, load]));

  const enabledConfigs = useMemo(() => configs.filter((c) => c.is_enabled), [configs]);
  const disabledConfigs = useMemo(() => configs.filter((c) => !c.is_enabled), [configs]);
  const configKeySet = useMemo(() => new Set(configs.map((c) => c.key)), [configs]);

  const filtered = useMemo(() => {
    if (!search.trim()) return foods;
    const q = search.trim().toLowerCase();
    return foods.filter((f) => f.name.toLowerCase().includes(q) || (f.brand || '').toLowerCase().includes(q));
  }, [foods, search]);

  const openAdd = () => {
    const nutrients: Record<string, string> = {};
    for (const c of configs) nutrients[c.key] = '';
    setForm({ ...BLANK_FORM, nutrients, extra: [] });
    setEditingFood(null);
    setFormError('');
    setShowDisabledNutrients(false);
    setCalAutoMode(true);
    setHiddenNutrientKeys(new Set());
    setShowForm(true);
  };

  const openEdit = (food: NutritionFoodItem) => {
    const nutrients: Record<string, string> = {};
    for (const c of configs) {
      nutrients[c.key] = food.nutrients_json[c.key] != null
        ? String(food.nutrients_json[c.key])
        : '';
    }
    // Extra rows: food nutrient keys not covered by any config
    const extra: FoodForm['extra'] = [];
    for (const [key, val] of Object.entries(food.nutrients_json)) {
      if (!configKeySet.has(key)) {
        extra.push({ key, label: key, value: String(val) });
      }
    }
    setForm({
      name: food.name,
      brand: food.brand || '',
      serving_size: String(food.serving_size),
      serving_unit: food.serving_unit,
      note: food.note || '',
      nutrients,
      extra,
    });
    setEditingFood(food);
    setFormError('');
    setShowDisabledNutrients(false);
    const hasStoredCal = food.nutrients_json.calories != null;
    setCalAutoMode(!hasStoredCal);
    // Pre-hide enabled config keys that have no value in this food
    const preHidden = new Set<string>(
      configs
        .filter((c) => c.is_enabled && food.nutrients_json[c.key] == null)
        .map((c) => c.key)
    );
    setHiddenNutrientKeys(preHidden);
    setShowForm(true);
  };

  const addExtraRow = () => {
    setForm((f) => ({ ...f, extra: [...f.extra, { key: '', label: '', value: '' }] }));
  };

  const updateExtra = (idx: number, patch: Partial<{ key: string; label: string; value: string }>) => {
    setForm((f) => {
      const extra = [...f.extra];
      extra[idx] = { ...extra[idx], ...patch };
      // Auto-fill key from label if key is empty
      if (patch.label && !extra[idx].key) {
        extra[idx].key = patch.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      }
      return { ...f, extra };
    });
  };

  const removeExtra = (idx: number) => {
    setForm((f) => ({ ...f, extra: f.extra.filter((_, i) => i !== idx) }));
  };

  const saveFood = async () => {
    if (!form.name.trim()) { setFormError('Nhập tên thực phẩm'); return; }
    const servingSize = parseFloat(form.serving_size);
    if (isNaN(servingSize) || servingSize <= 0) { setFormError('Khẩu phần phải lớn hơn 0'); return; }

    const nutrients_json: Record<string, number> = {};
    // Nutrients from config fields (skip calories if auto mode, skip hidden fields)
    for (const [key, val] of Object.entries(form.nutrients)) {
      if (key === 'calories' && calAutoMode) continue;
      if (hiddenNutrientKeys.has(key)) continue;
      const n = parseFloat(val);
      if (!isNaN(n) && n >= 0) nutrients_json[key] = n;
    }
    // Auto-computed calories
    if (calAutoMode && autoCalories !== null) {
      nutrients_json.calories = autoCalories;
    }
    // Extra ad-hoc nutrients
    for (const row of form.extra) {
      if (!row.key.trim()) continue;
      const n = parseFloat(row.value);
      if (!isNaN(n) && n >= 0) nutrients_json[row.key.trim()] = n;
    }

    setSaving(true);
    setFormError('');
    try {
      if (editingFood) {
        await updateNutritionFood(editingFood.id, {
          name: form.name.trim(),
          brand: form.brand.trim() || null,
          serving_size: servingSize,
          serving_unit: form.serving_unit.trim() || 'g',
          nutrients_json,
          note: form.note.trim() || null,
        });
      } else {
        await createNutritionFood({
          name: form.name.trim(),
          brand: form.brand.trim() || null,
          serving_size: servingSize,
          serving_unit: form.serving_unit.trim() || 'g',
          nutrients_json,
          note: form.note.trim() || null,
        });
      }
      await load();
      setShowForm(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (food: NutritionFoodItem) => {
    await deleteNutritionFood(food.id);
    await load();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Thư viện thực phẩm</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
              <Plus color={Colors.bg} size={18} strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color={Colors.textSecondary} size={22} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <Search color={Colors.textMuted} size={15} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm thực phẩm..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X color={Colors.textMuted} size={14} />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={NUTRITION_ACCENT} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>
              {search ? 'Không tìm thấy' : 'Chưa có thực phẩm'}
            </Text>
            <Text style={styles.emptyText}>
              {search ? 'Thử từ khoá khác' : 'Nhấn + để thêm thực phẩm vào thư viện'}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {filtered.map((food) => (
              <View key={food.id} style={styles.foodCard}>
                <TouchableOpacity style={styles.foodBody} onPress={() => openEdit(food)} activeOpacity={0.8}>
                  <Text style={styles.foodName} numberOfLines={1}>{food.name}</Text>
                  {food.brand && <Text style={styles.foodBrand}>{food.brand}</Text>}
                  <Text style={styles.foodServing}>
                    {food.serving_size}{food.serving_unit} / khẩu phần
                  </Text>
                  <View style={styles.macroRow}>
                    {enabledConfigs.filter((c) => food.nutrients_json[c.key] != null).slice(0, 4).map((c) => (
                      <View key={c.key} style={styles.macroChip}>
                        <Text style={styles.macroChipText}>
                          {food.nutrients_json[c.key]}{c.unit} {c.label.toLowerCase()}
                        </Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
                <View style={styles.foodActions}>
                  <TouchableOpacity onPress={() => openEdit(food)} style={styles.editBtn}>
                    <ChevronRight color={Colors.textMuted} size={16} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(food)} style={styles.deleteBtn}>
                    <Trash2 color={Colors.error} size={15} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Add / Edit form */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={styles.formContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>
                {editingFood ? 'Sửa thực phẩm' : 'Thêm thực phẩm'}
              </Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <X color={Colors.textSecondary} size={22} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Tên thực phẩm *</Text>
            <TextInput
              style={styles.input}
              placeholder="VD: Cơm trắng, Ức gà, Trứng luộc..."
              placeholderTextColor={Colors.textMuted}
              value={form.name}
              onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
              autoFocus
            />

            <Text style={styles.label}>Thương hiệu (tuỳ chọn)</Text>
            <TextInput
              style={styles.input}
              placeholder="VD: Vinamilk, TH True Milk..."
              placeholderTextColor={Colors.textMuted}
              value={form.brand}
              onChangeText={(t) => setForm((f) => ({ ...f, brand: t }))}
            />

            <View style={styles.twoCol}>
              <View style={styles.colField}>
                <Text style={styles.label}>Khẩu phần *</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  placeholder="100"
                  placeholderTextColor={Colors.textMuted}
                  value={form.serving_size}
                  onChangeText={(t) => setForm((f) => ({ ...f, serving_size: t }))}
                />
              </View>
              <View style={styles.colField}>
                <Text style={styles.label}>Đơn vị</Text>
                <TextInput
                  style={styles.input}
                  placeholder="g"
                  placeholderTextColor={Colors.textMuted}
                  value={form.serving_unit}
                  onChangeText={(t) => setForm((f) => ({ ...f, serving_unit: t }))}
                />
              </View>
            </View>

            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>Dinh dưỡng đang theo dõi / khẩu phần</Text>
              {hiddenNutrientKeys.size > 0 && (
                <TouchableOpacity onPress={resetHiddenFields}>
                  <Text style={styles.showHiddenText}>
                    Hiện lại ({hiddenNutrientKeys.size})
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {enabledConfigs.map((c) => {
              if (hiddenNutrientKeys.has(c.key)) return null;

              if (c.key === 'calories') {
                return (
                  <View key={c.key} style={styles.calCard}>
                    <View style={styles.calCardRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.nutrientName}>{c.label}</Text>
                        {calAutoMode && (
                          <Text style={styles.calAutoHint}>đạm×4 + carb×4 + béo×9</Text>
                        )}
                      </View>
                      <View style={styles.calRight}>
                        {calAutoMode ? (
                          <Text style={styles.calAutoVal}>
                            {autoCalories !== null ? autoCalories : '—'}
                          </Text>
                        ) : (
                          <TextInput
                            style={styles.nutrientInput}
                            keyboardType="decimal-pad"
                            placeholder="—"
                            placeholderTextColor={Colors.textMuted}
                            value={form.nutrients[c.key] || ''}
                            onChangeText={(t) =>
                              setForm((f) => ({ ...f, nutrients: { ...f.nutrients, [c.key]: t } }))
                            }
                          />
                        )}
                        <TouchableOpacity
                          style={styles.calToggleBtn}
                          onPress={() => {
                            setCalAutoMode((v) => {
                              if (!v) {
                                setForm((f) => ({ ...f, nutrients: { ...f.nutrients, calories: '' } }));
                              }
                              return !v;
                            });
                          }}
                        >
                          {calAutoMode ? (
                            <RefreshCw color={NUTRITION_ACCENT} size={12} strokeWidth={2.5} />
                          ) : (
                            <PenLine color={Colors.textSecondary} size={12} strokeWidth={2.5} />
                          )}
                          <Text style={[styles.calToggleText, calAutoMode && styles.calToggleTextActive]}>
                            {calAutoMode ? 'Tự tính' : 'Tay'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => hideNutrientField(c.key)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <X color={Colors.textMuted} size={14} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              }

              return (
                <View key={c.key} style={styles.nutrientRow}>
                  <View style={styles.nutrientRowLeft}>
                    <Text style={styles.nutrientName}>{c.label}</Text>
                    <Text style={styles.nutrientUnit}>{c.unit}</Text>
                  </View>
                  <TextInput
                    style={styles.nutrientInput}
                    keyboardType="decimal-pad"
                    placeholder="—"
                    placeholderTextColor={Colors.textMuted}
                    value={form.nutrients[c.key] || ''}
                    onChangeText={(t) =>
                      setForm((f) => ({ ...f, nutrients: { ...f.nutrients, [c.key]: t } }))
                    }
                  />
                  <TouchableOpacity
                    onPress={() => hideNutrientField(c.key)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.removeNutrientBtn}
                  >
                    <X color={Colors.textMuted} size={14} />
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Toggle để hiện chất không theo dõi */}
            {disabledConfigs.length > 0 && (
              <TouchableOpacity
                style={styles.toggleDisabledBtn}
                onPress={() => setShowDisabledNutrients((v) => !v)}
              >
                {showDisabledNutrients
                  ? <ChevronUp color={Colors.textMuted} size={14} />
                  : <ChevronDown color={Colors.textMuted} size={14} />}
                <Text style={styles.toggleDisabledText}>
                  {showDisabledNutrients ? 'Ẩn' : 'Hiện'} chất không theo dõi ({disabledConfigs.length})
                </Text>
              </TouchableOpacity>
            )}

            {showDisabledNutrients && disabledConfigs.map((c) => (
              <View key={c.key} style={[styles.nutrientRow, styles.nutrientRowDimmed]}>
                <View style={styles.nutrientRowLeft}>
                  <Text style={[styles.nutrientName, styles.dimmedText]}>{c.label}</Text>
                  <Text style={styles.nutrientUnit}>{c.unit}</Text>
                </View>
                <TextInput
                  style={styles.nutrientInput}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={Colors.textMuted}
                  value={form.nutrients[c.key] || ''}
                  onChangeText={(t) =>
                    setForm((f) => ({ ...f, nutrients: { ...f.nutrients, [c.key]: t } }))
                  }
                />
              </View>
            ))}

            {/* Ad-hoc extra nutrients */}
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Chất dinh dưỡng khác</Text>
            {form.extra.map((row, idx) => (
              <View key={idx} style={styles.extraRow}>
                <View style={styles.extraRowLeft}>
                  <TextInput
                    style={[styles.nutrientInput, styles.extraKeyInput]}
                    placeholder="Tên (VD: Omega-3)"
                    placeholderTextColor={Colors.textMuted}
                    value={row.label}
                    onChangeText={(t) => updateExtra(idx, { label: t, key: t.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') })}
                  />
                </View>
                <TextInput
                  style={[styles.nutrientInput, { width: 80 }]}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={Colors.textMuted}
                  value={row.value}
                  onChangeText={(t) => updateExtra(idx, { value: t })}
                />
                <TouchableOpacity onPress={() => removeExtra(idx)} style={styles.removeExtraBtn}>
                  <Trash2 color={Colors.error} size={14} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addExtraBtn} onPress={addExtraRow}>
              <Plus color={NUTRITION_ACCENT} size={15} strokeWidth={2.5} />
              <Text style={styles.addExtraBtnText}>Thêm chất khác</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Ghi chú (tuỳ chọn)</Text>
            <TextInput
              style={[styles.input, styles.noteInput]}
              placeholder="..."
              placeholderTextColor={Colors.textMuted}
              value={form.note}
              onChangeText={(t) => setForm((f) => ({ ...f, note: t }))}
              multiline
            />

            {formError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{formError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saveFood}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>
                {saving ? 'Đang lưu...' : editingFood ? 'Cập nhật' : 'Thêm thực phẩm'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: NUTRITION_ACCENT, alignItems: 'center', justifyContent: 'center',
  },
  closeBtn: { padding: 4 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14 },

  emptyBox: {
    margin: 20, backgroundColor: Colors.surface,
    borderRadius: 16, padding: 32, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },

  list: { padding: 16, paddingBottom: 40 },
  foodCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  foodBody: { flex: 1, padding: 14, gap: 4 },
  foodName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  foodBrand: { fontSize: 12, color: Colors.textSecondary },
  foodServing: { fontSize: 11, color: Colors.textMuted },
  macroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  macroChip: {
    backgroundColor: NUTRITION_ACCENT + '18',
    borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  macroChipText: { fontSize: 10, color: NUTRITION_ACCENT, fontWeight: '600' },
  foodActions: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 14,
  },
  editBtn: { padding: 4 },
  deleteBtn: { padding: 4 },

  // Form
  formContainer: { flex: 1, backgroundColor: Colors.bg, padding: 20, paddingTop: 56 },
  formHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 24,
  },
  formTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },

  label: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 12, color: Colors.text, fontSize: 15, marginBottom: 16,
  },
  noteInput: { minHeight: 60, textAlignVertical: 'top' },

  twoCol: { flexDirection: 'row', gap: 12 },
  colField: { flex: 1 },

  sectionRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12, marginTop: 4,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  showHiddenText: { fontSize: 12, fontWeight: '600', color: NUTRITION_ACCENT },
  nutrientRow: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingVertical: 10, gap: 8,
  },
  removeNutrientBtn: { padding: 4 },
  nutrientRowDimmed: { opacity: 0.55 },
  nutrientRowLeft: { flex: 1 },
  nutrientName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  dimmedText: { color: Colors.textSecondary },
  nutrientUnit: { fontSize: 11, color: Colors.textMuted },
  nutrientInput: {
    width: 80, textAlign: 'right',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, padding: 8,
    color: Colors.text, fontSize: 15, fontWeight: '600',
  },

  // Calories auto-card
  calCard: {
    borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: 10,
  },
  calCardRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  calAutoHint: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  calRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  calAutoVal: { fontSize: 16, fontWeight: '800', color: NUTRITION_ACCENT },
  calToggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border,
  },
  calToggleText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  calToggleTextActive: { color: NUTRITION_ACCENT },

  toggleDisabledBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10,
  },
  toggleDisabledText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },

  // Extra (ad-hoc) nutrient rows
  extraRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  extraRowLeft: { flex: 1 },
  extraKeyInput: { width: '100%', textAlign: 'left', fontSize: 13 },
  removeExtraBtn: { padding: 6 },
  addExtraBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 12, justifyContent: 'center',
    marginTop: 4, marginBottom: 4,
    backgroundColor: NUTRITION_ACCENT + '12',
    borderRadius: 10, borderWidth: 1,
    borderColor: NUTRITION_ACCENT + '30', borderStyle: 'dashed',
  },
  addExtraBtnText: { fontSize: 13, fontWeight: '700', color: NUTRITION_ACCENT },

  errorBanner: {
    backgroundColor: Colors.error + '15',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    marginVertical: 12, borderWidth: 1, borderColor: Colors.error + '30',
  },
  errorText: { color: Colors.error, fontSize: 13 },

  saveBtn: {
    backgroundColor: NUTRITION_ACCENT, borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 20, marginBottom: 40,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: Colors.bg },
});
