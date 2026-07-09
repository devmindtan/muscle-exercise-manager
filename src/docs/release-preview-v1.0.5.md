# Muscle Exercise Manager - Preview Release v1.0.5

Ứng dụng workout tracking offline-first, tối ưu cho ghi log nhanh, lưu local ổn định và tự động đồng bộ cloud khi có mạng. Hỗ trợ Google Sign-In và chế độ khách.

## Phạm vi bản phát hành

- Từ commit sau bản release v1.0.4 (`2bb0441`) đến hết ngày 09/07/2026 (`ee8a2f9`).
- Tổng cộng 26 commit — trọng tâm là tính năng **"Tập trung" (Focus Mode)** chạy buổi tập thực tế có đếm ngược nghỉ/chuẩn bị, cùng với đồng bộ hoá hiển thị Compound/Isolation và 1 đợt rà soát bảo mật/hiệu năng/data-integrity sâu trên toàn bộ codebase.

---

## Tính năng & Cải tiến mới trong v1.0.5

### 1) "Tập trung" (Focus Mode) — tính năng hoàn toàn mới
- Màn hình riêng (full-screen modal) chạy qua các bài tập trong kế hoạch của 1 ngày theo đúng thứ tự, từng set một.
- Sau mỗi set: màn ghi nhanh riêng (không phải tab "Ghi lại") để nhập reps/tạ/ghi chú, mỗi set lưu thành 1 dòng log riêng.
- Tự động đếm ngược thời gian nghỉ (giữa các set cùng bài) hoặc thời gian chuẩn bị (khi chuyển bài), cấu hình mặc định theo từng bài tập, chỉnh lại được ngay tại màn đếm ngược (+15s/-15s, tạm dừng, bỏ qua) mà không ghi đè mặc định.
- Báo hết giờ bằng rung (haptics) + âm thanh.
- Vẫn chạy được cả khi ngày đó chỉ lập kế hoạch theo nhóm cơ (chưa chọn bài tập cụ thể) — cho chọn bài ngay tại chỗ hoặc bỏ qua không ghi.
- Thêm số reps mục tiêu cho từng bài tập cụ thể trong kế hoạch tuần, cấu hình thời gian nghỉ/chuẩn bị mặc định ngay trong form thêm/sửa bài tập.

### 2) Xem nhanh chi tiết bài tập & Kỷ lục cá nhân (PR)
- Modal xem nhanh (ảnh lớn, tên, loại Compound/Isolation, nhóm cơ phụ, ghi chú) mở từ sheet chọn bài tập khi lập kế hoạch, từ màn nghỉ/chuẩn bị trong Tập trung, và từ chính trang kế hoạch tuần.
- Hiện kỷ lục cá nhân (reps/kg cao nhất từng ghi) ngay khi chọn bài tập ở tab "Ghi lại" và trong Tập trung.

### 3) Đồng bộ hiển thị Compound/Isolation trên toàn app
- Badge phân loại Compound/Isolation hiện nhất quán ở màn chi tiết nhóm cơ, tab "Ghi lại" và trang kế hoạch tuần (trước đó chỉ trang kế hoạch hiện đúng).
- Bỏ cơ chế thu gọn phải bấm mới xem được biến thể bài tập — biến thể hiện ngay, thụt lề trực quan.
- Hợp nhất 2 form sửa bài tập (mở từ danh sách nhóm cơ và từ trang chi tiết bài tập) để có cùng bộ trường như nhau.

### 4) Redesign giao diện Kế hoạch tuần
- Gộp nhiều bài tập cùng 1 nhóm cơ trong 1 ngày vào chung 1 thẻ thay vì nhiều dòng rời rạc.
- Giao diện "bảng điểm phòng gym" (nền mực đen, điểm nhấn chalk-lime), bỏ emoji, gọn lại phần "ngoài kế hoạch".

### 5) Xuất / Nhập dữ liệu JSON
- Xuất kế hoạch tập hoặc toàn bộ thư viện nhóm cơ + bài tập ra file JSON, nhập lại kế hoạch đã chỉnh sửa/cải thiện.

### 6) Bảo mật, chất lượng code & hiệu năng (đợt rà soát sâu)
- Dùng CSPRNG (`expo-crypto`) thay `Math.random()` cho `generateUUID`.
- Loại bỏ toàn bộ ép kiểu `as any` còn sót trong `repository.ts`, sửa kiểu dữ liệu cũ của `body_measurements`.
- Xác thực và sửa: chặn tạo kế hoạch hàng loạt sinh ra dòng có `sets = 0` (vi phạm ràng buộc `CHECK (sets > 0)` trên Postgres, từng làm gãy cả lượt đồng bộ); thêm guard chống `load()` chạy chồng ở Dashboard khi mới mở app.
- Bọc `useMemo` cho phần tính trend-line + dựng SVG path ở biểu đồ lịch sử (Dashboard) và biểu đồ Cardio — trước đây tính lại mỗi lần chạm chọn 1 điểm khác trên biểu đồ dù dữ liệu không đổi.
- Rà soát và xác nhận: cơ chế xoá bài tập/nhóm cơ đã đúng chuẩn soft-delete từ trước; không có lỗ hổng SQL injection; tính năng tự tính calo dinh dưỡng đã có sẵn cơ chế ghi đè thủ công — không cần sửa thêm ở các điểm này.

### 7) Build & Dependencies
- Nâng cấp `react-native-reanimated` 4.1.2→4.3.2, `react-native-worklets` 0.5.1→0.8.3.
- Loại trừ `android/`, `ios/`, `tmp/` khỏi archive build local của EAS.

### 8) Công cụ phát triển (không ảnh hưởng người dùng cuối)
- Thêm hook tự động nhắc dùng skill thiết kế UI (`ui-ux-pro-max`/`design`) trước khi sửa file giao diện `.tsx`/`.jsx`, cùng cơ chế với hook bắt buộc dùng CodeGraph/Graphify đã có.

---

## Tính năng đã có từ trước

- Đăng nhập Google hoặc dùng thử với chế độ khách.
- Quản lý nhóm cơ, bài tập, log tập luyện (thêm/sửa/xóa, soft delete), log Cardio.
- Weekly Plan với theo dõi tiến độ sets thực tế so với mục tiêu.
- Dinh dưỡng: log thức ăn theo ngày, TDEE calculator tích hợp InBody.
- Body Metrics với goal tracking, biểu đồ lịch sử dạng area chart + trend line.
- Chia sẻ & Cộng đồng: nhiều kế hoạch tập, chia sẻ công khai/bạn bè, kết bạn, activity heatmap.
- Biến thể bài tập (bài gốc/bài biến thể).
- Lưu dữ liệu local bằng SQLite, tự động đồng bộ cloud qua Supabase, hoạt động offline.
- Upload ảnh minh họa và tự đồng bộ khi online.

## Giới hạn và lưu ý

- Chưa có test tự động, thông báo đẩy hệ thống (Focus Mode chỉ đếm ngược khi app còn chạy nền, không tiếp tục khi app bị kill hẳn).
- `expo-audio` và `expo-keep-awake` (dùng cho Tập trung) là dependency native mới — cần rebuild app native (dev client/EAS build) mới dùng được, không chạy được trên bản build cũ.
- Thứ tự bài tập trong Tập trung theo thứ tự chọn khi lập kế hoạch, chưa có UI kéo-thả sắp xếp lại thủ công.

---

## Danh sách commit theo nhóm tính năng

**Tập trung (Focus Mode) & xem nhanh bài tập (6 commit):** `946763e` `8c6d8a6` `c4f35e5` `49fa902` `137dca5` `8da51ce`

**Đồng bộ Compound/Isolation & redesign kế hoạch tuần (5 commit):** `9d19013` `895d613` `b485be1` `bd3a3dd` `312a1ea`

**UI kế hoạch tuần (1 commit):** `8978733`

**Xuất/Nhập JSON (1 commit):** `1a7c59c`

**Bảo mật, chất lượng code & data-integrity (5 commit):** `c8118b2` `1463530` `aec6bb5` `ee8a2f9` `d9a0fe0`

**Build & dependencies (3 commit):** `3aee1bd` `af41e53` `2a0e267`

**Công cụ phát triển (2 commit):** `35734a8` `3807fac`

**Tài liệu (đóng gói v1.0.4) (3 commit):** `ab6e711` `4356b90` `25f9855`
