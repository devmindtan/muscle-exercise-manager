# Muscle Exercise Manager

Offline-first workout tracking app tối ưu cho ghi log nhanh, đồng bộ cloud, hỗ trợ đăng nhập Google và chế độ khách.

## Features

- Đăng nhập Google hoặc dùng chế độ Khách
- Quản lý nhóm cơ, bài tập, log tập luyện
- Thêm/sửa/xoá nhóm cơ, bài tập, log (soft delete)
- Tìm kiếm, lọc, thống kê tiến độ
- Đồng bộ dữ liệu local <-> cloud (Supabase)
- Upload ảnh minh hoạ lên MinIO
- Hoạt động offline, tự động đồng bộ khi có mạng

## Tech Stack

- React Native (Expo, TypeScript)
- SQLite (localDB)
- Supabase (cloud sync, auth)
- MinIO (image upload)
- Google Sign-In

## Prerequisites

- Node.js >= 20
- npm >= 10
- Expo CLI

## Installation

```bash
git clone https://github.com/username/muscle-exercise-manager.git
cd muscle-exercise-manager
npm install
```

## Environment Variables

Tạo file `.env` với các biến sau (hoặc cấu hình trong eas.json):

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_KEY=
EXPO_PUBLIC_MINIO_ENDPOINT=
EXPO_PUBLIC_MINIO_PUBLIC_BASE_URL=
EXPO_PUBLIC_MINIO_BUCKET=muscle-manager
EXPO_PUBLIC_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_OCR_SPACE_API_KEY=

`EXPO_PUBLIC_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` are treated as aliases, and `EXPO_PUBLIC_MINIO_ENDPOINT` and `EXPO_PUBLIC_MINIO_PUBLIC_BASE_URL` are treated as aliases.
```

`EXPO_PUBLIC_OCR_SPACE_API_KEY` is required if you want to use the InBody scan autofill feature in the `Chỉ số` tab.

## Running The Application

```bash
npx expo start
# hoặc build preview:
EAS_LOCAL_BUILD_WORKINGDIR="$PWD/tmp/eas-preview" npx eas-cli@latest build --profile preview --platform android --local --non-interactive
```

## Folder Structure

```md
src/
	components/
	context/
	db/
	docs/
	lib/
	screen/
	services/
	supabase/
	types/
```

## Dataflow & Architecture

Xem chi tiết luồng dữ liệu các chức năng tại [src/docs/dataflow.md](src/docs/dataflow.md)

## API & Cloud

- Supabase: auth, cloud sync (muscle_groups, exercises, workout_logs)
- MinIO: upload ảnh minh hoạ

## Testing

```bash
# (Chưa có test tự động)
```

## Deployment

```bash
eas build --profile production --platform android
```

## Roadmap

- [ ] AI recommendation system
- [ ] Mobile notifications
- [ ] Multi-device synchronization

## Contributing

Pull requests are welcome. Hãy mở issue trước với thay đổi lớn.

## License

MIT License
