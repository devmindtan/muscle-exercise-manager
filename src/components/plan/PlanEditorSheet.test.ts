import { resolveMuscleEntries, splitSetsEvenly } from './PlanEditorSheet';
import { WeeklyPlanEntry } from '@/src/services/weeklyPlanService';

describe('splitSetsEvenly', () => {
  it('splits evenly when total divides cleanly', () => {
    expect(splitSetsEvenly(9, 3)).toEqual([3, 3, 3]);
  });

  it('gives the remainder to the first exercises', () => {
    expect(splitSetsEvenly(10, 3)).toEqual([4, 3, 3]);
  });

  it('can produce zeros when total is smaller than count (the bug PlanEditorSheet now validates against)', () => {
    expect(splitSetsEvenly(2, 4)).toEqual([1, 1, 0, 0]);
  });

  it('returns an empty array for a non-positive count', () => {
    expect(splitSetsEvenly(10, 0)).toEqual([]);
  });
});

function makeExistingEntry(overrides: Partial<WeeklyPlanEntry>): WeeklyPlanEntry {
  return {
    id: 'existing-id',
    dayKey: 'mon',
    muscleGroupId: 'group-1',
    exerciseId: null,
    sets: 5,
    reps: null,
    sortOrder: null,
    note: null,
    planId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('resolveMuscleEntries', () => {
  it('creates a single entry with no exerciseId when none are chosen', () => {
    const { toUpsert, toDeleteIds } = resolveMuscleEntries('mon', 'group-1', 10, '', [], []);
    expect(toUpsert).toEqual([
      { id: undefined, dayKey: 'mon', muscleGroupId: 'group-1', exerciseId: null, sets: 10, reps: null, sortOrder: null, note: '' },
    ]);
    expect(toDeleteIds).toEqual([]);
  });

  it('keeps the existing id/sortOrder when an exercise entry already exists', () => {
    const existing = makeExistingEntry({ id: 'row-1', exerciseId: 'ex-1', sortOrder: 4 });
    const { toUpsert } = resolveMuscleEntries('mon', 'group-1', 10, '', ['ex-1'], [existing]);
    expect(toUpsert[0]).toMatchObject({ id: 'row-1', exerciseId: 'ex-1', sortOrder: 4 });
  });

  it('deletes entries for exercises that were unselected', () => {
    const existing = makeExistingEntry({ id: 'row-1', exerciseId: 'ex-1' });
    const { toDeleteIds } = resolveMuscleEntries('mon', 'group-1', 10, '', ['ex-2'], [existing]);
    expect(toDeleteIds).toEqual(['row-1']);
  });

  it('uses per-exercise sets/reps overrides when provided, falling back to the shared value otherwise', () => {
    const { toUpsert } = resolveMuscleEntries(
      'mon',
      'group-1',
      10,
      '',
      ['ex-1', 'ex-2'],
      [],
      { 'ex-1': 6 },
      { 'ex-1': 8 },
    );
    const ex1 = toUpsert.find((e) => e.exerciseId === 'ex-1');
    const ex2 = toUpsert.find((e) => e.exerciseId === 'ex-2');
    expect(ex1).toMatchObject({ sets: 6, reps: 8 });
    expect(ex2).toMatchObject({ sets: 10, reps: null });
  });
});
