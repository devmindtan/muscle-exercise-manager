# Dataflow các chức năng chính

## 1. Đăng nhập/Đăng xuất
- Người dùng chọn đăng nhập Google hoặc vào chế độ Khách.
- Nếu Google: app gọi Google Sign-In, lấy idToken, gửi lên Supabase để xác thực.
- Nếu thành công, lưu userId vào AsyncStorage, đồng bộ dữ liệu cá nhân.
- Khi đăng xuất: xoá toàn bộ dữ liệu local, xoá session Supabase, chuyển về chế độ Khách.
```mermaid
graph TD
    %% Định nghĩa các Style màu sắc
    classDef auth fill:#e8f5e9,stroke:#4caf50,color:#1b5e20;
    classDef process fill:#e3f2fd,stroke:#2196f3,color:#0d47a1;
    classDef storage fill:#fff3e0,stroke:#ff9800,color:#e65100;
    classDef supabase fill:#eaeaea,stroke:#3ecf8e,color:#10b981;
    classDef delete fill:#ffebee,stroke:#f44336,color:#b71c1c;

    %% ========================================================================
    %% 1. LUỒNG ĐĂNG NHẬP (DỌC TOÀN BỘ)
    %% ========================================================================
    StartInput([User chọn hình thức đăng nhập])
    
    %% Phân nhánh lựa chọn ban đầu
    StartInput --> |"Vào chế độ Khách"| GuestMode[Vào thẳng App với quyền Guest]
    StartInput --> |"Chọn Google"| GoogleAuth["Gọi Google Sign-In SDK<br/>(Lấy idToken)"]
    
    %% Tiến trình xác thực Google
    GoogleAuth --> SupabaseAuth["Gửi idToken lên Supabase<br/>(Xác thực tài khoản)"]
    SupabaseAuth --> IsSuccess{Xác thực<br/>thành công?}
    
    %% Kết quả xác thực
    IsSuccess --> |"Không"| LoginFail[Hiển thị thông báo lỗi]
    IsSuccess --> |"Có"| SaveLocal["Lưu userId vào AsyncStorage"]
    
    %% Kích hoạt sau đăng nhập thành công
    SaveLocal --> TriggerSync["Kích hoạt SyncProvider<br/>(Đồng bộ dữ liệu cá nhân)"]
    TriggerSync --> MainApp([Vào Màn hình chính])

    %% ========================================================================
    %% 2. LUỒNG ĐĂNG XUẤT (NỐI TIẾP THEO CHIỀU DỌC)
    %% ========================================================================
    LogoutStartInput([User bấm Đăng xuất])
    
    %% Các bước dọn dẹp dữ liệu theo tuần tự
    LogoutStartInput --> ClearLocal["Xoá toàn bộ dữ liệu local<br/>(SQLite / LocalStorage)"]
    ClearLocal --> ClearAsync["Xoá userId trong AsyncStorage"]
    ClearAsync --> SupabaseSignOut["Gọi Supabase Auth SignOut<br/>(Huỷ Session trên Cloud)"]
    SupabaseSignOut --> BackToGuest([Chuyển app về chế độ Khách])

    %% Gán class cho các Node
    class StartInput,GuestMode,BackToGuest auth;
    class GoogleAuth,TriggerSync,IsSuccess process;
    class SaveLocal,ClearAsync storage;
    class SupabaseAuth,SupabaseSignOut supabase;
    class ClearLocal,LoginFail delete;
```
## 2. Xem/Thêm/Sửa/Xoá nhóm cơ
- Xem: Đọc danh sách nhóm cơ từ localDB (SQLite), hiển thị UI.
- Thêm: Nhập tên, màu, mục tiêu, lưu vào localDB, đánh dấu dirty để đồng bộ cloud.
- Sửa: Sửa thông tin nhóm cơ, cập nhật localDB, đánh dấu dirty.
- Xoá: Đánh dấu deleted=1, dirty=1 trong localDB (soft delete), ẩn khỏi UI.
- Khi đồng bộ: push/pull dữ liệu nhóm cơ với Supabase.
```mermaid
graph TD
    %% Định nghĩa các Style màu sắc
    classDef ui fill:#e3f2fd,stroke:#2196f3,color:#0d47a1;
    classDef db Read fill:#fff3e0,stroke:#ff9800,color:#e65100;
    classDef dbWrite fill:#e8f5e9,stroke:#4caf50,color:#1b5e20;
    classDef dbDelete fill:#ffebee,stroke:#f44336,color:#b71c1c;
    classDef sync fill:#eaeaea,stroke:#3ecf8e,color:#10b981;

    %% ========================================================================
    %% 1. XEM (READ)
    %% ========================================================================
    ActionRead([User vào màn hình Nhóm cơ])
    ActionRead --> DBRead["Query SQLite:<br/>SELECT * WHERE deleted = 0"]
    DBRead --> UIRender[Render danh sách lên UI]

    %% ========================================================================
    %% 2. THÊM (CREATE)
    %% ========================================================================
    ActionCreate([User nhập Tên, Màu, Mục tiêu -> Bấm Thêm])
    ActionCreate --> DBCreate["Insert SQLite:<br/>Set fields + dirty = 1<br/>(deleted = 0)"]
    DBCreate --> UIRefreshC[UI tự động reload từ Local DB]

    %% ========================================================================
    %% 3. SỬA (UPDATE)
    %% ========================================================================
    ActionUpdate([User chỉnh sửa thông tin -> Bấm Lưu])
    ActionUpdate --> DBUpdate["Update SQLite:<br/>Update fields + set dirty = 1"]
    DBUpdate --> UIRefreshU[UI tự động reload từ Local DB]

    %% ========================================================================
    %% 4. XÓA (SOFT DELETE)
    %% ========================================================================
    ActionDelete([User bấm Xóa nhóm cơ])
    ActionDelete --> DBDelete["Update SQLite (Soft Delete):<br/>Set deleted = 1 + dirty = 1"]
    DBDelete --> UIHide[Ẩn bản ghi khỏi UI<br/>Do điều kiện lọc deleted = 0]

    %% ========================================================================
    %% 5. ĐỒNG BỘ (SYNC LAYER)
    %% ========================================================================
    TriggerSync([Kích hoạt Đồng bộ / Sync Engine])
    
    %% Tiến trình Push
    TriggerSync --> SyncPush["Tìm bản ghi có dirty = 1<br/>-> Push lên Supabase Cloud"]
    SyncPush --> ResetDirty["Cập nhật local:<br/>Set dirty = 0"]
    
    %% Tiến trình Pull
    ResetDirty --> SyncPull["Pull dữ liệu mới từ Supabase<br/>-> Hợp nhất vào SQLite local"]
    SyncPull --> UIRefreshSync[UI cập nhật dữ liệu mới nhất]

    %% Gán class cho các Node
    class UIRender,UIRefreshC,UIRefreshU,UIHide,UIRefreshSync ui;
    class DBRead dbRead;
    class DBCreate,DBUpdate dbWrite;
    class DBDelete dbDelete;
    class SyncPush,ResetDirty,SyncPull sync;
```
## 3. Xem/Thêm/Sửa/Xoá bài tập
- Xem: Đọc danh sách bài tập từ localDB, lọc theo nhóm cơ.
- Thêm: Nhập tên, notes, lưu vào localDB, dirty=1.
- Sửa: Cập nhật thông tin, dirty=1.
- Xoá: Đánh dấu deleted=1, dirty=1 (soft delete).
- Khi đồng bộ: push/pull dữ liệu bài tập với Supabase.
```mermaid
graph TD
    %% Định nghĩa các Style màu sắc
    classDef ui fill:#e3f2fd,stroke:#2196f3,color:#0d47a1;
    classDef dbRead fill:#fff3e0,stroke:#ff9800,color:#e65100;
    classDef dbWrite fill:#e8f5e9,stroke:#4caf50,color:#1b5e20;
    classDef dbDelete fill:#ffebee,stroke:#f44336,color:#b71c1c;
    classDef sync fill:#eaeaea,stroke:#3ecf8e,color:#10b981;

    %% ========================================================================
    %% 1. XEM (READ) - CÓ LỌC THEO NHÓM CƠ
    %% ========================================================================
    ActionRead([User chọn Nhóm cơ / Vào màn hình Bài tập])
    ActionRead --> DBRead["Query SQLite:<br/>SELECT * WHERE muscle_group_id = X<br/>AND deleted = 0"]
    DBRead --> UIRender[Render danh sách bài tập của nhóm cơ đó]

    %% ========================================================================
    %% 2. THÊM (CREATE)
    %% ========================================================================
    ActionCreate([User nhập Tên, Notes, Chọn Nhóm cơ -> Bấm Thêm])
    ActionCreate --> DBCreate["Insert SQLite:<br/>Set fields + muscle_group_id<br/>+ dirty = 1 (deleted = 0)"]
    DBCreate --> UIRefreshC[UI tự động danh sách bài tập]

    %% ========================================================================
    %% 3. SỬA (UPDATE)
    %% ========================================================================
    ActionUpdate([User chỉnh sửa thông tin bài tập -> Bấm Lưu])
    ActionUpdate --> DBUpdate["Update SQLite:<br/>Update fields + set dirty = 1"]
    DBUpdate --> UIRefreshU[UI cập nhật thông tin mới]

    %% ========================================================================
    %% 4. XÓA (SOFT DELETE)
    %% ========================================================================
    ActionDelete([User bấm Xóa bài tập])
    ActionDelete --> DBDelete["Update SQLite (Soft Delete):<br/>Set deleted = 1 + dirty = 1"]
    DBDelete --> UIHide[Ẩn bài tập khỏi danh sách hiển thị]

    %% ========================================================================
    %% 5. ĐỒNG BỘ (SYNC LAYER)
    %% ========================================================================
    TriggerSync([Kích hoạt Đồng bộ / Sync Engine])
    
    %% Tiến trình Push
    TriggerSync --> SyncPush["Tìm bài tập có dirty = 1<br/>-> Push lên bảng exercises (Supabase)"]
    SyncPush --> ResetDirty["Cập nhật local:<br/>Set dirty = 0"]
    
    %% Tiến trình Pull
    ResetDirty --> SyncPull["Pull bài tập mới từ Supabase<br/>-> Hợp nhất vào SQLite local"]
    SyncPull --> UIRefreshSync[UI cập nhật dữ liệu đồng bộ mới nhất]

    %% Gán class cho các Node
    class UIRender,UIRefreshC,UIRefreshU,UIHide,UIRefreshSync ui;
    class DBRead dbRead;
    class DBCreate,DBUpdate dbWrite;
    class DBDelete dbDelete;
    class SyncPush,ResetDirty,SyncPull sync;
```

## 4. Ghi log tập luyện
- Thêm log: Chọn nhóm cơ, bài tập, nhập số set, reps, weight, notes, lưu vào localDB, dirty=1.
- Xoá log: Đánh dấu deleted=1, dirty=1.
- Khi đồng bộ: push/pull log với Supabase.
```mermaid
graph TD
    %% Định nghĩa các Style màu sắc
    classDef ui fill:#e3f2fd,stroke:#2196f3,color:#0d47a1;
    classDef dbRead fill:#fff3e0,stroke:#ff9800,color:#e65100;
    classDef dbWrite fill:#e8f5e9,stroke:#4caf50,color:#1b5e20;
    classDef dbDelete fill:#ffebee,stroke:#f44336,color:#b71c1c;
    classDef sync fill:#eaeaea,stroke:#3ecf8e,color:#10b981;

    %% ========================================================================
    %% 1. KHỞI TẠO & CHỌN THÔNG TIN (UI FLOW)
    %% ========================================================================
    ActionStart([User vào màn hình Thêm Log])
    ActionStart --> SelectMuscle[1. Chọn Nhóm cơ]
    SelectMuscle --> SelectExercise[2. Chọn Bài tập tương ứng]

    %% ========================================================================
    %% 2. THÊM LOG (CREATE)
    %% ========================================================================
    ActionCreate([User nhập: Số Set, Reps, Weight, Notes -> Bấm Lưu])
    SelectExercise --> ActionCreate
    
    ActionCreate --> DBCreate["Insert SQLite (workout_logs):<br/>Ghi nhận Sets, Reps, Weight, Notes<br/>+ exercise_id + dirty = 1<br/>(deleted = 0)"]
    DBCreate --> UIRefreshC[UI hiển thị Log vừa ghi nhận]

    %% ========================================================================
    %% 3. XÓA LOG (SOFT DELETE)
    %% ========================================================================
    ActionDelete([User bấm Xóa bản ghi Log])
    ActionDelete --> DBDelete["Update SQLite (workout_logs):<br/>Set deleted = 1 + dirty = 1"]
    DBDelete --> UIHide[Ẩn bản ghi Log khỏi màn hình Lịch sử]

    %% ========================================================================
    %% 4. ĐỒNG BỘ (SYNC LAYER)
    %% ========================================================================
    TriggerSync([Kích hoạt Đồng bộ / Sync Engine])
    
    %% Tiến trình Push
    TriggerSync --> SyncPush["Tìm workout_logs có dirty = 1<br/>-> Push lên bảng workout_logs (Supabase)"]
    SyncPush --> ResetDirty["Cập nhật local:<br/>Set dirty = 0"]
    
    %% Tiến trình Pull
    ResetDirty --> SyncPull["Pull dữ liệu log mới từ Supabase<br/>-> Hợp nhất vào SQLite local"]
    SyncPull --> UIRefreshSync[UI cập nhật biểu đồ / lịch sử tập mới nhất]

    %% Gán class cho các Node
    class SelectMuscle,SelectExercise,UIRefreshC,UIHide,UIRefreshSync ui;
    class DBCreate dbWrite;
    class DBDelete dbDelete;
    class SyncPush,ResetDirty,SyncPull sync;
```

## 5. Tìm kiếm, lọc, thống kê
- Tìm kiếm/lọc: Thực hiện trên dữ liệu local (SQLite), không gọi API.
- Thống kê: Tính toán số set, tiến độ theo tuần/tháng dựa trên log local.
```mermaid
graph TD
    %% Định nghĩa các Style màu sắc
    classDef ui fill:#e3f2fd,stroke:#2196f3,color:#0d47a1;
    classDef dbRead fill:#fff3e0,stroke:#ff9800,color:#e65100;
    classDef processing fill:#fbe9e7,stroke:#ffab91,color:#bf360c;

    %% ========================================================================
    %% LUỒNG 1: TÌM KIẾM & LỌC (SEARCH & FILTER)
    %% ========================================================================
    ActionSearch([User nhập từ khóa / Chọn bộ lọc trên UI])
    
    %% Truy vấn Local
    ActionSearch --> DBSearch["Query SQLite tại local:<br/>SELECT * FROM exercises/logs<br/>WHERE name LIKE '%key%' AND deleted = 0"]
    
    %% Render kết quả nhanh
    DBSearch --> UIShowSearch[Hiển thị kết quả tìm kiếm/lọc tức thì]

    %% ========================================================================
    %% LUỒNG 2: THỐNG KÊ (ANALYTICS & STATISTICS)
    %% ========================================================================
    ActionStats([User vào màn hình Thống kê / Báo cáo])
    
    %% Phân nhánh mốc thời gian
    ActionStats --> SelectTime{Chọn mốc thời gian?}
    SelectTime --> |"Theo Tuần"| DBQueryWeek["Query SQLite:<br/>Lọc logs trong 7 ngày gần nhất"]
    SelectTime --> |"Theo Tháng"| DBQueryMonth["Query SQLite:<br/>Lọc logs trong 30 ngày gần nhất"]
    
    %% Tính toán số liệu (Xử lý logic tại Client)
    DBQueryWeek --> LocalCompute["Tính toán Logic tại Local:<br/>1. Tổng số Sets đã tập<br/>2. Tính Volume (Sets x Reps x Weight)<br/>3. Biểu đồ tiến độ (Progress)"]
    DBQueryMonth --> LocalCompute
    
    %% Render biểu đồ
    LocalCompute --> UIRenderCharts["Render Thống kê lên UI<br/>(Biểu đồ cột / Đường tiến trình)"]

    %% Gán class cho các Node
    class UIShowSearch,UIRenderCharts ui;
    class DBSearch,DBQueryWeek,DBQueryMonth dbRead;
    class LocalCompute,SelectTime processing;
```
## 6. Đồng bộ dữ liệu
- Khi đăng nhập hoặc app foreground, tự động đồng bộ local <-> Supabase.
- Push: Gửi các bản ghi dirty lên cloud (muscle group, exercise, log).
- Pull: Lấy các thay đổi mới từ cloud về local, cập nhật localDB.
- Nếu logout/switch user: xoá toàn bộ dữ liệu local, reset đồng bộ.
```mermaid
graph TD
    %% Định nghĩa các Style màu sắc
    classDef trigger fill:#fff3e0,stroke:#ff9800,color:#e65100;
    classDef local fill:#e3f2fd,stroke:#2196f3,color:#0d47a1;
    classDef push fill:#e8f5e9,stroke:#4caf50,color:#1b5e20;
    classDef pull fill:#f3e5f5,stroke:#9c27b0,color:#4a148c;
    classDef cloud fill:#eaeaea,stroke:#3ecf8e,color:#10b981;
    classDef delete fill:#ffebee,stroke:#f44336,color:#b71c1c;

    %% ========================================================================
    %% 1. CÁC ĐIỀU KIỆN KÍCH HOẠT (TRIGGERS)
    %% ========================================================================
    TriggerEvent([Sự kiện: Đăng nhập THÀNH CÔNG / App vào Foreground])
    TriggerEvent --> CheckSession{Kiểm tra trạng thái<br/>Session hợp lệ?}
    
    CheckSession -- "Không" --> StopSync([Dừng đồng bộ])
    CheckSession -- "Có" --> LockUI[Bật trạng thái Syncing tại Local]

    %% ========================================================================
    %% 2. TIẾN TRÌNH PUSH (LOCAL -> CLOUD) - THEO THỨ TỰ KHÓA NGOẠI
    %% ========================================================================
    LockUI --> PushPhase["[PHASE 1: PUSH] <br/>Tìm các bản ghi có dirty = 1"]
    
    %% Thứ tự push tuân thủ ràng buộc dữ liệu
    PushPhase --> PushMuscle["1. Push Nhóm cơ (muscle_groups)"]
    PushMuscle --> PushExercise["2. Push Bài tập (exercises)"]
    PushExercise --> PushLog["3. Push Log tập luyện (workout_logs)"]
    
    %% Reset flag tại local sau khi cloud xác nhận thành công
    PushLog --> CloudAck["Supabase lưu thành công & phản hồi"]
    CloudAck --> ResetDirty["Cập nhật SQLite local:<br/>Set dirty = 0 cho các bản ghi vừa push"]

    %% ========================================================================
    %% 3. TIẾN TRÌNH PULL (CLOUD -> LOCAL)
    %% ========================================================================
    ResetDirty --> PullPhase["[PHASE 2: PULL]<br/>Gửi last_synced_at lên Supabase"]
    PullPhase --> FetchCloud["Query các bản ghi có cập nhật mới hơn<br/>(updated_at > last_synced_at)"]
    
    %% Upsert vào localDB
    FetchCloud --> LocalUpsert["Thực hiện UPSERT vào SQLite:<br/>1. Chèn dữ liệu mới<br/>2. Ghi đè dữ liệu cũ nếu trùng ID<br/>3. Xử lý bản ghi có deleted = 1"]
    LocalUpsert --> UpdateTS["Cập nhật local:<br/>Lưu mốc thời gian last_synced_at mới nhất"]
    UpdateTS --> UnlockUI[Tắt trạng thái Syncing -> UI Render lại]

    %% ========================================================================
    %% 4. TRƯỜNG HỢP LOGOUT / SWITCH USER
    %% ========================================================================
    TriggerLogout([Sự kiện: Logout / Đổi tài khoản])
    TriggerLogout --> ClearSQLite["Xóa sạch toàn bộ bảng trong SQLite local"]
    ClearSQLite --> ClearTS["Xóa mốc thời gian last_synced_at"]
    ClearTS --> FinishLogout([Hoàn tất reset đồng bộ])

    %% Gán class cho các Node
    class TriggerEvent,CheckSession,TriggerLogout trigger;
    class LockUI,ResetDirty,UpdateTS,UnlockUI local;
    class PushPhase,PushMuscle,PushExercise,PushLog push;
    class PullPhase,LocalUpsert pull;
    class CloudAck,FetchCloud cloud;
    class ClearSQLite,ClearTS,ClearLocal,StopSync,FinishLogout delete;
```
## 7. Upload/Xoá ảnh
- Khi chọn ảnh minh hoạ: upload lên MinIO, lấy URL, lưu vào localDB.
- Khi xoá: chỉ xoá link local, không xoá file trên MinIO.
```mermaid
graph TD
    %% Định nghĩa các Style màu sắc
    classDef ui fill:#e3f2fd,stroke:#2196f3,color:#0d47a1;
    classDef storage fill:#fff3e0,stroke:#ff9800,color:#e65100;
    classDef cloud fill:#eaeaea,stroke:#3ecf8e,color:#10b981;
    classDef process fill:#e8f5e9,stroke:#4caf50,color:#1b5e20;
    classDef delete fill:#ffebee,stroke:#f44336,color:#b71c1c;

    %% ========================================================================
    %% LUỒNG 1: CHỌN VÀ UPLOAD ẢNH (UPLOAD FLOW)
    %% ========================================================================
    ActionSelect([User chọn ảnh từ Thư viện / Camera])
    
    %% Tiến trình đẩy lên Cloud Storage
    ActionSelect --> MinIOUpload["Gọi SDK / API Upload lên MinIO Storage"]
    MinIOUpload --> GetURL[MinIO trả về liên kết: image_url]
    
    %% Cập nhật database local
    GetURL --> DBUpdateImage["Update SQLite (Bảng liên quan):<br/>Set image_url = URL vừa nhận<br/>+ set dirty = 1"]
    DBUpdateImage --> UIRenderImage[Hiển thị ảnh minh họa lên UI tức thì]

    %% ========================================================================
    %% LUỒNG 2: XÓA ẢNH (DELETE FLOW)
    %% ========================================================================
    ActionDelete([User bấm Xóa ảnh minh họa])
    
    %% Phân tích nghiệp vụ tách biệt local và cloud
    ActionDelete --> DBNullify["Update SQLite (Bảng liên quan):<br/>Set image_url = NULL<br/>+ set dirty = 1"]
    
    %% Hoàn tác trên UI nhưng giữ nguyên file vật lý trên MinIO
    DBNullify --> UIHideImage[Giao diện gỡ ảnh và quay về ảnh mặc định]
    DBNullify -.->|"Bảo toàn dữ liệu"| MinIOKeep["[Lưu ý] Không gọi lệnh xóa file<br/>vật lý trên MinIO"]

    %% Gán class cho các Node
    class ActionSelect,UIRenderImage,UIHideImage ui;
    class MinIOUpload,GetURL cloud;
    class DBUpdateImage,DBNullify storage;
    class MinIOKeep delete;
```
## 8. Xử lý offline (không có mạng)

Khi thiết bị không có kết nối mạng:
- App vẫn hoạt động bình thường với mọi chức năng CRUD (xem, thêm, sửa, xoá) vì tất cả thao tác đều thực hiện trên localDB (SQLite) trước.
- SyncContext kiểm tra kết nối trước khi gọi syncData. Nếu mạng lỗi hoặc Supabase không phản hồi, thay vì để lỗi crash app, syncStatus được set thành 'error' kèm thông báo ngắn gọn.
- SyncStatusChip hiển thị icon cảnh báo và dòng chữ mô tả lỗi (ví dụ: "Không có mạng") thay vì crash hoặc hiển thị lỗi kỹ thuật khó hiểu.
- Các bản ghi vẫn được đánh dấu dirty=1 và sẽ tự động được đồng bộ lên cloud khi app quay lại foreground hoặc khi có mạng trở lại.
- Khi mạng phục hồi và app vào foreground, SyncProvider tự động kích hoạt lại syncData để đồng bộ toàn bộ bản ghi còn dirty.

---
Mọi thao tác CRUD đều thực hiện trên localDB trước, sau đó đồng bộ cloud khi có mạng và đăng nhập.