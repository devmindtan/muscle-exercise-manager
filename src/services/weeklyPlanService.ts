import AsyncStorage from '@react-native-async-storage/async-storage';

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

function getStorageKey(userId?: string | null) {
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

export async function getWeeklyPlanEntries(userId?: string | null) {
  const raw = await AsyncStorage.getItem(getStorageKey(userId));
  if (!raw) return [];

  try {
    return normalizeEntries(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function saveWeeklyPlanEntries(
  entries: WeeklyPlanEntry[],
  userId?: string | null,
) {
  await AsyncStorage.setItem(
    getStorageKey(userId),
    JSON.stringify(normalizeEntries(entries)),
  );
}

export async function upsertWeeklyPlanEntry(
  input: WeeklyPlanEntryInput,
  userId?: string | null,
) {
  const now = new Date().toISOString();
  const entries = await getWeeklyPlanEntries(userId);

  const nextEntry: WeeklyPlanEntry = {
    id: input.id || generateId(),
    dayKey: input.dayKey,
    muscleGroupId: input.muscleGroupId,
    sets: Math.max(1, Math.round(input.sets)),
    note: input.note?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };

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

  await saveWeeklyPlanEntries(entries, userId);
  return entries;
}

export async function deleteWeeklyPlanEntry(id: string, userId?: string | null) {
  const entries = await getWeeklyPlanEntries(userId);
  const filtered = entries.filter((entry) => entry.id !== id);
  await saveWeeklyPlanEntries(filtered, userId);
  return filtered;
}
