import { Tabs } from 'expo-router';
import { LayoutDashboard, Dumbbell, ClipboardList, Activity, UtensilsCrossed } from 'lucide-react-native';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/context/AuthContext';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, loading, signIn, error } = useAuth();
  const tabBarHeight = 65 + insets.bottom;
  const tabsKey = isAuthenticated ? `auth-${user?.id || 'unknown'}` : 'guest';

  if (Platform.OS === 'web' && !isAuthenticated) {
    return (
      <View style={[styles.authGate, { paddingTop: insets.top + 32 }]}>
        <View style={styles.authCard}>
          <Text style={styles.authTitle}>Đăng nhập để dùng bản web</Text>
          <Text style={styles.authDescription}>
            Bản web thao tác trực tiếp với Supabase nên cần session trước khi tải dữ liệu.
          </Text>
          <TouchableOpacity style={styles.authButton} onPress={signIn} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color={Colors.bg} />
            ) : (
              <Text style={styles.authButtonText}>Đăng nhập Google</Text>
            )}
          </TouchableOpacity>
          {error ? <Text style={styles.authError}>{error}</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <Tabs
      key={tabsKey}
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
        tabBarStyle: [
          styles.tabBar,
          { height: tabBarHeight, paddingBottom: insets.bottom + 4, paddingHorizontal: 0 },
        ],
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarBackground: () => <View style={styles.tabBarBg} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tuần này',
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard color={color} size={size} strokeWidth={1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="muscles"
        options={{
          title: 'Tập luyện',
          tabBarIcon: ({ color, size }) => (
            <Dumbbell color={color} size={size} strokeWidth={1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Dinh dưỡng',
          tabBarIcon: ({ color, size }) => (
            <UtensilsCrossed color={color} size={size} strokeWidth={1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="metrics"
        options={{
          title: 'Chỉ số',
          tabBarIconStyle: {
            paddingRight: 120,
          },
          tabBarIcon: ({ color, size }) => (
            <Activity color={color} size={size} strokeWidth={1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Ghi lại',
          tabBarItemStyle: {
            transform: [{ translateX: -8 }], // Số âm di chuyển sang trái, số dương sang phải
          },
          tabBarIcon: ({ color, size }) => (
            <ClipboardList color={color} size={size} strokeWidth={1.8} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 0,
    elevation: 0,
    paddingTop: 6,
    paddingLeft: 10
  },
  tabBarBg: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  authGate: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  authCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    gap: 14,
  },
  authTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  authDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  authButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  authButtonText: {
    color: Colors.bg,
    fontSize: 15,
    fontWeight: '700',
  },
  authError: {
    color: Colors.error,
    fontSize: 13,
  },
});
