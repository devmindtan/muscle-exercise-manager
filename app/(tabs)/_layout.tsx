import { Tabs } from 'expo-router';
import { LayoutDashboard, Dumbbell, ClipboardList, Activity } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/context/AuthContext';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();
  const tabBarHeight = 65 + insets.bottom;
  const tabsKey = isAuthenticated ? `auth-${user?.id || 'unknown'}` : 'guest';

  return (
    <Tabs
      key={tabsKey}
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
        tabBarStyle: [
          styles.tabBar,
          { height: tabBarHeight, paddingBottom: insets.bottom + 4 },
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
          title: 'Nhóm cơ',
          tabBarIcon: ({ color, size }) => (
            <Dumbbell color={color} size={size} strokeWidth={1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="metrics"
        options={{
          title: 'Chỉ số',
          tabBarIcon: ({ color, size }) => (
            <Activity color={color} size={size} strokeWidth={1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Ghi lại',
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
});
