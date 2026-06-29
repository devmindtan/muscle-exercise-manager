import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { Plus, ChevronRight, X, Search } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { persistImageLocally } from '@/src/lib/image';
import {
  getMuscleGroupsWithWeeklyStats,
  createMuscleGroup,
  type WeekStat,
} from '@/src/lib/repository';
import { Colors } from '@/src/constants/colors';
const MUSCLE_CATEGORIES = ['Ngực', 'Lưng', 'Vai', 'Tay', 'Chân', 'Bụng', 'Khác'];

function getWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now);
  mon.setDate(now.getDate() + diffToMon);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return {
    start: mon.toISOString(),
    end: sun.toISOString(),
  };
}

function ProgressRing({
  progress,
  color,
  size = 44,
}: {
  progress: number;
  color: string;
  size?: number;
}) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(progress, 1) * circ;
  const center = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      {/* SVG-like using View circles — use a simple arc with borders instead */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor: Colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Filled arc approximation using colored border on one side */}
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 3,
            borderColor: 'transparent',
            borderTopColor: progress > 0 ? color : 'transparent',
            borderRightColor: progress > 0.25 ? color : 'transparent',
            borderBottomColor: progress > 0.5 ? color : 'transparent',
            borderLeftColor: progress > 0.75 ? color : 'transparent',
            transform: [{ rotate: '-90deg' }],
          }}
        />
        <Text style={{ fontSize: 10, fontWeight: '700', color }}>
          {Math.round(Math.min(progress, 1) * 100)}%
        </Text>
      </View>
    </View>
  );
}

export default function MusclesScreen() {
  const [stats, setStats] = useState<WeekStat[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    target_sets_per_week: '10',
    target_sets_per_month: '40',
    color: Colors.muscleColors[0],
    image_uri: '',
    category: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { start, end } = getWeekRange();
      const data = await getMuscleGroupsWithWeeklyStats(start, end);
      setStats(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openAdd = () => {
    setForm({
      name: '',
      target_sets_per_week: '10',
      target_sets_per_month: '40',
      color: Colors.muscleColors[stats.length % Colors.muscleColors.length],
      image_uri: '',
      category: '',
    });
    setError('');
    setShowAdd(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      setError('Vui lòng nhập tên nhóm cơ');
      return;
    }
    setSaving(true);
    try {
      await createMuscleGroup({
        name: form.name.trim(),
        color: form.color,
        targetSetsPerWeek: parseInt(form.target_sets_per_week) || 10,
        targetSetsPerMonth: parseInt(form.target_sets_per_month) || 40,
        category: form.category || undefined,
      });
      setShowAdd(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Cần quyền truy cập thư viện ảnh để chọn hình minh hoạ');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.75,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      const permanent = await persistImageLocally(result.assets[0].uri);
      setForm((f) => ({ ...f, image_uri: permanent }));
    }
  };

  // ── Derived ──

  const filtered = useMemo(() => {
    let list = stats;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((g) => g.name.toLowerCase().includes(q));
    }
    if (activeCategory) {
      list = list.filter((g) => (g.category || 'Khác') === activeCategory);
    }
    return list;
  }, [stats, search, activeCategory]);

  const categoriesInUse = useMemo(() => {
    const set = new Set(stats.map((g) => g.category || 'Khác'));
    return MUSCLE_CATEGORIES.filter((c) => set.has(c));
  }, [stats]);

  const totalWeeklySets = useMemo(
    () => stats.reduce((s, g) => s + g.weekly_sets, 0),
    [stats],
  );

  const avgProgress = useMemo(() => {
    if (stats.length === 0) return 0;
    return stats.reduce((s, g) => s + g.progress, 0) / stats.length;
  }, [stats]);

  const onTargetCount = useMemo(
    () => stats.filter((g) => g.progress >= 1).length,
    [stats],
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>Đang tải nhóm cơ...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>Nhóm cơ</Text>
            <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
              <Plus color={Colors.bg} size={20} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {/* ── Weekly summary strip ── */}
          {stats.length > 0 && (
            <View style={styles.summaryStrip}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryVal}>{totalWeeklySets}</Text>
                <Text style={styles.summaryLabel}>sets tuần này</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { color: Colors.success }]}>
                  {onTargetCount}
                </Text>
                <Text style={styles.summaryLabel}>đạt mục tiêu</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { color: Colors.accent }]}>
                  {Math.round(avgProgress * 100)}%
                </Text>
                <Text style={styles.summaryLabel}>tiến độ TB</Text>
              </View>
            </View>
          )}

          {/* ── Search ── */}
          <View style={styles.searchRow}>
            <Search color={Colors.textMuted} size={15} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm nhóm cơ..."
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
        </View>

        {/* ── Category filter chips ── */}
        {categoriesInUse.length > 1 && (
          <View style={styles.chipWrap}>
            {categoriesInUse.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, activeCategory === cat && styles.chipActive]}
                onPress={() => setActiveCategory(activeCategory === cat ? null : cat)}
              >
                <Text
                  style={[styles.chipText, activeCategory === cat && styles.chipTextActive]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Empty ── */}
        {stats.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Chưa có nhóm cơ</Text>
            <Text style={styles.emptyText}>Nhấn + để thêm nhóm cơ đầu tiên</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Không tìm thấy</Text>
            <Text style={styles.emptyText}>Thử từ khoá khác hoặc bỏ bộ lọc</Text>
          </View>
        ) : (
          /* ── Group by category ── */
          MUSCLE_CATEGORIES.map((cat) => {
            const catGroups = filtered.filter((g) => (g.category || 'Khác') === cat);
            if (catGroups.length === 0) return null;
            return (
              <View key={cat}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryName}>{cat}</Text>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{catGroups.length}</Text>
                  </View>
                </View>

                {catGroups.map((g) => {
                  const isOnTarget = g.progress >= 1;
                  const pct = Math.min(g.progress, 1);

                  return (
                    <TouchableOpacity
                      key={g.id}
                      style={styles.card}
                      onPress={() => router.push(`/muscles/${g.id}`)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.colorBar, { backgroundColor: g.color }]} />

                      <View style={styles.cardBody}>
                        {/* Name row */}
                        <View style={styles.cardNameRow}>
                          <Text style={styles.cardName} numberOfLines={1}>
                            {g.name}
                          </Text>
                          {isOnTarget && (
                            <View style={styles.onTargetBadge}>
                              <Text style={styles.onTargetText}>✓ Đạt</Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.exerciseCountText}>
                          {g.exerciseCount} bài tập
                        </Text>

                        {/* Progress bar */}
                        <View style={styles.progressRow}>
                          <View style={styles.progressTrack}>
                            <View
                              style={[
                                styles.progressFill,
                                {
                                  width: `${pct * 100}%`,
                                  backgroundColor: isOnTarget ? Colors.success : g.color,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.progressLabel}>
                            {g.weekly_sets}
                            <Text style={styles.progressTarget}>
                              /{g.targetSetsPerWeek} sets
                            </Text>
                          </Text>
                        </View>
                      </View>

                      {/* Right side */}
                      <View style={styles.cardRight}>
                        <ProgressRing
                          progress={g.progress}
                          color={isOnTarget ? Colors.success : g.color || Colors.accent}
                          size={44}
                        />
                        <ChevronRight
                          color={Colors.textMuted}
                          size={16}
                          strokeWidth={1.8}
                          style={{ marginTop: 6 }}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>
      <Modal
        visible={showAdd}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAdd(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowAdd(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Thêm nhóm cơ</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <X color={Colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Tên nhóm cơ</Text>
            <TextInput
              style={styles.input}
              placeholder="VD: Ngực, Lưng, Chân..."
              placeholderTextColor={Colors.textMuted}
              value={form.name}
              onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
              autoFocus
            />

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Sets mục tiêu/tuần</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={form.target_sets_per_week}
                  onChangeText={(t) => setForm((f) => ({ ...f, target_sets_per_week: t }))}
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>Sets mục tiêu/tháng</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={form.target_sets_per_month}
                  onChangeText={(t) => setForm((f) => ({ ...f, target_sets_per_month: t }))}
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            <Text style={styles.label}>Màu sắc</Text>
            <View style={styles.colorPicker}>
              {Colors.muscleColors.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorOption,
                    { backgroundColor: c },
                    form.color === c && styles.colorSelected,
                  ]}
                  onPress={() => setForm((f) => ({ ...f, color: c }))}
                />
              ))}
            </View>

            <Text style={styles.label}>Danh mục</Text>
            <View style={styles.categoryPicker}>
              {MUSCLE_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    form.category === cat && styles.categoryChipActive,
                  ]}
                  onPress={() =>
                    setForm((f) => ({ ...f, category: f.category === cat ? '' : cat }))
                  }
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      form.category === cat && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Hình minh hoạ (tuỳ chọn)</Text>
            <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
              <Text style={styles.imageBtnText}>
                {form.image_uri ? 'Đổi hình minh hoạ' : 'Chọn hình minh hoạ'}
              </Text>
            </TouchableOpacity>
            {form.image_uri ? (
              <Image source={{ uri: form.image_uri }} style={styles.previewImage} />
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={save}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>
                {saving ? 'Đang lưu...' : 'Thêm nhóm cơ'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textMuted, fontSize: 15 },
  content: { paddingBottom: 40 },

  // Header
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, gap: 12 },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 28, fontWeight: '700', color: Colors.text, letterSpacing: -0.5 },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },

  // Summary strip
  summaryStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal: { fontSize: 20, fontWeight: '700', color: Colors.text },
  summaryLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1, color: Colors.text, fontSize: 14,
  },

  // Category chips
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  chipActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '20' },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: Colors.accent },

  // Category section header
  categoryHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8,
  },
  categoryName: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  categoryBadge: {
    backgroundColor: Colors.surfaceElevated, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.border,
  },
  categoryBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },

  // Card
  card: {
    marginHorizontal: 20, marginBottom: 10,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  colorBar: { width: 4, alignSelf: 'stretch' },
  cardBody: { flex: 1, paddingVertical: 12, paddingLeft: 14, paddingRight: 8, gap: 5 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { fontSize: 15, fontWeight: '700', color: Colors.text, flex: 1 },
  onTargetBadge: {
    backgroundColor: Colors.success + '20',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  onTargetText: { fontSize: 10, fontWeight: '700', color: Colors.success },
  exerciseCountText: { fontSize: 11, color: Colors.textMuted },

  // Progress bar
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  progressTrack: {
    flex: 1, height: 4, backgroundColor: Colors.border,
    borderRadius: 999, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999 },
  progressLabel: { fontSize: 12, fontWeight: '700', color: Colors.text, minWidth: 64, textAlign: 'right' },
  progressTarget: { fontSize: 11, fontWeight: '400', color: Colors.textMuted },

  cardRight: { alignItems: 'center', paddingRight: 12, paddingVertical: 12, gap: 2 },

  // Empty
  emptyBox: {
    margin: 20, backgroundColor: Colors.surface,
    borderRadius: 16, padding: 32, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40, maxHeight: '88%',
  },
  sheetHandle: {
    width: 36, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },

  // Form
  label: {
    fontSize: 11, color: Colors.textMuted, marginBottom: 6,
    fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6,
  },
  input: {
    backgroundColor: Colors.surfaceElevated, borderWidth: 1,
    borderColor: Colors.border, borderRadius: 10, padding: 12,
    color: Colors.text, fontSize: 15, marginBottom: 16,
  },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  colorPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  colorOption: { width: 36, height: 36, borderRadius: 18 },
  colorSelected: { borderWidth: 3, borderColor: Colors.text },
  categoryPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  categoryChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceElevated,
  },
  categoryChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  categoryChipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  categoryChipTextActive: { color: Colors.bg, fontWeight: '700' },
  imageBtn: {
    backgroundColor: Colors.surfaceElevated, borderWidth: 1,
    borderColor: Colors.border, borderRadius: 10, padding: 12,
    alignItems: 'center', marginBottom: 10,
  },
  imageBtnText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  previewImage: { width: '100%', height: 150, borderRadius: 12, marginBottom: 16 },
  errorText: { color: Colors.error, fontSize: 13, marginBottom: 12 },
  saveBtn: {
    backgroundColor: Colors.accent, borderRadius: 12,
    padding: 16, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: Colors.bg },
});