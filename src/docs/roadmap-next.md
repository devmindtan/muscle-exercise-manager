# Kế hoạch cho các đợt tiếp theo

Tài liệu này tổng hợp: (1) việc đã quyết định làm/không làm ngay trong đợt vừa rồi, (2) 1 khoản kỹ thuật lớn cố tình **chưa** đụng vào vì rủi ro cao, và (3) danh sách tính năng đề xuất cho tương lai — để phiên làm việc sau có thể bắt đầu ngay từ đây thay vì dò lại từ đầu.

---

## 1) Đã làm trong đợt này

- **Test tự động** — dự án trước đó **0 test, không có script `test`**. Đã thêm `jest-expo` (preset test chính thức của Expo) + `npm test` chạy được. 16 test, 3 file, toàn bộ là hàm thuần logic (không cần dựng UI):
  - `src/lib/exerciseGrouping.test.ts` — `groupExercisesByParent`.
  - `src/services/weeklyPlanService.test.ts` — `sortWeeklyPlanEntriesForFocus`.
  - `src/components/plan/PlanEditorSheet.test.ts` — `splitSetsEvenly`, `resolveMuscleEntries` (2 hàm này đổi từ private sang `export` để test được, không đổi hành vi).
  - Chọn nhóm này trước vì chúng là chỗ dễ vỡ nhất khi sửa code sau này (chia sets, validate, sắp xếp) mà lại kiểm chứng được mà không cần mock cả app.
  - **Lưu ý khi viết thêm test**: `jest.config` nằm trong `package.json` (key `"jest"`). Bất kỳ file nào import (dù gián tiếp) `src/lib/supabase.ts` hoặc `@react-native-async-storage/async-storage` cần 2 thứ đã cấu hình sẵn — `jest.setup.js` (set `EXPO_PUBLIC_SUPABASE_URL`/`KEY` giả để `supabase.ts` không throw lúc import) và `moduleNameMapper` trỏ AsyncStorage sang mock chính thức của thư viện — không cần thêm gì nếu chỉ test hàm thuần, chỉ cần biết lý do nếu gặp lỗi tương tự.
- **`syncNutritionToCloud`** — xoá hẳn (theo yêu cầu "tuỳ quyết định tốt nhất"). Đây là script nạp 1 lần (migrate dữ liệu dinh dưỡng local lên cloud), không phải luồng đồng bộ định kỳ thật (luồng thật đã chạy qua `syncService.ts` như mọi bảng khác). Không ai gọi, để lại chỉ gây rối khi đọc code.
- **Đồng bộ vòng tròn tiến độ** Nhóm cơ ↔ Dinh dưỡng — xem mục "Đã làm" ở phiên trước, không lặp lại ở đây.

## 2) Cố tình CHƯA làm — hợp nhất `dirty/deleted` vs `sync_status/deleted_at`

### Vấn đề
Toàn bộ 16 bảng local đang dùng 2 quy ước đánh dấu "cần đồng bộ" / "đã xoá mềm" khác nhau:

| Quy ước | Bảng | Cách đánh dấu cần push | Cách đánh dấu đã xoá |
|---|---|---|---|
| Cũ (7 bảng) | `muscle_groups`, `exercises`, `exercise_secondary_muscles`, `workout_logs`, `body_measurements`, `muscle_goals`, `weekly_plan_entries` | `dirty INTEGER` (0/1), **chỉ có ở local**, Postgres không có cột này | `deleted INTEGER` ở local, nhưng Postgres dùng `deleted_at timestamptz` — 2 tên/2 kiểu khác nhau cho cùng 1 khái niệm |
| Mới (9 bảng) | `workout_plans`, `cardio_logs`, `profiles`, `friendships`, `plan_shares`, `nutrition_*` (5 bảng) | `sync_status TEXT` ('pending'/'synced'), có ở **cả local lẫn Postgres** | `deleted_at` — cùng tên/cùng kiểu ở cả 2 phía |
| 
Quy ước MỚI nhất quán hơn (tên cột khớp giữa local/cloud, dễ mở rộng thêm trạng thái sau này nếu cần — ví dụ 'failed', 'conflict'). Quy ước CŨ có 1 điểm bất đối xứng dễ gây nhầm: `deleted` (local, int) ≠ `deleted_at` (Postgres, timestamp) — 2 cái tên khác nhau cho cùng 1 thứ.

### Vì sao chưa làm ngay
Đây là thay đổi đụng vào **lõi cơ chế đồng bộ** của 7 bảng đang có dữ liệu thật của người dùng trên Supabase. Không có cách nào tôi tự kiểm chứng đầu-cuối (không chạy được app, không test được sync 2 chiều với dữ liệu thật) — nếu sai ở bước migrate cột hoặc ở vòng lặp push/pull, hậu quả là mất đồng bộ hoặc mất dữ liệu thật, mà theo yêu cầu của bạn thì sẽ không có ai bấm thử thủ công để phát hiện kịp thời. Rủi ro này không tương xứng với lợi ích (dọn code cho dễ đọc hơn, không sửa lỗi thật nào đang xảy ra).

### Cách làm đề xuất khi thực hiện (an toàn, làm dần từng bảng)
1. Chọn **1 bảng** làm thí điểm trước (đề xuất `weekly_plan_entries` — đã quen thuộc nhất từ đợt Focus Mode).
2. Thêm cột `sync_status`/`deleted_at` **cộng thêm** (nullable, không đụng cột cũ) — đúng triết lý "additive only" mà chính dự án này đã dùng ổn định ở 2 migration gần nhất (`20260709120000`, `20260710120000`).
3. Cho `upsertX()` ghi **cả 2** quy ước song song 1 thời gian (dirty/deleted vẫn chạy như cũ, sync_status/deleted_at ghi thêm).
4. Xác nhận ổn định qua vài lần đồng bộ thật trên thiết bị thật, rồi mới chuyển vòng lặp push (`getDirtyX()`) sang lọc theo `sync_status`.
5. Chỉ xoá cột cũ (`dirty`, `deleted`) ở 1 migration dọn dẹp riêng, SAU KHI chắc chắn bảng đó chạy ổn với quy ước mới.
6. Lặp lại cho 6 bảng còn lại, mỗi bảng 1 đợt riêng — **không gộp cả 7 bảng vào 1 lần sửa**.

Việc cần làm khi bắt đầu: liệt kê chính xác từng hàm trong `syncService.ts`/`localDB.ts` đang đọc/ghi `dirty`/`deleted` cho bảng thí điểm, viết plan riêng cho đúng 1 bảng đó trước khi đụng vào bảng thứ 2.

## 3) Đề xuất tính năng cho tương lai

Xếp theo mức độ tự nhiên/rủi ro thấp trước:

1. **Thông báo đẩy cho bộ đếm giờ Tập trung** — chính README của app đã tự ghi nhận giới hạn: "Focus Mode chỉ đếm ngược khi app còn chạy nền, không tiếp tục khi app bị kill hẳn." Dùng `expo-notifications` lên lịch 1 thông báo local đúng lúc hết giờ nghỉ/chuẩn bị (huỷ nếu người dùng bỏ qua/tạm dừng) — cho phép khoá màn hình/rời app giữa các set mà không mất dấu đếm ngược. Tự nhiên nối tiếp tính năng Tập trung đã có.
2. **Biểu đồ tiến bộ theo từng bài tập cụ thể** (progressive overload) — `ExerciseDetailScreen` hiện chỉ có danh sách lịch sử dạng chữ. App đã có sẵn hạ tầng vẽ biểu đồ (area chart + trend line ở Dashboard, chart Cardio) — thêm 1 biểu đồ tạ/reps theo thời gian cho riêng 1 bài tập là tái dùng đúng pattern đã có, giá trị cao cho người tập nghiêm túc.
3. **Chuỗi ngày tập liên tục (streak)** — app đã có `ActivityHeatmap` (từ tính năng Cộng đồng). Tính thêm "đang tập liên tục X ngày" hiển thị ở Dashboard là phép tính nhỏ dựa trên dữ liệu log đã có sẵn, không cần bảng mới.
4. **Dự đoán ngày đạt mục tiêu cân nặng/số đo** — Body Metrics đã có goal tracking + tính trend-line sẵn cho biểu đồ. Ngoại suy trend hiện tại để ước tính "khoảng ngày X sẽ đạt mục tiêu" là tận dụng đúng phép tính đã viết, không cần thêm gì mới về hạ tầng.
5. **Đánh dấu chủ động "ngày nghỉ có chủ đích"** — hiện tại 1 ngày không có lịch chỉ hiện "Nghỉ ngơi" chung chung, không phân biệt được "quên lập kế hoạch" và "chủ động nghỉ". Thêm 1 cờ nhỏ có thể giúp số liệu tuần chính xác hơn khi xem lại.
6. *(Cân nhắc kỹ hơn, tính nhạy cảm cao hơn)* **Bảng xếp hạng bạn bè** (vd. tổng sets tuần) — tận dụng dữ liệu Cộng đồng đã có, nhưng cần suy nghĩ thêm về quyền riêng tư/tâm lý so sánh trước khi làm, không nên vội.

## 4) Thứ tự đề xuất khi bắt tay vào

1. Hoàn thiện bộ test (đã bắt đầu đợt này) — mở rộng dần mỗi khi sửa thêm 1 hàm logic quan trọng, không cần làm hết 1 lần.
2. Chọn 1 trong các tính năng mục 3 theo đúng nhu cầu thực tế lúc đó (không cần theo đúng thứ tự liệt kê — thứ tự chỉ phản ánh độ tự nhiên/rủi ro thấp, không phải độ ưu tiên bắt buộc).
3. Hợp nhất `dirty/deleted` — chỉ bắt đầu khi có thời gian làm cẩn thận từng bảng một như mục 2, không làm xen kẽ với việc khác.
