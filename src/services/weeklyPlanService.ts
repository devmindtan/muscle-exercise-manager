import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as LocalDB from '@/src/db/localDB';

export const WEEK_DAYS = [
  { key: 'mon', label: 'Thứ 2', order: 1 },
  { key: 'tue', label: 'Thứ 3', order: 2 },
  { key: 'wed', label: 'Thứ 4', order: 3 },
  { key: 'thu', label: 'Thứ 5', order: 4 },
  { key: 'fri', label: 'Thứ 6', order: 5 },
  { key: 'sat', label: 'Thứ 7', order: 6 },
  { key: 'sun', label: 'Chủ nhật', order: 7 },
] as const;

export type WeekDayKey = (typeof WEEK_DAYS)[number]['key'];

export type WeeklyPlanEntry = {
  id: string;
  dayKey: WeekDayKey;
  muscleGroupId: string;
  sets: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WeeklyPlanEntryInput = {
  id?: string;
  dayKey: WeekDayKey;
  muscleGroupId: string;
  sets: number;
  note?: string | null;
};

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getWebStorageKey(userId?: string | null) {
  return `weekly_plan_entries_v1_${userId || 'guest'}`;
}

function normalizeEntries(value: unknown): WeeklyPlanEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const entry = item as Partial<WeeklyPlanEntry>;
      if (!entry.id || !entry.dayKey || !entry.muscleGroupId) return null;

      const numericSets = Number(entry.sets);
      if (!Number.isFinite(numericSets) || numericSets <= 0) return null;

      return {
        id: String(entry.id),
        dayKey: entry.dayKey as WeekDayKey,
        muscleGroupId: String(entry.muscleGroupId),
        sets: Math.round(numericSets),
        note: entry.note ? String(entry.note) : null,
        createdAt: entry.createdAt || new Date().toISOString(),
        updatedAt: entry.updatedAt || new Date().toISOString(),
      };
    })
    .filter((entry): entry is WeeklyPlanEntry => Boolean(entry));
}

async function getWebWeeklyPlanEntries(userId?: string | null) {
  const raw = await AsyncStorage.getItem(getWebStorageKey(userId));
  if (!raw) return [];

  try {
    return normalizeEntries(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function saveWebWeeklyPlanEntries(
  entries: WeeklyPlanEntry[],
  userId?: string | null,
) {
  await AsyncStorage.setItem(
    getWebStorageKey(userId),
    JSON.stringify(normalizeEntries(entries)),
  );
}

export async function getWeeklyPlanEntries(userId?: string | null) {
  if (Platform.OS === 'web') {
    return getWebWeeklyPlanEntries(userId);
  }

  const rows = await LocalDB.getWeeklyPlanEntries();
  return rows.map((row) => ({
    id: row.id,
    dayKey: row.day_key as WeekDayKey,
    muscleGroupId: row.muscle_group_id,
    sets: Number(row.sets) || 0,
    note: row.note || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function upsertWeeklyPlanEntry(
  input: WeeklyPlanEntryInput,
  userId?: string | null,
) {
  const now = new Date().toISOString();
  const nextEntry: WeeklyPlanEntry = {
    id: input.id || generateId(),
    dayKey: input.dayKey,
    muscleGroupId: input.muscleGroupId,
    sets: Math.max(1, Math.round(input.sets)),
    note: input.note?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };

  if (Platform.OS === 'web') {
    const entries = await getWebWeeklyPlanEntries(userId);
    const existingIndex = entries.findIndex((entry) => entry.id === nextEntry.id);

    if (existingIndex >= 0) {
      const existing = entries[existingIndex];
      entries[existingIndex] = {
        ...nextEntry,
        createdAt: existing.createdAt,
        updatedAt: now,
      };
    } else {
      entries.push(nextEntry);
    }

    await saveWebWeeklyPlanEntries(entries, userId);
    return entries;
  }

  const existingEntries = await getWeeklyPlanEntries(userId);
  const existing = existingEntries.find((entry) => entry.id === nextEntry.id);

  await LocalDB.upsertWeeklyPlanEntry({
    id: nextEntry.id,
    day_key: nextEntry.dayKey,
    muscle_group_id: nextEntry.muscleGroupId,
    sets: nextEntry.sets,
    note: nextEntry.note,
    created_at: existing?.createdAt || now,
    updated_at: now,
    dirty: 1,
    deleted: 0,
  });

  return getWeeklyPlanEntries(userId);
}

export async function upsertWeeklyPlanEntries(
  inputs: WeeklyPlanEntryInput[],
  userId?: string | null,
) {
  if (inputs.length === 0) {
    return getWeeklyPlanEntries(userId);
  }

  const now = new Date().toISOString();
  const nextEntries = inputs.map<WeeklyPlanEntry>((input) => ({
    id: input.id || generateId(),
    dayKey: input.dayKey,
    muscleGroupId: input.muscleGroupId,
    sets: Math.max(1, Math.round(input.sets)),
    note: input.note?.trim() || null,
    createdAt: now,
    updatedAt: now,
  }));

  if (Platform.OS === 'web') {
    const entries = await getWebWeeklyPlanEntries(userId);

    for (const nextEntry of nextEntries) {
      const existingIndex = entries.findIndex((entry) => entry.id === nextEntry.id);

      if (existingIndex >= 0) {
        const existing = entries[existingIndex];
        entries[existingIndex] = {
          ...nextEntry,
          createdAt: existing.createdAt,
          updatedAt: now,
        };
      } else {
        entries.push(nextEntry);
      }
    }

    await saveWebWeeklyPlanEntries(entries, userId);
    return entries;
  }

  const existingEntries = await getWeeklyPlanEntries(userId);
  const existingById = new Map(existingEntries.map((entry) => [entry.id, entry]));

  for (const nextEntry of nextEntries) {
    const existing = existingById.get(nextEntry.id);

    await LocalDB.upsertWeeklyPlanEntry({
      id: nextEntry.id,
      day_key: nextEntry.dayKey,
      muscle_group_id: nextEntry.muscleGroupId,
      sets: nextEntry.sets,
      note: nextEntry.note,
      created_at: existing?.createdAt || now,
      updated_at: now,
      dirty: 1,
      deleted: 0,
    });
  }

  return getWeeklyPlanEntries(userId);
}

export async function deleteWeeklyPlanEntry(id: string, userId?: string | null) {
  if (Platform.OS === 'web') {
    const entries = await getWebWeeklyPlanEntries(userId);
    const filtered = entries.filter((entry) => entry.id !== id);
    await saveWebWeeklyPlanEntries(filtered, userId);
    return filtered;
  }

  await LocalDB.deleteWeeklyPlanEntry(id);
  return getWeeklyPlanEntries(userId);
}
