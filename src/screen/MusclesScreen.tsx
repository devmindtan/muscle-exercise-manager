import { useState, useCallback } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Plus, ChevronRight, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { persistImageLocally } from '@/src/lib/image';
import { getMuscleGroups, createMuscleGroup } from '@/src/lib/repository';
import { MuscleGroup } from '@/src/types/database';
import { Colors } from '@/src/constants/colors';

export default function MusclesScreen() {
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState<MuscleGroup[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const [form, setForm] = useState({
    name: '',
    target_sets_per_week: '10',
    target_sets_per_month: '40',
    color: Colors.muscleColors[0],
    image_uri: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const data = await getMuscleGroups();
    setGroups(data);
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
      color: Colors.muscleColors[groups.length % Colors.muscleColors.length],
      image_uri: '',
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

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
          />
        }
      >
        <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
          <Text style={styles.title}>Nhóm cơ</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Plus color={Colors.bg} size={20} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {groups.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Chưa có nhóm cơ</Text>
            <Text style={styles.emptyText}>
              Nhấn + để thêm nhóm cơ đầu tiên
            </Text>
          </View>
        ) : (
          groups.map((g) => (
            <TouchableOpacity
              key={g.id}
              style={styles.card}
              onPress={() => router.push(`/muscles/${g.id}`)}
              activeOpacity={0.75}
            >
              <View style={[styles.colorBar, { backgroundColor: g.color }]} />
              <View style={styles.cardBody}>
                <Text style={styles.cardName}>{g.name}</Text>
                <View style={styles.targets}>
                  <View style={styles.target}>
                    <Text style={styles.targetNum}>
                      {g.target_sets_per_week}
                    </Text>
                    <Text style={styles.targetLabel}>sets/tuần</Text>
                  </View>
                  <View style={styles.targetDivider} />
                  <View style={styles.target}>
                    <Text style={styles.targetNum}>
                      {g.target_sets_per_month}
                    </Text>
                    <Text style={styles.targetLabel}>sets/tháng</Text>
                  </View>
                </View>
              </View>
              {g.image_uri ? (
                <Image source={{ uri: g.image_uri }} style={styles.cardImage} />
              ) : null}
              <ChevronRight
                color={Colors.textMuted}
                size={18}
                strokeWidth={1.8}
              />
            </TouchableOpacity>
          ))
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
                onChangeText={(t) =>
                  setForm((f) => ({ ...f, target_sets_per_week: t }))
                }
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Sets mục tiêu/tháng</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={form.target_sets_per_month}
                onChangeText={(t) =>
                  setForm((f) => ({ ...f, target_sets_per_month: t }))
                }
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

          <Text style={styles.label}>Hình minh hoạ (tuỳ chọn)</Text>
          <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
            <Text style={styles.imageBtnText}>
              {form.image_uri ? 'Đổi hình minh hoạ' : 'Chọn hình minh hoạ'}
            </Text>
          </TouchableOpacity>
          {form.image_uri ? (
            <Image
              source={{ uri: form.image_uri }}
              style={styles.previewImage}
            />
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
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: 32 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  colorBar: { width: 4, alignSelf: 'stretch' },
  cardBody: { flex: 1, padding: 16 },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  cardImage: { width: 44, height: 44, borderRadius: 10, marginRight: 10 },
  targets: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  target: { alignItems: 'center' },
  targetNum: { fontSize: 18, fontWeight: '700', color: Colors.accent },
  targetLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  targetDivider: { width: 1, height: 24, backgroundColor: Colors.border },

  emptyBox: {
    margin: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },

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
    height: 150,
    borderRadius: 12,
    marginBottom: 16,
  },

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
