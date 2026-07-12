import { sortWeeklyPlanEntriesForFocus, WeeklyPlanEntry } from './weeklyPlanService';

function makeEntry(overrides: Partial<WeeklyPlanEntry>): WeeklyPlanEntry {
  return {
    id: 'id',
    dayKey: 'mon',
    muscleGroupId: 'group-1',
    exerciseId: null,
    sets: 3,
    reps: null,
    sortOrder: null,
    note: null,
    planId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('sortWeeklyPlanEntriesForFocus', () => {
  it('orders by sortOrder ascending, flat across muscle groups', () => {
    const entries = [
      makeEntry({ id: 'b', muscleGroupId: 'legs', sortOrder: 1 }),
      makeEntry({ id: 'a', muscleGroupId: 'chest', sortOrder: 0 }),
      makeEntry({ id: 'c', muscleGroupId: 'chest', sortOrder: 2 }),
    ];
    const sorted = sortWeeklyPlanEntriesForFocus(entries);
    expect(sorted.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('pushes entries with no sortOrder to the end', () => {
    const entries = [
      makeEntry({ id: 'unordered', sortOrder: null, createdAt: '2026-01-01T00:00:00.000Z' }),
      makeEntry({ id: 'ordered', sortOrder: 0 }),
    ];
    const sorted = sortWeeklyPlanEntriesForFocus(entries);
    expect(sorted.map((e) => e.id)).toEqual(['ordered', 'unordered']);
  });

  it('falls back to createdAt when neither entry has a sortOrder', () => {
    const entries = [
      makeEntry({ id: 'later', sortOrder: null, createdAt: '2026-01-02T00:00:00.000Z' }),
      makeEntry({ id: 'earlier', sortOrder: null, createdAt: '2026-01-01T00:00:00.000Z' }),
    ];
    const sorted = sortWeeklyPlanEntriesForFocus(entries);
    expect(sorted.map((e) => e.id)).toEqual(['earlier', 'later']);
  });

  it('does not mutate the input array', () => {
    const entries = [makeEntry({ id: 'b', sortOrder: 1 }), makeEntry({ id: 'a', sortOrder: 0 })];
    const original = [...entries];
    sortWeeklyPlanEntriesForFocus(entries);
    expect(entries).toEqual(original);
  });
});
