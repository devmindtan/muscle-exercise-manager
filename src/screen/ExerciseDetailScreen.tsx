import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Pencil,
  X,
  TrendingUp,
  Dumbbell,
  Calendar,
  Award,
  Info,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { persistImageLocally } from '@/src/lib/image';
import { uploadImage } from '@/src/services/imageUpload';
import {
  getExerciseById,
  updateExercise,
  getWorkoutLogs,
} from '@/src/lib/repository';
import { Exercise, WorkoutLog } from '@/src/types/database';
import { Colors } from '@/src/constants/colors';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export default function ExerciseDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);

  // Edit modal
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    notes: '',
    image_uri: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editError, setEditError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    const [ex, allLogs] = await Promise.all([
      getExerciseById(id),
      getWorkoutLogs(undefined, undefined, id),
    ]);
    if (ex) setExercise(ex);
    // Sort mới nhất lên đầu
    setLogs((allLogs as WorkoutLog[]).filter((l) => !l.deleted_at).sort(
      (a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
    ));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // --- Stats ---
  const totalSets = logs.reduce((s, l) => s + (l.sets || 0), 0);
  const totalSessions = logs.length;
  const bestWeight = logs.reduce((best, l) => Math.max(best, l.weight || 0), 0);
  const bestSetLoad = logs.reduce((best, l) => {
    const load = (l.reps || 0) * (l.weight || 0);
    return Math.max(best, load);
  }, 0);

  // Tính volume theo tuần gần đây (8 tuần)
  const weeklyVolume = (() => {
    const weeks: Record<string, number> = {};
    logs.forEach((l) => {
      const d = new Date(l.logged_at);
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      weeks[key] = (weeks[key] || 0) + (l.sets || 0);
    });
    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8);
  })();

  const maxWeekSets = Math.max(...weeklyVolume.map(([, v]) => v), 1);

  // --- Edit ---
  const openEdit = () => {
    if (!exercise) return;
    setEditForm({
      name: exercise.name,
      notes: exercise.notes || '',
      image_uri: exercise.image_uri || '',
    });
    setEditError('');
    setEditing(true);
  };

  const pickImage = async (onPicked: (uri: string) => void) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setEditError('Cần quyền truy cập thư viện ảnh');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.75,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const localUri = await persistImageLocally(asset.uri);
      onPicked(localUri);
      setUploadingImage(true);
      try {
        const fileName = asset.fileName || `image_${Date.now()}.jpg`;
        const mimeType = asset.mimeType || 'image/jpeg';
        const uploadResult = await uploadImage(localUri, fileName, mimeType);
        if (uploadResult.success && uploadResult.url) {
          onPicked(uploadResult.url);
        } else {
          onPicked('');
          setEditError('Không thể upload ảnh. Vui lòng thử lại.');
        }
      } catch (e: any) {
        onPicked('');
        setEditError('Lỗi upload: ' + e.message);
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const saveEdit = async () => {
    if (!exercise || !editForm.name.trim()) {
      setEditError('Tên bài tập không được để trống');
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      await updateExercise(exercise.id, {
        name: editForm.name.trim(),
        notes: editForm.notes.trim() || null,
        image_uri: editForm.image_uri.trim() || null,
      });
      setEditing(false);
      load();
    } catch (e: any) {
      setEditError(e.message || 'Lỗi không xác định');
    } finally {
      setSaving(false);
    }
  };

  if (!exercise) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadText}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color={Colors.text} size={22} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openEdit} style={styles.editBtn}>
            <Pencil color={Colors.textSecondary} size={18} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View style={styles.header}>
          {exercise.image_uri ? (
            <TouchableOpacity onPress={() => setPreviewImageUri(exercise.image_uri)}>
              <Image source={{ uri: exercise.image_uri }} style={styles.heroImage} />
            </TouchableOpacity>
          ) : (
            <View style={styles.heroPlaceholder}>
              <Dumbbell color={Colors.textMuted} size={40} strokeWidth={1.5} />
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.exerciseName}>{exercise.name}</Text>
            {exercise.notes ? (
              <Text style={styles.notes}>{exercise.notes}</Text>
            ) : null}
          </View>
        </View>

        {/* Stats cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Dumbbell color={Colors.accent} size={18} strokeWidth={1.8} />
            <Text style={styles.statNum}>{totalSets}</Text>
            <Text style={styles.statLabel}>Tổng sets</Text>
          </View>
          <View style={styles.statCard}>
            <Calendar color={Colors.accent} size={18} strokeWidth={1.8} />
            <Text style={styles.statNum}>{totalSessions}</Text>
            <Text style={styles.statLabel}>Buổi tập</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <TrendingUp color={Colors.accent} size={18} strokeWidth={1.8} />
              <TouchableOpacity onPress={() => setTooltip('pr_weight')} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Info color={Colors.textMuted} size={14} strokeWidth={1.8} />
              </TouchableOpacity>
            </View>
            <Text style={styles.statNum}>{Math.round(bestWeight)}</Text>
            <Text style={styles.statLabel}>PR tạ (kg)</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Award color={Colors.accent} size={18} strokeWidth={1.8} />
              <TouchableOpacity onPress={() => setTooltip('pr_load')} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Info color={Colors.textMuted} size={14} strokeWidth={1.8} />
              </TouchableOpacity>
            </View>
            <Text style={styles.statNum}>{Math.round(bestSetLoad)}</Text>
            <Text style={styles.statLabel}>PR load</Text>
          </View>
        </View>

        {/* Weekly volume chart */}
        {weeklyVolume.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Volume theo tuần (sets)</Text>
            <View style={styles.chartWrap}>
              {weeklyVolume.map(([week, sets]) => (
                <View key={week} style={styles.chartCol}>
                  <Text style={styles.chartVal}>{sets}</Text>
                  <View style={styles.chartBarBg}>
                    <View
                      style={[
                        styles.chartBarFill,
                        { height: `${(sets / maxWeekSets) * 100}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.chartLabel}>
                    {new Date(week).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Log history */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lịch sử tập ({logs.length})</Text>
          {logs.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Chưa có lịch sử tập nào</Text>
            </View>
          ) : (
            logs.map((log) => (
              <View key={log.id} style={styles.logItem}>
                <View style={styles.logLeft}>
                  <Text style={styles.logDate}>{formatDate(log.logged_at)}</Text>
                  {log.note ? (
                    <Text style={styles.logNote}>{log.note}</Text>
                  ) : null}
                </View>
                <View style={styles.logRight}>
                  <Text style={styles.logSets}>{log.sets} sets</Text>
                  {(log.reps || log.weight) ? (
                    <Text style={styles.logDetail}>
                      {log.reps ? `${log.reps} reps` : ''}
                      {log.reps && log.weight ? ' × ' : ''}
                      {log.weight ? `${log.weight} kg` : ''}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>


      {/* Tooltip Modal */}
      <Modal
        visible={!!tooltip}
        transparent
        animationType="fade"
        onRequestClose={() => setTooltip(null)}
      >
        <Pressable style={styles.tooltipOverlay} onPress={() => setTooltip(null)}>
          <View style={styles.tooltipBox}>
            {tooltip === 'pr_weight' ? (
              <>
                <Text style={styles.tooltipTitle}>Personal Record - PR tạ (kg)</Text>
                <Text style={styles.tooltipBody}>
                  Mức tạ nặng nhất bạn từng sử dụng cho bài tập này.{'\n'}
                  Ví dụ: nếu bạn từng Bench Press 100kg dù chỉ 1 lần, đó là PR tạ của bạn.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.tooltipTitle}>Personal Record - PR load</Text>
                <Text style={styles.tooltipBody}>
                  Kỷ lục sức mạnh tổng thể trong 1 set, tính bằng:{'\n'}
                  <Text style={styles.tooltipFormula}>reps × weight (kg)</Text>
                  {'\n'}
                  Ví dụ: 10 reps × 80kg = 800. Chỉ số này tăng kể cả khi bạn chưa tăng tạ nhưng tăng số lần lặp.
                </Text>
              </>
            )}
            <TouchableOpacity style={styles.tooltipCloseBtn} onPress={() => setTooltip(null)}>
              <Text style={styles.tooltipCloseBtnText}>Đã hiểu</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={editing}
        transparent
        animationType="slide"
        onRequestClose={() => setEditing(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setEditing(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Sửa bài tập</Text>
            <TouchableOpacity onPress={() => setEditing(false)}>
              <X color={Colors.textSecondary} size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Tên bài tập</Text>
            <TextInput
              style={styles.input}
              value={editForm.name}
              onChangeText={(t) => setEditForm((f) => ({ ...f, name: t }))}
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />

            <Text style={styles.label}>Ghi chú</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={editForm.notes}
              onChangeText={(t) => setEditForm((f) => ({ ...f, notes: t }))}
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.label}>Hình minh hoạ</Text>
            <TouchableOpacity
              style={styles.imageBtn}
              onPress={() =>
                pickImage((uri) => setEditForm((f) => ({ ...f, image_uri: uri })))
              }
            >
              <Text style={styles.imageBtnText}>
                {editForm.image_uri ? 'Đổi hình minh hoạ' : 'Chọn hình minh hoạ'}
              </Text>
            </TouchableOpacity>
            {editForm.image_uri ? (
              <TouchableOpacity onPress={() => setPreviewImageUri(editForm.image_uri)}>
                <Image source={{ uri: editForm.image_uri }} style={styles.previewImage} />
              </TouchableOpacity>
            ) : null}

            {editError ? <Text style={styles.errorText}>{editError}</Text> : null}

            <TouchableOpacity
              style={[
                styles.saveBtn,
                (saving || uploadingImage) && styles.saveBtnDisabled,
              ]}
              onPress={saveEdit}
              disabled={saving || uploadingImage}
            >
              <Text style={styles.saveBtnText}>
                {uploadingImage
                  ? 'Đang upload ảnh...'
                  : saving
                  ? 'Đang lưu...'
                  : 'Lưu thay đổi'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Full-size image preview */}
      <Modal
        visible={!!previewImageUri}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUri(null)}
      >
        <Pressable
          style={styles.previewOverlay}
          onPress={() => setPreviewImageUri(null)}
        >
          <Image
            source={{ uri: previewImageUri! }}
            style={styles.previewFullImage}
            resizeMode="contain"
          />
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadText: { color: Colors.textMuted, fontSize: 15 },
  content: { paddingBottom: 48 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: { padding: 8 },
  editBtn: { padding: 8 },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  heroImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  heroPlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    gap: 8,
  },
  exerciseName: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  notes: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    width: '47.5%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  statNum: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    lineHeight: 32,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },

  // Section
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  // Chart
  chartWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 140,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    gap: 4,
  },
  chartVal: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  chartBarBg: {
    flex: 1,
    width: '70%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 4,
    minHeight: 4,
  },
  chartLabel: {
    fontSize: 8,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  // Log history
  emptyBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
  logItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logLeft: { flex: 1, gap: 4 },
  logDate: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  logNote: { fontSize: 12, color: Colors.textMuted },
  logRight: { alignItems: 'flex-end', gap: 2 },
  logSets: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.accent,
  },
  logDetail: {
    fontSize: 12,
    color: Colors.textMuted,
  },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  label: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 6,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    color: Colors.text,
    fontSize: 15,
    marginBottom: 16,
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  imageBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  imageBtnText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  previewImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: { color: Colors.error, fontSize: 13, marginBottom: 12 },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: Colors.bg },

  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tooltipOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  tooltipBox: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
    gap: 12,
  },
  tooltipTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  tooltipBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  tooltipFormula: {
    fontWeight: '700',
    color: Colors.accent,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tooltipCloseBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  tooltipCloseBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.bg,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewFullImage: { width: '100%', height: '80%' },
});