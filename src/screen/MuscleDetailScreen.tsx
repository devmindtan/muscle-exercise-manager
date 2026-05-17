import { useState, useCallback, useRef } from 'react';
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
  Alert,
  Image,
  Switch,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Plus, Trash2, X, Pencil } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { persistImageLocally } from '@/src/lib/image';
import { uploadImage } from '@/src/services/imageUpload';
import {
  getMuscleGroup,
  updateMuscleGroup,
  softDeleteMuscleGroup,
  getExercises,
  insertExercise,
  updateExercise,
  getSetCounts,
} from '@/src/lib/repository';
import { MuscleGroup, Exercise } from '@/src/types/database';
import { Colors } from '@/src/constants/colors';

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday.toISOString(), end: sunday.toISOString() };
}

export default function MuscleDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [weeklySets, setWeeklySets] = useState(0);
  const [monthlySets, setMonthlySets] = useState(0);

  const [showAddExercise, setShowAddExercise] = useState(false);
  const [exName, setExName] = useState('');
  const [exNotes, setExNotes] = useState('');
  const [exImageUri, setExImageUri] = useState('');
  const [saving, setSaving] = useState(false);
  const [exError, setExError] = useState('');
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);

  const [editingGroup, setEditingGroup] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    target_sets_per_week: '',
    target_sets_per_month: '',
    color: '',
    image_uri: '',
    category: '',
  });

  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [showEditExercise, setShowEditExercise] = useState(false);
  const [editExerciseForm, setEditExerciseForm] = useState({
    name: '',
    notes: '',
    image_uri: '',
    is_active: true,
  });

  const load = useCallback(async () => {
    if (!id) return;
    const { start: weekStart, end: weekEnd } = getWeekRange();
    const now = new Date();
    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toISOString();
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    ).toISOString();

    const [g, ex, wSets, mSets] = await Promise.all([
      getMuscleGroup(id),
      getExercises(id),
      getSetCounts(id, weekStart, weekEnd),
      getSetCounts(id, monthStart, monthEnd),
    ]);

    if (g) setGroup(g);
    setExercises(ex);
    setWeeklySets(wSets);
    setMonthlySets(mSets);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openEdit = () => {
    if (!group) return;
    setEditForm({
      name: group.name,
      target_sets_per_week: String(group.target_sets_per_week),
      target_sets_per_month: String(group.target_sets_per_month),
      color: group.color,
      image_uri: group.image_uri || '',
      category: group.category || '',
    });
    setEditingGroup(true);
  };

  const saveEdit = async () => {
    if (!group || !editForm.name.trim()) return;
    // Đóng modal trước khi load lại dữ liệu để tránh kẹt overlay
    setEditingGroup(false);
    // Đợi modal đóng xong mới load lại dữ liệu
    setTimeout(async () => {
      await updateMuscleGroup(group.id, {
        name: editForm.name.trim(),
        target_sets_per_week:
          parseInt(editForm.target_sets_per_week) || group.target_sets_per_week,
        target_sets_per_month:
          parseInt(editForm.target_sets_per_month) || group.target_sets_per_month,
        color: editForm.color,
        image_uri: editForm.image_uri.trim() || null,
        category: editForm.category || null,
      });
      load();
    }, 300);
  };

  // Track xem ảnh đang upload không — dùng để block nút Save
  const [uploadingImage, setUploadingImage] = useState(false);

  const pickImage = async (onPicked: (uri: string) => void) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setExError('Cần quyền truy cập thư viện ảnh để chọn hình minh hoạ');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.75,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];

      // Hiển thị preview local ngay lập tức
      const localUri = await persistImageLocally(asset.uri);
      onPicked(localUri);

      // Upload lên MinIO — block Save cho đến khi xong
      setUploadingImage(true);
      try {
        const fileName = asset.fileName || `image_${Date.now()}.jpg`;
        const mimeType = asset.mimeType || 'image/jpeg';
        const uploadResult = await uploadImage(localUri, fileName, mimeType);

        if (uploadResult.success && uploadResult.url) {
          // Cập nhật URI thành URL MinIO trước khi cho phép Save
          onPicked(uploadResult.url);
        } else {
          // Upload thất bại: xoá preview, báo lỗi, không cho lưu local path
          onPicked('');
          setExError('Không thể upload ảnh lên server. Vui lòng thử lại.');
          console.warn('MinIO upload failed:', uploadResult.error);
        }
      } catch (uploadErr: any) {
        onPicked('');
        setExError('Lỗi upload ảnh: ' + uploadErr.message);
        console.warn('Image upload error:', uploadErr.message);
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const deleteGroup = () => {
    Alert.alert(
      'Xoá nhóm cơ',
      `Xoá "${group?.name}"? Tất cả bài tập và lịch sử sẽ bị ẩn.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: async () => {
            await softDeleteMuscleGroup(id as string);
            router.back();
          },
        },
      ],
    );
  };

  const addExercise = async () => {
    if (!exName.trim()) {
      setExError('Vui lòng nhập tên bài tập');
      return;
    }
    setSaving(true);
    try {
      await insertExercise({
        muscle_group_id: id as string,
        name: exName.trim(),
        notes: exNotes.trim() || null,
        image_uri: exImageUri.trim() || null,
      });
      setShowAddExercise(false);
      setExName('');
      setExNotes('');
      setExImageUri('');
      load();
    } catch (e: unknown) {
      setExError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setSaving(false);
    }
  };

  const openEditExercise = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setEditExerciseForm({
      name: exercise.name,
      notes: exercise.notes || '',
      image_uri: exercise.image_uri || '',
      is_active: exercise.is_active,
    });
    setShowEditExercise(true);
  };

  const saveExercise = async () => {
    if (!editingExercise || !editExerciseForm.name.trim()) {
      setExError('Tên bài tập không được để trống');
      return;
    }
    setSaving(true);
    setExError('');
    try {
      await updateExercise(editingExercise.id, {
        name: editExerciseForm.name.trim(),
        notes: editExerciseForm.notes.trim() || null,
        image_uri: editExerciseForm.image_uri.trim() || null,
        is_active: editExerciseForm.is_active,
      });
      setShowEditExercise(false);
      setEditingExercise(null);
      load();
    } catch (e: unknown) {
      setExError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setSaving(false);
    }
  };

  const toggleExerciseActive = async (exercise: Exercise) => {
    await updateExercise(exercise.id, { is_active: !exercise.is_active });
    load();
  };

  if (!group) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadText}>Đang tải...</Text>
      </View>
    );
  }

  const weekPct =
    group.target_sets_per_week > 0
      ? Math.min(weeklySets / group.target_sets_per_week, 1)
      : 0;
  const monthPct =
    group.target_sets_per_month > 0
      ? Math.min(monthlySets / group.target_sets_per_month, 1)
      : 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <ArrowLeft color={Colors.text} size={22} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.topActions}>
            <TouchableOpacity onPress={openEdit} style={styles.iconBtn}>
              <Pencil
                color={Colors.textSecondary}
                size={18}
                strokeWidth={1.8}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={deleteGroup} style={styles.iconBtn}>
              <Trash2 color={Colors.error} size={18} strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Group name */}
        <View style={styles.groupHeader}>
          <View style={[styles.groupDot, { backgroundColor: group.color }]} />
          <Text style={styles.groupName}>{group.name}</Text>
          {group.category ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{group.category}</Text>
            </View>
          ) : null}
        </View>
        {group.image_uri ? (
          <TouchableOpacity onPress={() => setPreviewImageUri(group.image_uri)}>
            <Image source={{ uri: group.image_uri }} style={styles.groupImage} />
          </TouchableOpacity>
        ) : null}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text
              style={[
                styles.statNum,
                { color: weekPct >= 1 ? Colors.success : Colors.accent },
              ]}
            >
              {weeklySets}
            </Text>
            <Text style={styles.statLabel}>sets tuần này</Text>
            <View style={styles.statBar}>
              <View
                style={[
                  styles.statFill,
                  {
                    width: `${weekPct * 100}%`,
                    backgroundColor:
                      weekPct >= 1 ? Colors.success : group.color,
                  },
                ]}
              />
            </View>
            <Text style={styles.statTarget}>
              Mục tiêu: {group.target_sets_per_week}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text
              style={[
                styles.statNum,
                { color: monthPct >= 1 ? Colors.success : Colors.accent },
              ]}
            >
              {monthlySets}
            </Text>
            <Text style={styles.statLabel}>sets tháng này</Text>
            <View style={styles.statBar}>
              <View
                style={[
                  styles.statFill,
                  {
                    width: `${monthPct * 100}%`,
                    backgroundColor:
                      monthPct >= 1 ? Colors.success : group.color,
                  },
                ]}
              />
            </View>
            <Text style={styles.statTarget}>
              Mục tiêu: {group.target_sets_per_month}
            </Text>
          </View>
        </View>

        {/* Exercises */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Bài tập</Text>
          <TouchableOpacity
            style={styles.addExBtn}
            onPress={() => {
              setExName('');
              setExNotes('');
              setExImageUri('');
              setExError('');
              setShowAddExercise(true);
            }}
          >
            <Plus color={Colors.bg} size={16} strokeWidth={2.5} />
            <Text style={styles.addExText}>Thêm</Text>
          </TouchableOpacity>
        </View>

        {exercises.length === 0 ? (
          <View style={styles.emptyEx}>
            <Text style={styles.emptyExText}>Chưa có bài tập nào</Text>
          </View>
        ) : (
          exercises.map((ex) => (
            <View key={ex.id} style={styles.exCard}>
              <View
                style={[styles.exAccent, { backgroundColor: group.color }]}
              />
              {ex.image_uri ? (
                <TouchableOpacity onPress={() => setPreviewImageUri(ex.image_uri)}>
                  <Image source={{ uri: ex.image_uri }} style={styles.exThumb} />
                </TouchableOpacity>
              ) : null}
              <View style={styles.exBody}>
                <View style={styles.exTopRow}>
                  <Text style={styles.exName}>{ex.name}</Text>
                  {!ex.is_active ? (
                    <Text style={styles.inactiveBadge}>Đã vô hiệu hoá</Text>
                  ) : null}
                </View>
                {ex.notes ? (
                  <Text style={styles.exNotes}>{ex.notes}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => openEditExercise(ex)}
                style={styles.exActionBtn}
              >
                <Pencil color={Colors.textMuted} size={16} strokeWidth={1.8} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => toggleExerciseActive(ex)}
                style={styles.exActionBtn}
              >
                <Text style={styles.toggleText}>
                  {ex.is_active ? 'Vô hiệu' : 'Bật lại'}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Exercise Modal */}
      <Modal
        visible={showAddExercise}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddExercise(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setShowAddExercise(false)}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Thêm bài tập</Text>
            <TouchableOpacity onPress={() => setShowAddExercise(false)}>
              <X color={Colors.textSecondary} size={20} />
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Tên bài tập</Text>
          <TextInput
            style={styles.input}
            placeholder="VD: Bench Press, Pull-up..."
            placeholderTextColor={Colors.textMuted}
            value={exName}
            onChangeText={setExName}
            autoFocus
          />
          <Text style={styles.label}>Ghi chú (tuỳ chọn)</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            placeholder="Kỹ thuật, hướng dẫn..."
            placeholderTextColor={Colors.textMuted}
            value={exNotes}
            onChangeText={setExNotes}
            multiline
            numberOfLines={3}
          />
          <Text style={styles.label}>Hình minh hoạ (tuỳ chọn)</Text>
          <TouchableOpacity
            style={styles.imageBtn}
            onPress={() => pickImage(setExImageUri)}
          >
            <Text style={styles.imageBtnText}>
              {exImageUri ? 'Đổi hình minh hoạ' : 'Chọn hình minh hoạ'}
            </Text>
          </TouchableOpacity>
          {exImageUri ? (
            <Image source={{ uri: exImageUri }} style={styles.previewImage} />
          ) : null}
          {exError ? <Text style={styles.errorText}>{exError}</Text> : null}
          <TouchableOpacity
            style={[styles.saveBtn, (saving || uploadingImage) && styles.saveBtnDisabled]}
            onPress={addExercise}
            disabled={saving || uploadingImage}
          >
            <Text style={styles.saveBtnText}>
              {uploadingImage ? 'Đang upload ảnh...' : saving ? 'Đang lưu...' : 'Thêm bài tập'}
            </Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Group Modal */}
      <Modal
        visible={editingGroup}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingGroup(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setEditingGroup(false)}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Chỉnh sửa</Text>
            <TouchableOpacity onPress={() => setEditingGroup(false)}>
              <X color={Colors.textSecondary} size={20} />
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Tên nhóm cơ</Text>
          <TextInput
            style={styles.input}
            value={editForm.name}
            onChangeText={(t) => setEditForm((f) => ({ ...f, name: t }))}
            placeholderTextColor={Colors.textMuted}
          />
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Sets/tuần</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={editForm.target_sets_per_week}
                onChangeText={(t) =>
                  setEditForm((f) => ({ ...f, target_sets_per_week: t }))
                }
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Sets/tháng</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={editForm.target_sets_per_month}
                onChangeText={(t) =>
                  setEditForm((f) => ({ ...f, target_sets_per_month: t }))
                }
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>
          <Text style={styles.label}>Danh mục</Text>
          <View style={styles.categoryPicker}>
            {['Ngực', 'Lưng', 'Vai', 'Tay', 'Chân', 'Bụng', 'Khác'].map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  editForm.category === cat && styles.categoryChipActive,
                ]}
                onPress={() =>
                  setEditForm((f) => ({
                    ...f,
                    category: f.category === cat ? '' : cat,
                  }))
                }
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    editForm.category === cat && styles.categoryChipTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>Màu sắc</Text>
          <View style={styles.colorPicker}>
            {Colors.muscleColors.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorOption,
                  { backgroundColor: c },
                  editForm.color === c && styles.colorSelected,
                ]}
                onPress={() => setEditForm((f) => ({ ...f, color: c }))}
              />
            ))}
          </View>
          <Text style={styles.label}>Hình minh hoạ (tuỳ chọn)</Text>
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
            <Image
              source={{ uri: editForm.image_uri }}
              style={styles.previewImage}
            />
          ) : null}
          <TouchableOpacity
            style={[styles.saveBtn, uploadingImage && styles.saveBtnDisabled]}
            onPress={saveEdit}
            disabled={uploadingImage}
          >
            <Text style={styles.saveBtnText}>
              {uploadingImage ? 'Đang upload ảnh...' : 'Lưu thay đổi'}
            </Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Exercise Modal */}
      <Modal
        visible={showEditExercise}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditExercise(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setShowEditExercise(false)}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Sửa bài tập</Text>
            <TouchableOpacity onPress={() => setShowEditExercise(false)}>
              <X color={Colors.textSecondary} size={20} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Tên bài tập</Text>
          <TextInput
            style={styles.input}
            value={editExerciseForm.name}
            onChangeText={(t) =>
              setEditExerciseForm((f) => ({ ...f, name: t }))
            }
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.label}>Ghi chú</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={editExerciseForm.notes}
            onChangeText={(t) =>
              setEditExerciseForm((f) => ({ ...f, notes: t }))
            }
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.label}>Hình minh hoạ (tuỳ chọn)</Text>
          <TouchableOpacity
            style={styles.imageBtn}
            onPress={() =>
              pickImage((uri) =>
                setEditExerciseForm((f) => ({ ...f, image_uri: uri })),
              )
            }
          >
            <Text style={styles.imageBtnText}>
              {editExerciseForm.image_uri
                ? 'Đổi hình minh hoạ'
                : 'Chọn hình minh hoạ'}
            </Text>
          </TouchableOpacity>
          {editExerciseForm.image_uri ? (
            <Image
              source={{ uri: editExerciseForm.image_uri }}
              style={styles.previewImage}
            />
          ) : null}

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Kích hoạt bài tập</Text>
            <Switch
              value={editExerciseForm.is_active}
              onValueChange={(v) =>
                setEditExerciseForm((f) => ({ ...f, is_active: v }))
              }
              thumbColor={Colors.bg}
              trackColor={{ true: Colors.success, false: Colors.border }}
            />
          </View>

          {exError ? <Text style={styles.errorText}>{exError}</Text> : null}

          <TouchableOpacity
            style={[styles.saveBtn, (saving || uploadingImage) && styles.saveBtnDisabled]}
            onPress={saveExercise}
            disabled={saving || uploadingImage}
          >
            <Text style={styles.saveBtnText}>
              {uploadingImage ? 'Đang upload ảnh...' : saving ? 'Đang lưu...' : 'Lưu bài tập'}
            </Text>
          </TouchableOpacity>
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
  topActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 8 },

  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  groupDot: { width: 14, height: 14, borderRadius: 7 },
  groupName: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  categoryBadge: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  categoryPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  categoryChipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  groupImage: {
    marginHorizontal: 20,
    height: 140,
    borderRadius: 14,
    marginBottom: 20,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statNum: { fontSize: 32, fontWeight: '800', lineHeight: 36 },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 10 },
  statBar: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  statFill: { height: '100%', borderRadius: 2 },
  statTarget: { fontSize: 11, color: Colors.textMuted },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  addExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addExText: { fontSize: 12, fontWeight: '700', color: Colors.bg },

  exCard: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exAccent: { width: 3, alignSelf: 'stretch' },
  exThumb: { width: 44, height: 44, borderRadius: 10, marginLeft: 12 },

  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewFullImage: {
    width: '100%',
    height: '80%',
  },
  exBody: { flex: 1, padding: 14 },
  exTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  exNotes: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  inactiveBadge: {
    fontSize: 10,
    color: Colors.warning,
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  exActionBtn: { paddingHorizontal: 10, paddingVertical: 14 },
  toggleText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },

  emptyEx: {
    marginHorizontal: 20,
    padding: 24,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyExText: { color: Colors.textMuted, fontSize: 13 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
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
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },

  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  colorOption: { width: 36, height: 36, borderRadius: 18 },
  colorSelected: { borderWidth: 3, borderColor: Colors.text },
  imageBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  imageBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  previewImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  switchLabel: { color: Colors.text, fontSize: 14, fontWeight: '600' },

  errorText: { color: Colors.error, fontSize: 13, marginBottom: 12 },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: Colors.bg },
});