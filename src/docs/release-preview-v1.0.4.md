# Muscle Exercise Manager - Preview Release v1.0.4

Ứng dụng workout tracking offline-first, tối ưu cho ghi log nhanh, lưu local ổn định và tự động đồng bộ cloud khi có mạng. Hỗ trợ Google Sign-In và chế độ khách.

## Phạm vi bản phát hành
- Từ commit sau bản release v1.0.3 (`70a1ca2`) đến hết ngày 07/07/2026 (`2bb0441`).
- Tổng cộng 49 commit — đây là **bản cập nhật lớn**, gồm 2 mảng tính năng hoàn toàn mới: Dinh dưỡng, Chia sẻ/Cộng đồng kế hoạch tập.
- Các commit từ 08/07/2026 trở đi (Xuất/Nhập dữ liệu JSON, dọn kiểu dữ liệu `as any`, v.v.) chuyển sang bản kế tiếp.

---

## Tính năng & Cải tiến mới trong v1.0.4

### 1) Theo dõi Dinh dưỡng — tính năng hoàn toàn mới
- Tab "Dinh dưỡng" riêng, log lượng thức ăn theo ngày kèm mini calendar và biểu đồ tuần.
- TDEE calculator tích hợp chỉ số InBody, tự tính calo mục tiêu và mục tiêu protein động theo số đo mới nhất.
- Cấu hình nutrient linh hoạt (thêm/ẩn/xoá dưỡng chất theo từng món), auto-calc calo, picker tìm nhanh dưỡng chất, quick-add UX.
- Đồng bộ dữ liệu dinh dưỡng qua pipeline `SyncContext` sẵn có; dọn nhiều lỗi: trùng cấu hình dưỡng chất khi sync, sync pull đè dữ liệu chưa đồng bộ, trùng field ẩn khi bấm "Thêm chất dinh dưỡng", auto-calc calo sai, layout macro grid/summary card.

### 2) Chia sẻ & Cộng đồng kế hoạch tập — tính năng hoàn toàn mới
- Nhiều kế hoạch tập cùng lúc (multi-plan), hồ sơ người dùng kèm quyền riêng tư (công khai / bạn bè / mã bí mật).
- Kết bạn, xem hoạt động bạn bè qua activity heatmap, xem hồ sơ bạn bè.
- Khám phá kế hoạch công khai từ cộng đồng, xem trước đầy đủ bài tập trước khi tải về.
- Biến thể bài tập (bài gốc/bài biến thể): thêm schema + UI, cho phép chọn đúng biến thể muốn tập ở từng ô trong kế hoạch tuần.
- Chọn bài tập cụ thể theo đa lựa chọn, kèm thumbnail, cho từng nhóm cơ trong kế hoạch tuần.

### 3) Điều hướng & UI tổng thể
- Gộp "Kế hoạch" vào tab "Tập luyện", tách "Dinh dưỡng" ra tab riêng; dọn lại `MusclesScreen`.
- Chuẩn hoá icon toàn bộ tab bar (size 20, strokeWidth 1.5), sửa khoảng cách/label lệch không đều.
- Sửa sliding-pill indicator không hiện ở lần mount đầu trong `SegmentedSubTabs`; dùng spinner thay cho chữ "Đang tải..." ở nhiều màn hình.
- Gọn lại thẻ kế hoạch trong tab "Giáo án của tôi"; sửa bàn phím che input ở modal tài khoản/dinh dưỡng.

### 4) Bảo mật, Đồng bộ & Hiệu năng
- Siết lại RLS cho các bảng cũ (`muscle_groups`, `exercises`, `workout_logs`) và sửa lỗ hổng đồng bộ đa thiết bị.
- Thêm index `user_id` còn thiếu, dọn schema drift trên Supabase.
- Sửa Dashboard không tự tải lại dữ liệu "Tuần này" sau lần đồng bộ đầu tiên.

### 5) Công cụ phát triển (không ảnh hưởng người dùng cuối)
- Thêm CodeGraph + Graphify (knowledge graph tra cứu code) và enforce qua hook bắt buộc dùng trước khi grep/đọc file thô, giúp làm việc trên codebase nhanh và tiết kiệm hơn.

---

## Tính năng đã có từ trước
- Đăng nhập Google hoặc dùng thử với chế độ khách.
- Quản lý nhóm cơ, bài tập, log tập luyện (thêm/sửa/xóa, soft delete), log Cardio.
- Body Metrics với goal tracking, biểu đồ lịch sử dạng area chart + trend line.
- Lưu dữ liệu local bằng SQLite, tự động đồng bộ cloud qua Supabase, hoạt động offline.
- Upload ảnh minh họa và tự đồng bộ khi online.

## Giới hạn và lưu ý
- Chưa có test tự động, thông báo đẩy, xuất/nhập dữ liệu.

---

## Danh sách commit theo nhóm tính năng

**Dinh dưỡng (21 commit):** `9106759` `5c15c4d` `4f562e8` `3f204d9` `18e1e40` `5e56ed8` `7169608` `3ae0633` `2d01098` `5910aba` `c7856a9` `1257b4b` `2904c40` `cb3a959` `aaaf48d` `a917175` `96aaa99` `6b81d70` `497c33b` `704b947` `beab5ac`

**Điều hướng & UI tab bar (10 commit):** `1e47652` `5dc2c99` `2c97ede` `d8f84e2` `22d0046` `c487b68` `7603990` `5f2abd4` `cc1c52a` `ad48250`

**Chia sẻ, cộng đồng & biến thể bài tập (10 commit):** `fe00cff` `a45a407` `b43d727` `fa2ac6a` `fd6d517` `4c02177` `627f502` `74ce150` `e8e60f9` `8701912`

**UI polish & bugfix chung (4 commit):** `0c102ec` `8ae2c3d` `fd85ef8` `01011c0`

**Bảo mật, đồng bộ & hiệu năng (2 commit):** `a5bed6c` `169c102`

**Công cụ phát triển (2 commit):** `266bebf` `2bb0441`
