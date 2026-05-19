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
  Alert,
  Image,
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
  getExercisesWithStats,
  insertExercise,
  updateExercise,
  getSetCounts,
  getMuscleGroups,
  softDeleteExercise,
  setExerciseActive,
} from '@/src/lib/repository';
import { ExerciseWithStats } from '@/src/db/localDB';
import { MuscleGroup } from '@/src/types/database';
import { Colors } from '@/src/constants/colors';

const MUSCLE_CATEGORIES = ['Ngực', 'Lưng', 'Vai', 'Tay', 'Chân', 'Bụng', 'Khác'];

function formatRelativeDate(isoString: string | null | undefined): string {
  if (!isoString) return 'Chưa tập';
  const now = new Date();
  const date = new Date(isoString);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === 1) return 'Hôm qua';
  if (diffDays < 7) return `${diffDays} ngày trước`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} tháng trước`;
  return `${Math.floor(diffDays / 365)} năm trước`;
}

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
  const [exercises, setExercises] = useState<ExerciseWithStats[]>([]);
  const [exTab, setExTab] = useState<'active' | 'disabled'>('active');
  const [weeklySets, setWeeklySets] = useState(0);
  const [monthlySets, setMonthlySets] = useState(0);

  const [showAddExercise, setShowAddExercise] = useState(false);
  const [exName, setExName] = useState('');
  const [exNotes, setExNotes] = useState('');
  const [exImageUri, setExImageUri] = useState('');
  const [saving, setSaving] = useState(false);
  const [exError, setExError] = useState('');

  const [editingGroup, setEditingGroup] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    target_sets_per_week: '',
    target_sets_per_month: '',
    color: '',
    image_uri: '',
    category: '',
  });

  const [allMuscleGroups, setAllMuscleGroups] = useState<MuscleGroup[]>([]);
  const [editingExercise, setEditingExercise] = useState<ExerciseWithStats | null>(null);
  const [showEditExercise, setShowEditExercise] = useState(false);
  const [editExerciseForm, setEditExerciseForm] = useState({
    name: '',
    notes: '',
    image_uri: '',
    muscle_group_id: '',
  });

  // Track xem ảnh đang upload không — dùng để block nút Save
  const [uploadingImage, setUploadingImage] = useState(false);

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

    const [g, ex, wSets, mSets, allGroups] = await Promise.all([
      getMuscleGroup(id),
      getExercisesWithStats(id, weekStart),
      getSetCounts(id, weekStart, weekEnd),
      getSetCounts(id, monthStart, monthEnd),
      getMuscleGroups(),
    ]);
    if (g) setGroup(g);
    setExercises(ex);
    setWeeklySets(wSets);
    setMonthlySets(mSets);
    setAllMuscleGroups(allGroups);
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
    setEditingGroup(false);
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

  const pickImage = async (onPicked: (uri: string) => void) => {
    try {
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
        const localUri = await persistImageLocally(asset.uri);
        onPicked(localUri);

        setUploadingImage(true);
        try {
          const fileName = asset.fileName || `image_${Date.now()}.jpg`;
          const mimeType = asset.mimeType || 'image/jpeg';
          const result = await uploadImage(localUri, fileName, mimeType);
          if (result.success && result.url) {
            onPicked(result.url);
          } else {
            onPicked('');
          }
        } catch (uploadErr: any) {
          console.error('Upload failed:', uploadErr);
        } finally {
          setUploadingImage(false);
        }
      }
    } catch (e: any) {
      setExError('Lỗi chọn ảnh: ' + e.message);
    }
  };

  const deleteGroup = () => {
    Alert.alert(
      'Xoá nhóm cơ',
      `Xoà "${group?.name}"? Tất cả bài tập và lịch sử sẽ bị ẩn.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoà',
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

  const openEditExercise = (exercise: ExerciseWithStats) => {
    setEditingExercise(exercise);
    setEditExerciseForm({
      name: exercise.name,
      notes: exercise.notes || '',
      image_uri: exercise.image_uri || '',
      muscle_group_id: exercise.muscle_group_id,
    });
    setShowEditExercise(true);
  };

  const deleteExercise = () => {
    if (!editingExercise) return;
    Alert.alert(
      'Xoá bài tập',
      `Xoá "${editingExercise.name}"? Tất cả lịch sử sẽ bị ẩn.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoà',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await softDeleteExercise(editingExercise.id);
              setShowEditExercise(false);
              setEditingExercise(null);
              load();
            } catch (e: unknown) {
              setExError(e instanceof Error ? e.message : 'Lỗi không xác định');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
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
        muscle_group_id: editExerciseForm.muscle_group_id,
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

  const handleToggleExerciseActive = async () => {
    if (!editingExercise) return;
    const newActive = !editingExercise.is_active;
    setSaving(true);
    try {
      await setExerciseActive(editingExercise.id, newActive);
      setShowEditExercise(false);
      setEditingExercise(null);
      load();
    } catch (e: unknown) {
      setExError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setSaving(false);
    }
  };

  if (!group) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadText}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{group.name}</Text>
        <TouchableOpacity onPress={openEdit} style={styles.editBtn}>
          <Pencil color={Colors.text} size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{weeklySets}</Text>
            <Text style={styles.statLabel}>Tuần này</Text>
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(100, (weeklySets / group.target_sets_per_week) * 100)}%`,
                    backgroundColor: group.color,
                  },
                ]}
              />
            </View>
            <Text style={styles.targetText}>mục tiêu: {group.target_sets_per_week}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{monthlySets}</Text>
            <Text style={styles.statLabel}>Tháng này</Text>
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(100, (monthlySets / group.target_sets_per_month) * 100)}%`,
                    backgroundColor: group.color,
                  },
                ]}
              />
            </View>
            <Text style={styles.targetText}>mục tiêu: {group.target_sets_per_month}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Bài tập</Text>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: group.color }]}
            onPress={() => setShowAddExercise(true)}
          >
            <Plus color={Colors.bg} size={20} />
            <Text style={styles.addBtnText}>Thêm bài</Text>
          </TouchableOpacity>
        </View>

        {/* Exercise tabs */}
        <View style={styles.exTabBar}>
          <TouchableOpacity
            style={[styles.exTab, exTab === 'active' && styles.exTabActive]}
            onPress={() => setExTab('active')}
          >
            <Text style={[styles.exTabText, exTab === 'active' && styles.exTabTextActive]}>Hoạt động</Text>
            <View style={[styles.exTabBadge, exTab === 'active' && styles.exTabBadgeActive]}>
              <Text style={[styles.exTabBadgeText, exTab === 'active' && styles.exTabBadgeTextActive]}>
                {exercises.filter((e) => !!e.is_active).length}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exTab, exTab === 'disabled' && styles.exTabActive]}
            onPress={() => setExTab('disabled')}
          >
            <Text style={[styles.exTabText, exTab === 'disabled' && styles.exTabTextActive]}>Vô hiệu hoá</Text>
            <View style={[styles.exTabBadge, exTab === 'disabled' && styles.exTabBadgeActive]}>
              <Text style={[styles.exTabBadgeText, exTab === 'disabled' && styles.exTabBadgeTextActive]}>
                {exercises.filter((e) => !e.is_active).length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {exTab === 'active' && exercises.filter((e) => !!e.is_active).map((ex) => (
          <TouchableOpacity
            key={ex.id}
            style={styles.exCard}
            onPress={() => router.push(`/muscles/exercises/${ex.id}` as any)}
          >
            {ex.image_uri ? (
              <Image source={{ uri: ex.image_uri }} style={styles.exImg} />
            ) : (
              <View style={[styles.exImgPlaceholder, { backgroundColor: group.color + '20' }]}>
                <Text style={[styles.exImgText, { color: group.color }]}>
                  {ex.name[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.exInfo}>
              <Text style={styles.exName}>{ex.name}</Text>
              <Text style={styles.exDate}>{formatRelativeDate(ex.last_logged_at)}</Text>
              {ex.notes ? (
                <Text style={styles.exNotes} numberOfLines={1}>{ex.notes}</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => openEditExercise(ex)} style={styles.exEditIcon}>
              <View style={styles.weeklySetsbadge}>
                <Text style={styles.weeklySetsBadgeText}>
                  {(ex.weekly_sets ?? 0) > 0 ? `${ex.weekly_sets}s/w` : '0s/w'}
                </Text>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        {exTab === 'disabled' && exercises.filter((e) => !e.is_active).length === 0 && (
          <View style={styles.emptyTab}>
            <Text style={styles.emptyTabText}>Không có bài tập nào bị vô hiệu hoá</Text>
          </View>
        )}
        {exTab === 'disabled' && exercises.filter((e) => !e.is_active).map((ex) => (
          <TouchableOpacity
            key={ex.id}
            style={[styles.exCard, styles.exCardDisabled]}
            onPress={() => openEditExercise(ex)}
          >
            {ex.image_uri ? (
              <Image source={{ uri: ex.image_uri }} style={[styles.exImg, styles.disabledImage]} />
            ) : (
              <View style={[styles.exImgPlaceholder, { backgroundColor: Colors.border }]}>
                <Text style={[styles.exImgText, { color: Colors.textMuted }]}>
                  {ex.name[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.exInfo}>
              <Text style={[styles.exName, styles.disabledText]}>{ex.name}</Text>
              <Text style={styles.exDate}>{formatRelativeDate(ex.last_logged_at)}</Text>
              {ex.notes ? (
                <Text style={styles.exNotes} numberOfLines={1}>{ex.notes}</Text>
              ) : null}
            </View>
            <View style={styles.exEditIcon}>
              <Text style={styles.enableHint}>Bật lại</Text>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.deleteGroupBtn} onPress={deleteGroup}>
          <Trash2 color={Colors.error} size={20} />
          <Text style={styles.deleteGroupText}>Xoá nhóm cơ</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL ADD EXERCISE */}
      <Modal
        visible={showAddExercise}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddExercise(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowAddExercise(false)} />
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

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Tên bài tập</Text>
            <TextInput
              style={styles.input}
              value={exName}
              onChangeText={setExName}
              placeholder="VD: Bench Press, Pull-up..."
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />

            <Text style={styles.label}>Ghi chú (tuỳ chọn)</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={exNotes}
              onChangeText={setExNotes}
              placeholder="Kỹ thuật, hướng dẫn..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.label}>Hình minh hoạ (tuỳ chọn)</Text>
            <TouchableOpacity style={styles.imageBtn} onPress={() => pickImage(setExImageUri)}>
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
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL EDIT EXERCISE */}
      <Modal
        visible={showEditExercise}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowEditExercise(false); setEditingExercise(null); }}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => { setShowEditExercise(false); setEditingExercise(null); }}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Sửa bài tập</Text>
            <TouchableOpacity onPress={() => { setShowEditExercise(false); setEditingExercise(null); }}>
              <X color={Colors.textSecondary} size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Tên bài tập</Text>
            <TextInput
              style={styles.input}
              value={editExerciseForm.name}
              onChangeText={(t) => setEditExerciseForm((f) => ({ ...f, name: t }))}
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>Ghi chú</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={editExerciseForm.notes}
              onChangeText={(t) => setEditExerciseForm((f) => ({ ...f, notes: t }))}
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.label}>Hình minh hoạ (tuỳ chọn)</Text>
            <TouchableOpacity
              style={styles.imageBtn}
              onPress={() => pickImage((uri) => setEditExerciseForm((f) => ({ ...f, image_uri: uri })))}
            >
              <Text style={styles.imageBtnText}>
                {editExerciseForm.image_uri ? 'Đổi hình minh hoạ' : 'Chọn hình minh hoạ'}
              </Text>
            </TouchableOpacity>
            {editExerciseForm.image_uri ? (
              <Image source={{ uri: editExerciseForm.image_uri }} style={styles.previewImage} />
            ) : null}

            <Text style={styles.label}>Chuyển sang nhóm cơ khác</Text>
            <View style={styles.muscleGroupPicker}>
              {allMuscleGroups.map((mg) => (
                <TouchableOpacity
                  key={mg.id}
                  style={[
                    styles.muscleGroupChip,
                    editExerciseForm.muscle_group_id === mg.id && {
                      backgroundColor: mg.color,
                      borderColor: mg.color,
                    },
                  ]}
                  onPress={() => setEditExerciseForm((f) => ({ ...f, muscle_group_id: mg.id }))}
                >
                  <View style={[styles.chipDot, { backgroundColor: editExerciseForm.muscle_group_id === mg.id ? Colors.bg : mg.color }]} />
                  <Text
                    style={[
                      styles.muscleGroupChipText,
                      editExerciseForm.muscle_group_id === mg.id && styles.muscleGroupChipTextActive,
                    ]}
                  >
                    {mg.name}
                  </Text>
                </TouchableOpacity>
              ))}
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
            <TouchableOpacity
              style={[styles.disableBtn, saving && styles.saveBtnDisabled]}
              onPress={handleToggleExerciseActive}
              disabled={saving}
            >
              <Text style={styles.disableBtnText}>
                {editingExercise?.is_active ? 'Vô hiệu hoá bài tập' : 'Bật lại bài tập'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteBtn, saving && styles.saveBtnDisabled]}
              onPress={deleteExercise}
              disabled={saving}
            >
              <Trash2 color={Colors.bg} size={18} strokeWidth={2} />
              <Text style={styles.deleteBtnText}>Xoá bài tập</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL EDIT GROUP */}
      <Modal
        visible={editingGroup}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingGroup(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setEditingGroup(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Chỉnh sửa nhóm cơ</Text>
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

          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Sets mục tiêu/tuần</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={editForm.target_sets_per_week}
                onChangeText={(t) => setEditForm((f) => ({ ...f, target_sets_per_week: t }))}
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Sets mục tiêu/tháng</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={editForm.target_sets_per_month}
                onChangeText={(t) => setEditForm((f) => ({ ...f, target_sets_per_month: t }))}
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
                  editForm.color === c && styles.colorSelected,
                ]}
                onPress={() => setEditForm((f) => ({ ...f, color: c }))}
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

          <Text style={styles.label}>Hình minh hoạ (tuỳ chọn)</Text>
          <TouchableOpacity
            style={styles.imageBtn}
            onPress={() => pickImage((uri) => setEditForm((f) => ({ ...f, image_uri: uri })))}
          >
            <Text style={styles.imageBtnText}>
              {editForm.image_uri ? 'Đổi hình minh hoạ' : 'Chọn hình minh hoạ'}
            </Text>
          </TouchableOpacity>
          {editForm.image_uri ? (
            <Image source={{ uri: editForm.image_uri }} style={styles.previewImage} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadText: { color: Colors.textSecondary, fontSize: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  editBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  scroll: { padding: 20 },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  statBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderBottomWidth: 4,
    borderColor: Colors.border,
  },
  statVal: { fontSize: 28, fontWeight: '900', color: Colors.text },
  statLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 12 },
  progressBg: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: { height: '100%', borderRadius: 3 },
  targetText: { fontSize: 11, color: Colors.textSecondary },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  addBtnText: { color: Colors.bg, fontWeight: '700', fontSize: 13 },
  exCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderBottomWidth: 3,
    borderColor: Colors.border,
  },
  exImg: { width: 50, height: 50, borderRadius: 10 },
  exImgPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exImgText: { fontSize: 20, fontWeight: '800' },
  exInfo: { flex: 1, marginLeft: 12 },
  exName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  exNotes: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  exDate: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  exEditIcon: { padding: 8 },
  weeklySetsbadge: {
    backgroundColor: Colors.accent + '22',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  weeklySetsBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.accent },
  disabledSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  disabledSectionTitle: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  exTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 16,
  },
  exTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  exTabActive: { borderBottomColor: Colors.accent },
  exTabText: { fontSize: 14, color: Colors.textMuted, fontWeight: '600' },
  exTabTextActive: { color: Colors.text },
  exTabBadge: {
    backgroundColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  exTabBadgeActive: { backgroundColor: Colors.accent + '25' },
  exTabBadgeText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  exTabBadgeTextActive: { color: Colors.accent },
  emptyTab: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  emptyTabText: { fontSize: 13, color: Colors.textMuted },
  enableHint: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic' },
  exCardDisabled: { opacity: 0.6, borderStyle: 'dashed' },
  disabledImage: { opacity: 0.5 },
  disabledText: { color: Colors.textSecondary },
  disableBtn: {
    borderWidth: 1,
    borderColor: Colors.textMuted,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  disableBtnText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  deleteGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
    padding: 12,
  },
  deleteGroupText: { fontSize: 14, fontWeight: '600', color: Colors.error },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
    marginBottom: 6,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    color: Colors.text,
    fontSize: 15,
    marginBottom: 16,
  },
  imagePicker: {
    height: 150,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  pickedImg: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  imagePlaceholderText: { color: Colors.textSecondary, fontSize: 14 },
  errorText: { color: Colors.error, fontSize: 13, marginBottom: 12 },
  saveBtn: {
    backgroundColor: Colors.accent,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveBtnText: { color: Colors.bg, fontWeight: '700', fontSize: 16 },
  row: { flexDirection: 'row' },
  rowFields: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  colorPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  colorOption: { width: 36, height: 36, borderRadius: 18 },
  colorSelected: { borderWidth: 3, borderColor: Colors.text },
  categoryPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  categoryChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  categoryChipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  categoryChipTextActive: { color: Colors.bg, fontWeight: '700' },
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
  previewImage: { width: '100%', height: 140, borderRadius: 12, marginBottom: 16 },
  saveBtnDisabled: { opacity: 0.6 },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  muscleGroupPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chipDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  muscleGroupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  muscleGroupChipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  muscleGroupChipTextActive: {
    color: Colors.bg,
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: Colors.error,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  deleteBtnText: { fontSize: 15, fontWeight: '700', color: Colors.bg },
});
