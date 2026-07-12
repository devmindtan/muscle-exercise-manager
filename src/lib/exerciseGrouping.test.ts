import { groupExercisesByParent } from './exerciseGrouping';

describe('groupExercisesByParent', () => {
  it('puts exercises with no parent in topLevel', () => {
    const list = [
      { id: 'a', parent_exercise_id: null },
      { id: 'b', parent_exercise_id: null },
    ];
    const { topLevel, variantsByParent } = groupExercisesByParent(list);
    expect(topLevel.map((e) => e.id)).toEqual(['a', 'b']);
    expect(variantsByParent.size).toBe(0);
  });

  it('nests a variant under its parent when the parent is in the same list', () => {
    const list = [
      { id: 'bench', parent_exercise_id: null },
      { id: 'incline-bench', parent_exercise_id: 'bench' },
    ];
    const { topLevel, variantsByParent } = groupExercisesByParent(list);
    expect(topLevel.map((e) => e.id)).toEqual(['bench']);
    expect(variantsByParent.get('bench')?.map((e) => e.id)).toEqual(['incline-bench']);
  });

  it('treats an orphaned variant (parent not in the list) as top-level', () => {
    const list = [{ id: 'incline-bench', parent_exercise_id: 'bench-not-in-list' }];
    const { topLevel, variantsByParent } = groupExercisesByParent(list);
    expect(topLevel.map((e) => e.id)).toEqual(['incline-bench']);
    expect(variantsByParent.size).toBe(0);
  });

  it('groups multiple variants under the same parent', () => {
    const list = [
      { id: 'bench', parent_exercise_id: null },
      { id: 'incline-bench', parent_exercise_id: 'bench' },
      { id: 'decline-bench', parent_exercise_id: 'bench' },
    ];
    const { variantsByParent } = groupExercisesByParent(list);
    expect(variantsByParent.get('bench')?.map((e) => e.id)).toEqual(['incline-bench', 'decline-bench']);
  });
});
