# Bản vá: Bỏ "thêm chất dinh dưỡng tùy chỉnh" + Xử lý ngoại tuyến im lặng

Ngày: 2026-06-30
Phạm vi: `src/components/nutrition/FoodLibraryScreen.tsx`, `src/context/SyncContext.tsx`, `src/components/SyncStatusChip.tsx`

---

## 1. Bỏ tính năng "thêm chất dinh dưỡng tùy chỉnh" trong Thư viện thực phẩm

> Sửa lại sau phản hồi: bản vá đầu tiên đã xoá nhầm ở màn **Cấu hình dinh dưỡng** (`NutrientConfigScreen.tsx`). Đã khôi phục nguyên trạng file đó + `repository.ts` (`createNutrientConfig()` được giữ lại), và xoá đúng chỗ trong **Thư viện thực phẩm** (`FoodLibraryScreen.tsx`) — màn hình thêm/sửa món ăn vào thư viện.

**Lý do:** Form thêm/sửa thực phẩm đã có sẵn ô Calo (tự tính hoặc nhập tay) + toàn bộ chất dinh dưỡng mặc định đang theo dõi (đạm, tinh bột, chất béo, chất xơ...). Nút "Thêm chất dinh dưỡng" mở thêm một picker cho phép chọn chất chưa hiển thị hoặc tự gõ tên chất hoàn toàn mới — dư thừa vì các chất cần thiết đã có sẵn trong form.

**Đã xoá** (trong `FoodLibraryScreen.tsx`):
- Nút "Thêm chất dinh dưỡng" (dashed button) bên dưới phần "Chất dinh dưỡng khác"
- Picker nội tuyến đi kèm: ô tìm kiếm, danh sách chất chưa dùng để chọn thêm, mục "Tự nhập tên khác..."
- Hàm `pickNutrientConfig()`, `pickCustomNutrient()` — đường vào duy nhất để *tạo thêm* dòng dinh dưỡng tự do (`form.extra`)
- State `showNutrientPicker`, `pickerSearch`
- Import `ChevronDown`, `ChevronUp` không còn dùng
- Style không còn dùng: `addExtraBtn`, `addExtraBtnText`, `pickerSearchRow`, `pickerSearchInput`, `pickerEmpty*`, `pickerBox`, `pickerRow*`, `pickerCustomText`

**Giữ nguyên (không phá vỡ dữ liệu cũ):**
- Các dòng `form.extra` đã tồn tại sẵn trên món ăn cũ (chất dinh dưỡng tự do đã lưu từ trước khi có bản vá này) vẫn hiển thị, sửa giá trị, hoặc xoá được (nút thùng rác) như cũ — chỉ không còn cách **thêm dòng mới**.
- Ô bật/tắt hiển thị từng chất mặc định trong form (nút "X" để ẩn field, "Hiện lại" để khôi phục) — đây là ẩn/hiện field có sẵn trong 1 lần nhập, không phải tạo chất mới, nên giữ nguyên.
- Cấu hình dinh dưỡng (`NutrientConfigScreen.tsx`) và ô "Thêm chất dinh dưỡng" trong modal **Thêm nhanh** khi ghi nhật ký (`AddFoodLogModal.tsx`) — không đụng tới, ngoài phạm vi yêu cầu lần này.

---

## 2. Trạng thái ngoại tuyến: im lặng, không hiển thị lỗi

**Lý do:** Trước đây khi mất mạng, `SyncContext` gán `status: 'error'` và hiển thị "Không có internet" với khung đỏ (`chipError`) trên chip đồng bộ — trông như có sự cố thật sự dù đây là tình huống bình thường (offline-first app).

**Đã thay đổi** (`SyncContext.tsx`):
- Thêm trạng thái mới `'offline'` vào type `SyncStatus` (tách biệt với `'error'`)
- Khi phát hiện lỗi mạng (`isNetworkSyncError()` khớp — network request failed, fetch failed, offline, connection refused...) ở cả 3 nơi: nhánh `offlineTestMode`, kết quả `syncData()` thất bại, và `catch` exception → set `status: 'offline'`, `syncError: null` (không còn message lỗi nào được lưu)
- Lỗi **thật sự** (không phải do mất mạng) vẫn giữ `status: 'error'` + message để người dùng biết cần xử lý

**Đã thay đổi** (`SyncStatusChip.tsx`):
- Thêm case `'offline'`: icon `CloudOff` màu trung tính (`textMuted`), nhãn "Ngoại tuyến", **không** bật viền đỏ `errorBorder`
- Case `'error'` được đơn giản hoá vì việc phân loại lỗi mạng đã chuyển lên `SyncContext` xử lý từ trước
- Bỏ import `isNetworkSyncError` không còn cần ở component này

**Kết quả:** Khi không có mạng, người dùng chỉ thấy chip màu trung tính "Ngoại tuyến" — không có khung đỏ, không có thông báo lỗi nào. App tự đồng bộ lại bình thường (mỗi 60s hoặc khi quay lại foreground) và chuyển về "Đã đồng bộ" ngay khi có mạng trở lại, không cần thao tác gì thêm. Nút "Mô phỏng offline" (QA) trong `UserAccountModal.tsx` hoạt động đúng với trạng thái mới, không cần sửa.

---

## 3. Rà soát thêm — phát hiện trong lúc kiểm tra toàn bộ

Đã đọc qua `AddFoodLogModal.tsx`, `FoodLibraryScreen.tsx`, `NutrientConfigScreen.tsx`, `TDEECalculatorScreen.tsx`, `NutritionDayView.tsx`, `app/(tabs)/_layout.tsx` để tìm vấn đề liên quan. Ghi nhận, **chưa sửa** (ngoài phạm vi yêu cầu, cần xác nhận trước khi đụng vào):

- **Cấu hình dinh dưỡng** (`NutrientConfigScreen.tsx`) và **modal Thêm nhanh** khi ghi nhật ký (`AddFoodLogModal.tsx`) vẫn còn nút "thêm chất dinh dưỡng tùy chỉnh" tương tự cái vừa xoá ở Thư viện thực phẩm. Chưa đụng vì người dùng chỉ yêu cầu sửa ở Thư viện thực phẩm — nếu muốn bỏ luôn 2 chỗ này, báo để xử lý tiếp.

- **Ghi nhật ký dinh dưỡng trên bản web có thể lộ lỗi mạng thô khi mất mạng.** Trên native, mọi thao tác ghi (food log, food library...) đi qua `LocalDB` trước (offline-safe, đồng bộ sau). Trên web, `createNutritionLog()` và các hàm tạo/sửa khác gọi thẳng Supabase — nếu mất mạng giữa lúc lưu, người dùng sẽ thấy message lỗi gốc (vd "Failed to fetch") trong banner lỗi của form thay vì thông báo thân thiện. Đây là input-validation banner (khác với chip đồng bộ ở mục 2) nên không tự ý đổi — nếu muốn xử lý tương tự (ẩn lỗi mạng, hiện "Đang ngoại tuyến, thử lại sau"), cần làm riêng một bản vá cho luồng web.
- **`app/(tabs)/_layout.tsx`** đang có 1 thay đổi chưa commit (xoá comment tiếng Việt ở dòng `transform: [{ translateX: -8 }]`, dòng 92-93) — không phải do bản vá này tạo ra, có vẻ còn sót lại từ phiên làm việc trước về tab bar. Không đụng tới vì không thuộc phạm vi yêu cầu lần này.

Không phát hiện thêm tính năng "thêm X tùy chỉnh" dư thừa nào khác trong các màn hình đã rà soát.

---

## 4. Kiểm tra

- `npx tsc --noEmit` — pass, không có lỗi kiểu mới phát sinh.
- Chưa chạy app thực tế (môi trường hiện tại không có simulator/device kết nối) — khuyến nghị kiểm tra thủ công 2 luồng trước khi release:
  1. Mở Thư viện thực phẩm → Thêm/Sửa thực phẩm → xác nhận không còn nút "Thêm chất dinh dưỡng", các chất mặc định + dòng dinh dưỡng cũ (nếu có) vẫn hiển thị/sửa/xoá được.
  2. Bật "Mô phỏng offline" trong tài khoản → xác nhận chip chuyển sang "Ngoại tuyến" màu trung tính, tắt mô phỏng → chip tự đồng bộ lại bình thường.

## Danh sách file thay đổi

```
M src/components/nutrition/FoodLibraryScreen.tsx        (-172 dòng, +5 dòng)
M src/context/SyncContext.tsx                            (~35 dòng, thêm trạng thái 'offline')
M src/components/SyncStatusChip.tsx                       (~11 dòng)
```

Chưa commit — theo quy tắc chỉ commit khi được yêu cầu rõ ràng.
