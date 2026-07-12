import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getMuscleGroups, getExercises } from '@/src/lib/repository';
import { getWeeklyPlanEntries } from '@/src/services/weeklyPlanService';
import { groupExercisesByParent } from '@/src/lib/exerciseGrouping';
import type { SharedPlanEntryRow } from '@/src/services/socialService';

const SCHEMA_VERSION = 1;

export interface MuscleGroupsExportFile {
  schemaVersion: number;
  type: 'muscle_manager_muscle_groups';
  exportedAt: string;
  muscleGroups: {
    name: string;
    category: string | null;
    color: string;
    targetSetsPerWeek: number;
    targetSetsPerMonth: number;
    exercises: {
      name: string;
      notes: string | null;
      variants: { name: string; notes: string | null }[];
    }[];
  }[];
}

export interface PlanExportFile {
  schemaVersion: number;
  type: 'muscle_manager_workout_plan';
  exportedAt: string;
  planName: string;
  entries: SharedPlanEntryRow[];
}

function sanitizeFileName(name: string): string {
  return name.trim().replace(/[/\\:*?"<>|]+/g, '_').replace(/\s+/g, '_') || 'export';
}

// ─── Export: nhóm cơ + bài tập (chỉ xuất, không nhập lại) ──────────────────────

export async function exportMuscleGroupsAndExercises(): Promise<string> {
  const [groups, allExercises] = await Promise.all([
    getMuscleGroups() as Promise<any[]>,
    getExercises() as Promise<any[]>,
  ]);

  const exercisesByGroup = new Map<string, any[]>();
  for (const ex of allExercises) {
    const arr = exercisesByGroup.get(ex.muscle_group_id) || [];
    arr.push(ex);
    exercisesByGroup.set(ex.muscle_group_id, arr);
  }

  const file: MuscleGroupsExportFile = {
    schemaVersion: SCHEMA_VERSION,
    type: 'muscle_manager_muscle_groups',
    exportedAt: new Date().toISOString(),
    muscleGroups: groups.map((group) => {
      const groupExercises = exercisesByGroup.get(group.id) || [];
      const { topLevel, variantsByParent } = groupExercisesByParent(groupExercises);
      return {
        name: group.name,
        category: group.category ?? null,
        color: group.color,
        targetSetsPerWeek: group.target_sets_per_week,
        targetSetsPerMonth: group.target_sets_per_month,
        exercises: topLevel.map((ex) => ({
          name: ex.name,
          notes: ex.notes ?? null,
          variants: (variantsByParent.get(ex.id) || []).map((v) => ({
            name: v.name,
            notes: v.notes ?? null,
          })),
        })),
      };
    }),
  };

  return JSON.stringify(file, null, 2);
}

// ─── Export: 1 kế hoạch cụ thể ──────────────────────────────────────────────────

export async function exportWorkoutPlan(
  userKey: string | null,
  planId: string,
  planName: string,
): Promise<string> {
  const [entries, groups, allExercises] = await Promise.all([
    getWeeklyPlanEntries(userKey, planId),
    getMuscleGroups() as Promise<any[]>,
    getExercises() as Promise<any[]>,
  ]);

  const groupById = new Map(groups.map((g) => [g.id, g]));
  const exerciseById = new Map(allExercises.map((e) => [e.id, e]));

  const rows: SharedPlanEntryRow[] = entries.map((entry) => {
    const group = groupById.get(entry.muscleGroupId);
    const exercise = entry.exerciseId ? exerciseById.get(entry.exerciseId) : null;
    const parentExercise = exercise?.parent_exercise_id
      ? exerciseById.get(exercise.parent_exercise_id)
      : null;

    return {
      plan_name: planName,
      day_key: entry.dayKey,
      muscle_group_name: group?.name ?? 'Nhóm cơ đã xoá',
      muscle_group_category: group?.category ?? null,
      muscle_group_color: group?.color ?? null,
      sets: entry.sets,
      note: entry.note,
      exercise_name: exercise?.name ?? null,
      exercise_notes: exercise?.notes ?? null,
      exercise_image_uri: exercise?.image_uri ?? null,
      parent_exercise_name: parentExercise?.name ?? null,
      owner_display_name: null,
    };
  });

  const file: PlanExportFile = {
    schemaVersion: SCHEMA_VERSION,
    type: 'muscle_manager_workout_plan',
    exportedAt: new Date().toISOString(),
    planName,
    entries: rows,
  };

  return JSON.stringify(file, null, 2);
}

// ─── Import: đọc + validate file kế hoạch ──────────────────────────────────────

export function parsePlanExportFile(json: string): { planName: string; entries: SharedPlanEntryRow[] } {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('File không đúng định dạng JSON.');
  }

  if (!data || data.type !== 'muscle_manager_workout_plan') {
    throw new Error('File không phải kế hoạch tập được xuất từ Muscle Manager.');
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`File thuộc phiên bản dữ liệu ${data.schemaVersion}, ứng dụng hiện chỉ hỗ trợ phiên bản ${SCHEMA_VERSION}.`);
  }
  if (!Array.isArray(data.entries) || data.entries.length === 0) {
    throw new Error('File không chứa dữ liệu kế hoạch nào.');
  }

  return {
    planName: typeof data.planName === 'string' && data.planName.trim() ? data.planName : 'Kế hoạch đã nhập',
    entries: data.entries as SharedPlanEntryRow[],
  };
}

// ─── File I/O: lưu + chia sẻ, chọn + đọc ────────────────────────────────────────

export async function saveAndShareJson(json: string, fileName: string): Promise<void> {
  const safeName = sanitizeFileName(fileName);
  const finalName = safeName.endsWith('.json') ? safeName : `${safeName}.json`;

  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  const fileUri = `${FileSystem.documentDirectory}${finalName}`;
  await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Thiết bị không hỗ trợ chia sẻ file. File đã được lưu tại: ' + fileUri);
  }
  await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Xuất dữ liệu Muscle Manager' });
}

export async function pickAndReadJsonFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const uri = result.assets[0].uri;

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Không thể đọc file đã chọn.');
    return response.text();
  }

  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
}
