# Cách 1: Dùng Expo CLI (dễ nhất)
npm install -g eas-cli
eas login
eas build --platform android --profile preview

# Cách 2: Build local (cần Android SDK)
npx expo prebuild --clean
cd android && ./gradlew assembleRelease