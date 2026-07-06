import { useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/src/constants/colors';
import { SlidingTabs } from '@/src/components/common/SlidingTabs';
import { RectTabBar } from '@/src/components/common/RectTabBar';
import { FriendsTab } from '@/src/components/community-tabs/FriendsTab';
import { DiscoverTab } from '@/src/components/community-tabs/DiscoverTab';
import { MySharesTab } from '@/src/components/community-tabs/MySharesTab';

const TABS = [
  { key: 'friends', label: 'Bạn bè' },
  { key: 'discover', label: 'Khám phá' },
  { key: 'shares', label: 'Chia sẻ' },
];

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  // Lazily mount each sub-tab's content only after it's been activated once,
  // so SlidingTabs mounting all 3 side-by-side doesn't fire 3x network
  // fetches immediately (friends/discover/shares each hit Supabase on load).
  const visitedRef = useRef<Set<string>>(new Set([TABS[0].key]));
  const [activeTab, setActiveTab] = useState(TABS[0].key);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
        <Text style={styles.headerTitle}>Cộng đồng</Text>
        <Text style={styles.headerSub}>Kết bạn, khám phá và chia sẻ lịch tập</Text>
      </View>

      <SlidingTabs
        tabs={TABS}
        activeTab={activeTab}
        scrollableScreens={false}
        onTabChange={(key) => {
          visitedRef.current.add(key);
          setActiveTab(key);
        }}
        renderTabBar={({ activeTab: current, onSelect }) => (
          <RectTabBar tabs={TABS} activeTab={current} onSelect={onSelect} />
        )}
        renderScreen={(key) => {
          if (!visitedRef.current.has(key)) {
            return <View style={{ flex: 1 }} />;
          }
          if (key === 'friends') return <FriendsTab />;
          if (key === 'discover') return <DiscoverTab />;
          return <MySharesTab />;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12, backgroundColor: Colors.bg },
  headerTitle: { fontSize: 28, fontWeight: '700', color: Colors.text, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
});
