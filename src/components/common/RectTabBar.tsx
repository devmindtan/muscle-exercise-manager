import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Colors } from '@/src/constants/colors';

export interface RectTabBarItem {
  key: string;
  label: string;
}

interface RectTabBarProps {
  tabs: RectTabBarItem[];
  activeTab: string;
  onSelect: (key: string) => void;
  style?: StyleProp<ViewStyle>;
}

// The rectangular chip-row sub-tab style used by "Tuần này" — reused
// wherever a screen wants that same look via SlidingTabs' renderTabBar.
export function RectTabBar({ tabs, activeTab, onSelect, style }: RectTabBarProps) {
  return (
    <View style={[styles.row, style]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.btn, isActive && styles.btnActive]}
            onPress={() => onSelect(tab.key)}
          >
            <Text style={[styles.text, isActive && styles.textActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    gap: 6,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnActive: {
    backgroundColor: Colors.accent + '1f',
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  text: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  textActive: { color: Colors.accent },
});
