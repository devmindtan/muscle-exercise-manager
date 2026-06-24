# Muscle Exercise Manager - Preview Release v1.0.3

Ứng dụng workout tracking offline-first, tối ưu cho ghi log nhanh, lưu local ổn định và tự động đồng bộ cloud khi có mạng. Hỗ trợ Google Sign-In và chế độ khách.

## Phạm vi bản phát hành
- Từ commit sau bản release v1.0.2 đến `HEAD` hiện tại.
- Tổng cộng ~29 commit trong phạm vi release này.

---

## Tính năng & Cải tiến mới trong v1.0.3

### 1) Cardio Tracking — tính năng hoàn toàn mới
- Thêm tab Cardio trong màn hình Ghi lại, cho phép log tên hoạt động và thời gian (phút).
- Lưu local bằng SQLite và tự đồng bộ Supabase ngay sau khi lưu.
- Hiển thị chart lịch sử cardio theo tuần/tháng tương tự strength, với detail card và trend line.
- Giao diện tab Tăng cơ / Cardio tách biệt rõ ràng với màu riêng (vàng/cam).

### 2) Log Screen — redesign UI và tách component
- Redesign toàn bộ màn hình Ghi lại với visual hierarchy rõ hơn, header gọn hơn.
- Tách StrengthTab và CardioTab thành component riêng, tăng khả năng bảo trì.

### 3) Goals Tab — hiển thị rõ ràng hơn
- Tách 2 section riêng biệt: **Đang thực hiện** và **Đã đạt mục tiêu** thay vì lẫn lộn.
- Goal đang thực hiện: progress bar dày hơn (8px), deadline warning đỏ nếu còn ≤7 ngày.
- Goal đã đạt: card nền xanh lá, badge tròn ✓, hiển thị luồng `hiện tại → mục tiêu`.
- Thêm filter chip "Đã đạt" và section header có badge đếm số lượng.
- Tự động lấy `current_value` từ bản đo mới nhất khi render prioritized goals.

### 4) History Chart — nâng cấp biểu đồ
- Thay bar chart cũ bằng area chart + trend line (linear regression dạng dashed).
- Sửa month labels bị cắt ở cạnh và căn chỉnh lại x-axis tick labels.
- Chuyển vùng nhấn từ overlay về Circle với hit area trong suốt để touch mobile đáng tin hơn.
- Tăng spacing giữa y-axis labels và vùng chart.

### 5) Muscles Screen — chip layout
- Thay cuộn ngang chip sang wrap layout (nhiều hàng), bỏ chip "Tất cả" thừa.
- Màn hình gọn hơn, không cần scroll ngang khi có nhiều nhóm cơ.

### 6) Weekly Plan — tiến độ, bộ lọc, UX lập kế hoạch
- Thêm tổng quan tiến độ (hoàn thành / chưa đủ / vượt) và bộ lọc category.
- Hiện các nhóm cơ tập ngoài kế hoạch và cho phép thêm nhanh vào plan.
- Hợp nhất logic progress planned + actual, sửa công thức remaining sets.
- Cải thiện hiệu năng khi chuyển ngày, dùng Supabase trên web.

### 7) Dashboard — nâng cấp tab lịch sử và card thống kê
- Card tổng quan hiện tiến độ tổng sets actual/target.
- Tích hợp HistoryTabSection tái sử dụng thay cho chart inline cũ.
- Chuyển về 1 màn hình, 2 in-page tabs (Tổng quan / Lịch sử).
- Sửa công thức tính volume theo `weight` của workout log.

### 8) Body Metrics — mở rộng thao tác với goals
- Thêm khả năng chỉnh sửa và xóa goal trong luồng Body Metrics.
- Cập nhật định dạng ngày hiển thị nhất quán toàn app.

### 9) Đồng bộ & Ổn định
- Luôn pull các bảng core khi sync để tránh mất dữ liệu.
- Sửa tính toán sets trong edit mode.
- Fix luồng upload ảnh trên web (tránh dùng native file-system API).
- Bump patch versions cho nhóm dependency Expo.

### 10) Tối ưu hiệu năng (không thay đổi logic)
- **BodyMetricsScreen**: Sửa `historyByMetric` từ O(n²) spread sang O(n) push. Cache `muscleGroups` trong `load()` thay vì gọi DB mỗi lần lưu goal.
- **DashboardScreen**: Wrap `categoryFilteredStats`, `filteredStats`, `displayedStats`, `weekLabel` vào `useMemo`; `toggleCategory` vào `useCallback` để tránh recompute mỗi render.
- **StrengthTab**: Dịch chuyển `formatTime` ra module scope; thêm `muscleGroupMap` (useMemo) để tránh O(n·m) `.find()` gọi 2 lần mỗi log item trong render loop; cleanup `setTimeout` khi unmount.
- **CardioTab**: Dịch chuyển `formatTime` ra module scope; cleanup `setTimeout` khi unmount.

---

## Tính năng đã có từ trước
- Đăng nhập Google hoặc dùng thử với chế độ khách.
- Quản lý nhóm cơ, bài tập, log tập luyện (thêm/sửa/xóa, soft delete).
- Chuyển nhóm cơ cho bài tập, bật lại bài tập đã vô hiệu hóa.
- Lưu dữ liệu local bằng SQLite, tự động đồng bộ cloud qua Supabase.
- Upload ảnh minh họa và tự đồng bộ khi online.
- Lọc log theo có ghi chú hoặc không.
- Hoạt động offline, tự sync khi có mạng.

## Giới hạn và lưu ý
- Chưa có test tự động, AI, thông báo đẩy, xuất/nhập dữ liệu.
- Dữ liệu tự đồng bộ khi có mạng, trạng thái sync hiển thị trong app.
- Một số thao tác nâng cao sẽ được bổ sung ở bản chính thức.

---

## Danh sách commit chính trong phạm vi release

### Mới sau release notes cũ (`01dd0cd`):
- `11891be` feat: update ui for goaltab
- `7bea98c` refactor(log): split strength and cardio forms into tab components
- `a1fb1ac` feat(sync): add end-to-end cardio logging with local persistence, Supabase schema/types, and immediate UI refresh after save
- `4d2fcd1` feat(log): add cardio tracking with name and duration
- `bb60577` feat(log): redesign LogScreen UI with improved visual hierarchy
- `648132d` fix: increase spacing between y-axis labels and chart area
- `9b45c76` fix: normalize week label format and center x-axis tick alignment
- `1d7feb4` feat(muscles): replace horizontal chip scroll with wrap layout and remove redundant all chip
- `d1cdedf` feat(goals): add completed goals section with done filter chip
- `36108c4` feat(goals): show completed goals section in GoalsTab
- `c57cf75` feat: update goal current values with latest metrics in prioritizedGoals
- `da05f3f` feat: update date format
- `722de9f` fix(chart): move onPress to Circle with transparent hit area for reliable mobile touch
- `b61bfdf` feat(history): replace bar chart with area+trend line, fix month labels & edge clipping
- `aa2ad37` fix(web): make image pick/upload flow web-safe by avoiding native file-system APIs

### Đã có trong release notes cũ:
- `2814044` fix(dashboard): correct history volume calculation from workout log weight
- `b10eb8f` feat(dashboard): replace inline history charts with reusable HistoryTabSection
- `af96594` feat(dashboard): merge overview and history into one screen with 2 in-page tabs
- `1a79426` feat(metrics): move history to page and add goal edit/delete
- `df00363` feat(metrics): add history tab and fix fat-goal flow
- `2523109` fix: always pull core tables on sync, fix edit mode sets calculation
- `f586ec1` chore(deps): bump expo dependencies patch versions
- `d28fe97` fix(weekly-plan): correct remaining-set math, use Supabase on web, and optimize day-switch loading
- `49661e3` feat(dashboard): show total sets progress (actual/target) and move volume unit to hint
- `c504f97` fix(weekly-plan): merge actual/planned progress metric and compute remaining sets from unified progress
- `dd78404` refactor(ui): remove out-of-plan mini badge from weekly plan screen
- `f8db2b1` feat(weekly-plan): show out-of-plan muscles and add to plan with workout set default
- `9febcf0` feat(weekly-plan): add progress totals, green completion state, and category filter
