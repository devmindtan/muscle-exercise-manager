# Kế hoạch: Tính năng Dinh dưỡng

**Ngày lên kế hoạch:** 2026-06-29  
**Trạng thái:** Chưa bắt đầu

---

## Mục tiêu

Thêm tính năng theo dõi thực phẩm nạp vào (calo, protein, chất béo, v.v.) linh hoạt theo trình độ người dùng.  
Người dùng tự chọn chất nào cần theo dõi — app không giới hạn.

---

## Điểm vào UI

Toggle pill trong header của tab **"Nhóm cơ"**:

```
[ Nhóm cơ ]  [ Thực phẩm ]
```

State `mode: 'muscles' | 'nutrition'` trong `MusclesScreen.tsx`.  
Khi chọn "Thực phẩm" → render `NutritionView` thay cho danh sách nhóm cơ.

---

## Data Model

File SQL: `supabase/migrations/20260629000000_add_nutrition_tables.sql`

### `nutrition_nutrient_configs`
Người dùng bật/tắt và sắp xếp các chất cần theo dõi.

| Cột | Mô tả |
|-----|-------|
| `key` | `"protein"`, `"fat"`, `"carb"`, `"fiber"`, `"sugar"`, `"sodium"`, ... |
| `label` | Tên hiển thị, e.g. `"Đạm (Protein)"` |
| `unit` | `"g"`, `"mg"`, `"kcal"`, `"mcg"` |
| `is_enabled` | Bật/tắt |
| `display_order` | Thứ tự hiển thị |

### `nutrition_foods`
Thư viện thực phẩm người dùng tự tạo.

| Cột | Mô tả |
|-----|-------|
| `name` | Tên thực phẩm |
| `brand` | Thương hiệu (tùy chọn) |
| `serving_size` | Khẩu phần, e.g. `100` |
| `serving_unit` | `"g"`, `"ml"`, `"cái"`, `"muỗng"` |
| `nutrients_json` | `{ "protein": 20.5, "fat": 5, "carb": 45 }` — giá trị trên 1 serving |

### `nutrition_logs`
Log ăn uống hàng ngày.

| Cột | Mô tả |
|-----|-------|
| `food_id` | FK tới `nutrition_foods` (nullable — log không cần có trong thư viện) |
| `food_name` | Denormalized để hiển thị nhanh |
| `quantity` | Số serving |
| `nutrients_json` | Giá trị đã tính = `quantity × serving nutrients` |
| `meal_type` | `"morning"`, `"noon"`, `"evening"`, `"snack"` |
| `logged_at` | Thời điểm ăn |

### `nutrition_goals`
Mục tiêu hàng ngày cho từng chất.

| Cột | Mô tả |
|-----|-------|
| `nutrient_key` | Khớp với `key` trong `nutrition_nutrient_configs` |
| `target_value` | Giá trị mục tiêu |
| `unit` | Đơn vị |

---

## Các màn hình cần xây dựng

### 1. `NutritionDayView` (component trong MusclesScreen khi mode = 'nutrition')
- Hiển thị ngày hôm nay + mũi tên qua lại ngày
- Cards tổng macro (thanh progress vs mục tiêu) — chỉ hiện chất đã bật
- Danh sách bữa ăn: Sáng / Trưa / Tối / Bữa phụ
- FAB "+" mở `AddFoodLogModal`
- Nút cài đặt → `NutrientConfigScreen`

### 2. `AddFoodLogModal` (bottom sheet)
- Tìm kiếm thư viện thực phẩm
- Nút "Tạo thực phẩm mới" nếu không tìm thấy
- Chọn bữa ăn + nhập số khẩu phần
- Preview macro trước khi lưu

### 3. `FoodLibraryScreen` (màn riêng, push navigation)
- Danh sách thực phẩm đã tạo
- CRUD: thêm / sửa / xóa
- Form tạo: tên, brand, serving_size/unit, từng chất dinh dưỡng

### 4. `NutrientConfigScreen` (màn riêng, push navigation)
- Toggle bật/tắt từng chất
- Nhập mục tiêu hàng ngày cho từng chất đã bật
- Sắp xếp thứ tự hiển thị

---

## Thứ tự build

- [ ] Phase 1: Schema SQLite local (thêm vào `localDB.ts`) + TypeScript types
- [ ] Phase 2: CRUD functions trong `repository.ts` cho 4 bảng mới
- [ ] Phase 3: `NutrientConfigScreen` (setup trước để có data)
- [ ] Phase 4: `FoodLibraryScreen` + form tạo/sửa thực phẩm
- [ ] Phase 5: `NutritionDayView` + `AddFoodLogModal`
- [ ] Phase 6: Toggle pill trong `MusclesScreen.tsx`
- [ ] Phase 7: Sync Supabase (cùng pattern đã có với `cardio_logs`)

---

## Nguyên tắc quan trọng

- **KHÔNG** chạm vào bất kỳ bảng/code hiện có
- Mọi thứ là additive: thêm bảng mới, thêm file mới, thêm component mới
- `_set_updated_at()` trigger đã có sẵn từ migration cũ — dùng lại
- Theo đúng pattern sync của `cardio_logs` (dirty flag, soft delete, sync_status)
