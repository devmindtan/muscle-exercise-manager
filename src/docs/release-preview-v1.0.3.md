# Muscle Exercise Manager - Preview Release v1.0.3

Ứng dụng workout tracking offline-first, tối ưu cho ghi log nhanh, lưu local ổn định và tự động đồng bộ cloud khi có mạng. Hỗ trợ Google Sign-In và chế độ khách.

## Phạm vi bản phát hành
- Từ commit `a48de97` đến `HEAD` hiện tại.
- Tổng cộng 14 commit trong phạm vi release này.

## Điểm mới trong Preview v1.0.3

### 1) Weekly Plan: tiến độ, bộ lọc, và UX lập kế hoạch
- Thêm tổng quan tiến độ theo trạng thái (hoàn thành/chưa đủ/vượt) và bộ lọc category để theo dõi nhanh.
- Hiện các nhóm cơ tập ngoài kế hoạch và cho phép thêm nhanh vào plan với workout set mặc định.
- Đơn giản hóa cách hiển thị thống kê/muscle entry để dễ đọc hơn trên màn hình dày view.
- Loại bỏ mini badge "out-of-plan" không cần thiết để UI gọn và rõ ràng hơn.
- Hợp nhất logic progress planned + actual và sửa công thức remaining sets để không bị lệch.
- Cải thiện hiệu năng khi chuyển ngày và điều chỉnh luồng tải dữ liệu trên web.

### 2) Dashboard: nâng cấp tab lịch sử và card thống kê
- Card tổng quan hiện tiến độ tổng sets theo actual/target.
- Chuyển đơn vị volume sang hint để giá trị chính gọn hơn.
- Tích hợp HistoryTabSection dùng component tái sử dụng thay cho chart inline cũ.
- Chuyển về mô hình 1 màn hình, 2 in-page tabs (Overview/History) để đồng bộ UX.
- Thêm chi tiết lịch sử cho từng mốc và sửa dùng công thức tính volume theo `weight` của workout log.

### 3) Body Metrics: mở rộng thao tác với goals
- Thêm khả năng chỉnh sửa và xóa goal trong luồng Body Metrics.
- Điều chỉnh lại một số luồng xử lý để đồng nhất với flow metric hiện tại.

### 4) Đồng bộ dữ liệu và ổn định hệ thống
- Luôn pull các bảng core trong sync để tránh mất dữ liệu cần thiết sau các lần đồng bộ.
- Sửa tính toán sets trong edit mode để không sai số khi cập nhật.
- Bump patch versions cho nhóm dependency Expo để tăng độ ổn định.

### 5) Tài liệu và tài nguyên
- Cập nhật README phần mô tả và hướng dẫn sử dụng.
- Bổ sung/cập nhật hình ảnh preview cho dashboard, body metrics, weekly plan, và log workout.

## Tính năng đã có trong Preview
- Đăng nhập Google hoặc dùng thử với chế độ khách.
- Quản lý nhóm cơ, bài tập, log tập luyện (thêm/sửa/xóa, soft delete).
- Chuyển nhóm cơ cho bài tập, bật lại bài tập đã vô hiệu hóa.
- Lưu dữ liệu local bằng SQLite, tự động đồng bộ cloud qua Supabase.
- Upload ảnh minh họa và tự động đồng bộ khi online.
- Lọc log theo có ghi chú hoặc không ghi chú.
- Hoạt động offline, tự sync khi có mạng.

## Giới hạn và lưu ý
- Chưa có test tự động, AI, thông báo đẩy, xuất/nhập dữ liệu.
- Dữ liệu sẽ tự động đồng bộ khi có mạng, trạng thái sync hiển thị trong app.
- Một số thao tác nâng cao sẽ được bổ sung ở bản chính thức.

## Danh sách commit chính trong phạm vi release
- `2814044` fix(dashboard): correct history volume calculation from workout log weight
- `b10eb8f` feat(dashboard): replace inline history charts with reusable HistoryTabSection
- `af96594` feat(dashboard): merge overview and history into one screen with 2 in-page tabs
- `1a79426` feat(metrics): move history to page and add goal edit/delete
- `df00363` feat(metrics): add history tab and fix fat-goal flow
- `2523109` fix: always pull core tables on sync, fix edit mode sets calculation
- `f586ec1` chore(deps): bump expo dependencies patch versions
- `d28fe97` fix(weekly-plan): correct remaining-set math, use Supabase on web, and optimize day-switch loading
- `e5244e2` chore: update README
- `49661e3` feat(dashboard): show total sets progress (actual/target) and move volume unit to hint
- `c504f97` fix(weekly-plan): merge actual/planned progress metric and compute remaining sets from unified progress
- `dd78404` refactor(ui): remove out-of-plan mini badge from weekly plan screen
- `f8db2b1` feat(weekly-plan): show out-of-plan muscles and add to plan with workout set default
- `9febcf0` feat(weekly-plan): add progress totals, green completion state, and category filter