# Project Brief - Muscle Exercise Manager (ban tom tat de rebuild)

## 1. Muc tieu san pham

Xay dung ung dung quan ly tap gym theo nhom co, toi uu cho ghi log nhanh, dung duoc khi offline, va dong bo du lieu len cloud khi co mang.

Muc tieu chinh:
- Ghi buoi tap nhanh voi it thao tac.
- Du lieu local la nguon su that de UI luon phan hoi nhanh.
- Dong bo nen voi cloud, khong chan CRUD.
- Ho tro nhieu thiet bi voi tai khoan dang nhap.
- Dam bao tach biet du lieu giua cac tai khoan.

## 2. Gia tri cot loi va triet ly ky thuat

- Offline-first, local-first: moi thao tac tao/sua/xoa duoc ghi local truoc.
- UI khong doc truc tiep cloud de render trang.
- Cloud sync la lop bo tro, khong phai dependency bat buoc de su dung app.
- Uu tien soft delete thay vi hard delete de an toan lich su va de sync.
- Giai quyet xung dot theo huong practical: uu tien local neu dang co pending unsynced.
- Cursor sync dua tren server timestamp de tranh loi do dong ho thiet bi.

## 3. Pham vi tinh nang can co

### 3.1 Quan ly nhom co
- Tao nhom co voi:
  - ten
  - mau sac
  - muc tieu set theo tuan
  - muc tieu set theo thang
  - hinh minh hoa (tuy chon)
- Sua thong tin nhom co.
- Xoa mem nhom co (danh dau deleted_at).
- Danh sach nhom co sap xep theo thoi diem tao.

### 3.2 Quan ly bai tap trong nhom co
- Tao bai tap theo nhom co.
- Thuoc tinh bai tap:
  - ten
  - ghi chu
  - hinh minh hoa
  - trang thai active/inactive
- Sua bai tap.
- Vo hieu hoa/bat lai bai tap (khong xoa hard).

### 3.3 Ghi workout log
- Chon nhom co, chon bai tap active, nhap:
  - sets (bat buoc)
  - reps (tuy chon)
  - weight (tuy chon)
  - note (tuy chon)
- Luu logged_at.
- Xoa mem workout log.
- Danh sach log gan day co tim kiem, filter theo nhom co, va phan trang xem them.

### 3.4 Dashboard thong ke
- Tong sets trong tuan hien tai.
- Tien do tung nhom co so voi target tuan.
- Hien thi so nhom co da dat muc tieu.
- Dieu huong nhanh vao trang chi tiet nhom co.

### 3.5 Tai khoan va auth
- Dang nhap Google thong qua Supabase Auth.
- Luong redirect rieng cho web va native.
- Trang thai guest mode tren native khi chua dang nhap.
- Truy cap web bat buoc dang nhap.
- Hien thi thong tin user (ten, email, UUID, provider), co dang xuat.

### 3.6 Trang thai dong bo
- Sync status chip:
  - idle
  - syncing
  - synced
  - error
- Cho phep manual sync.
- Auto sync khi:
  - app active lai
  - user vua dang nhap
  - tab web focus/visible
  - interval dinh ky

## 4. Kien truc tong the

He thong gom 5 lop:

1. UI layer
- Cac man hinh dashboard, danh sach nhom co, chi tiet nhom co, ghi log.

2. Context layer
- Auth context quan ly session/user/loading/guest mode.
- Sync context quan ly trang thai sync va trigger sync.

3. Repository layer
- API CRUD thong nhat cho app.
- Co 2 implementation:
  - native: SQLite
  - web: localStorage

4. Sync layer
- Push local pending len Supabase.
- Pull incremental theo updated_at.
- Luu cursor last_pull_at.

5. Cloud layer
- Supabase Auth + Postgres.

Nguyen tac bat buoc:
- UI chi doc/ghi qua repository.
- Khong cho man hinh goi cloud truc tiep de thao tac du lieu nghiep vu.

## 5. Du lieu va mo hinh schema

Co 3 bang nghiep vu:

1. muscle_groups
- id
- name
- color
- target_sets_per_week
- target_sets_per_month
- image_uri
- created_at
- updated_at
- sync_status
- deleted_at
- user_id

2. exercises
- id
- muscle_group_id
- name
- notes
- image_uri
- is_active
- created_at
- updated_at
- sync_status
- deleted_at
- user_id

3. workout_logs
- id
- exercise_id
- muscle_group_id (de-normalized de query nhanh)
- sets
- reps
- weight
- note
- logged_at
- created_at
- updated_at
- sync_status
- deleted_at
- user_id

Bang metadata local:
- app_meta (native) hoac local meta (web) de luu:
  - last_pull_at
  - last_user_id (web)

Index quan trong:
- Theo muscle_group_id
- Theo logged_at
- Theo sync_status
- Theo updated_at
- Theo (muscle_group_id, is_active)

## 6. Chien luoc dong bo

### 6.1 Push
- Quet cac row co sync_status = pending tren tung bang.
- Upsert len Supabase theo id.
- Payload push bo sync_status va updated_at local; server set updated_at.
- Gan user_id theo session hien tai.
- Neu push thanh cong -> danh dau local la synced.

### 6.2 Pull
- Lay cursor last_pull_at.
- Guard cursor neu lon hon thoi gian hien tai (clock skew protection).
- Query remote theo user_id hien tai + updated_at > (hoac >=) cursor.
- Sap xep tang dan theo updated_at, gioi han theo batch.
- Upsert ve local neu remote moi hon local.
- Neu local row dang pending thi khong overwrite (giu local edits).
- Cap nhat cursor bang max updated_at cua server da thay.

### 6.3 Seed va user switch
- Lan dau: reset cursor ve epoch de pull full.
- Web: neu last_user_id khac user hien tai -> clear state cu, reset cursor, pull lai user moi.
- Native: du lieu local co the duoc giu khi sign out de tiep tuc guest mode.

### 6.4 Conflict handling
- Huong xu ly thuc dung:
  - pending local > remote cho den khi push xong
  - nguoc lai remote moi hon local thi overwrite
- Last-write-wins dua tren updated_at cua server.

## 7. Auth va user isolation

- OAuth Google qua Supabase.
- Web can callback URL co dinh theo domain public.
- Native dung deep link callback.
- Moi row cloud gan user_id.
- RLS chi cho phep doc/ghi row cua auth.uid() hoac row chua bind user (legacy/anonymous).

## 8. Luu tru hinh anh

Pipeline hinh anh:
- Chon anh tu thu vien.
- Nen anh ve JPEG de giam payload.
- Upload len MinIO/S3-compatible storage.

Ho tro 3 mode cau hinh upload:
- Mode 1: PUT truc tiep den endpoint bucket voi Basic Auth access key/secret.
- Mode 2: Upload qua 1 API trung gian (multipart form-data).
- Mode 3: PUT truc tiep qua base URL upload va doc anh qua public base URL.

Ket qua can luu image_uri (URL cloud) trong du lieu nghiep vu.

## 9. Khac biet native va web

Native:
- Local persistence bang SQLite.
- Ho tro guest mode khi chua dang nhap.
- Co kha nang export DB file de debug/backup.

Web:
- Local persistence bang localStorage.
- Bat buoc dang nhap de xem/tao du lieu.
- Co co che clear state khi doi user de tranh ro ri du lieu.

## 10. UX va dieu huong

- Kieu dieu huong: tab bar 3 man hinh chinh
  - dashboard tuan
  - nhom co
  - ghi log
- Co man hinh chi tiet nhom co qua route dynamic.
- Co auth callback screen de xu ly OAuth redirect.
- Tab bar phai tinh safe area tot cho mobile va mobile web.

## 11. Bao mat va van hanh

- Bat RLS cho tat ca bang nghiep vu.
- Policy theo user_id/auth.uid.
- Bien moi truong bat buoc:
  - SUPABASE_URL
  - SUPABASE_ANON_KEY
  - WEB_URL callback
- Bien moi truong cho image storage tuy mode MinIO.

## 12. Stack cong nghe de de tai dung

- Expo + React Native + Expo Router + TypeScript.
- Supabase Auth + Postgres.
- SQLite native + localStorage web.
- Khuyen nghi giu mo hinh context + repository + sync worker nhu hien tai.

## 13. Tieu chi hoan thanh cho project clone

1. CRUD nhom co, bai tap, workout log chay duoc khi offline.
2. UI luon doc local, khong bi khoi thao tac khi mat mang.
3. Dang nhap Google thanh cong tren web va native.
4. Push/pull sync chay duoc, co cursor incremental.
5. Doi user khong lo du lieu cheo tai khoan.
6. Soft delete duoc dong bo giua cac thiet bi.
7. Dashboard tinh dung tong sets va tien do theo tuan/thang.
8. Anh co the upload va hien thi on dinh bang URL cloud.
9. Co trang thai sync ro rang cho nguoi dung.

## 14. Lo trinh de nguoi khac xay lai nhanh

1. Tao schema va RLS tren Supabase (3 bang nghiep vu + cot sync).
2. Xay repository local cho native/web, dong nhat API CRUD.
3. Chuyen UI sang chi goi repository.
4. Them AuthContext + OAuth flow.
5. Them SyncContext + sync engine push/pull + cursor.
6. Them soft delete, pending/synced state, user isolation.
7. Them image upload pipeline.
8. Hoan thien dashboard thong ke va sync status UX.
9. Test cac kich ban: offline, online, user switch, multi-device.

## 15. Kich ban test toi thieu

- Tao nhom co/bai tap/log khi offline, sau do online va sync thanh cong.
- Sua du lieu o thiet bi A, mo thiet bi B va pull thay doi.
- Soft delete o A, B pull ve va an du lieu.
- Dang xuat/dang nhap account khac tren web -> local data duoc reset dung.
- Dong ho may client sai gio nhung van khong mat du lieu khi sync.
- Image upload that bai thi thong bao loi ro rang, khong vo du lieu text.

---

Tai lieu nay du de giao cho mot team/nguoi khac xay project moi cung y tuong va cung hanh vi san pham, khong can copy code goc.