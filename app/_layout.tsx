import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';
import { usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SyncProvider } from '@/context/SyncContext';
import { Colors } from '@/constants/colors';

function WebAuthGate() {
  const pathname = usePathname();
  const { user, loading, signIn } = useAuth();

  if (Platform.OS !== 'web') return null;
  if (pathname === '/auth-callback') return null;
  if (loading || user) return null;

  return (
    <View style={styles.webAuthContainer}>
      <Text style={styles.webAuthTitle}>Đăng nhập để tiếp tục</Text>
      <Text style={styles.webAuthText}>
        Trên web, bạn cần đăng nhập để xem và tạo dữ liệu tập luyện.
      </Text>
      <TouchableOpacity style={styles.webAuthButton} onPress={signIn}>
        <Text style={styles.webAuthButtonText}>Đăng nhập với Google</Text>
      </TouchableOpacity>
    </View>
  );
}

function AppNavigator() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const requireWebAuth =
    Platform.OS === 'web' && !loading && !user && pathname !== '/auth-callback';

  if (requireWebAuth) {
    return <WebAuthGate />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth-callback" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AuthProvider>
      <SyncProvider>
        <AppNavigator />
      </SyncProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  webAuthContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: Colors.bg,
  },
  webAuthTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  webAuthText: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 520,
    marginBottom: 20,
  },
  webAuthButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  webAuthButtonText: {
    color: Colors.bg,
    fontSize: 14,
    fontWeight: '700',
  },
});
