interface ExerciseGroupable {
  id: string;
  parent_exercise_id: string | null;
}

// Nhóm bài tập theo bài gốc — biến thể (parent_exercise_id trỏ tới 1 bài
// trong cùng danh sách) được lồng dưới bài gốc; biến thể mồ côi (bài gốc
// không có trong danh sách, ví dụ bị lọc sang tab/nhóm khác) vẫn hiện như
// bài độc lập. Dùng chung cho MuscleDetailScreen, ExercisePickerSheet,
// planExportImportService — cùng 1 công thức, khác kiểu dữ liệu đầu vào.
export function groupExercisesByParent<T extends ExerciseGroupable>(
  list: T[],
): { topLevel: T[]; variantsByParent: Map<string, T[]> } {
  const idsInList = new Set(list.map((e) => e.id));
  const variantsByParent = new Map<string, T[]>();
  const topLevel: T[] = [];
  for (const ex of list) {
    if (ex.parent_exercise_id && idsInList.has(ex.parent_exercise_id)) {
      const arr = variantsByParent.get(ex.parent_exercise_id) || [];
      arr.push(ex);
      variantsByParent.set(ex.parent_exercise_id, arr);
    } else {
      topLevel.push(ex);
    }
  }
  return { topLevel, variantsByParent };
}
