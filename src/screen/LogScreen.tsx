import { useState, useCallback } from 'react';
import {
  Alert,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Download, Dumbbell, Flame } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';
import StrengthTab from '../components/log-tabs/StrengthTab';
import CardioTab from '../components/log-tabs/CardioTab';

type LogMode = 'strength' | 'cardio';

export default function LogScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<LogMode>('strength');

  const exportDatabase = useCallback(() => {
    Alert.alert('Thông báo', 'Chức năng xuất dữ liệu sẽ được bổ sung sau.');
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <Text style={styles.title}>Ghi lại</Text>
          <TouchableOpacity style={styles.exportBtn} onPress={exportDatabase} activeOpacity={0.7}>
            <Download color={Colors.textSecondary} size={14} strokeWidth={2} />
            <Text style={styles.exportBtnText}>Xuất</Text>
          </TouchableOpacity>
        </View>

        {/* ── Mode toggle ── */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'strength' && styles.modeBtnActive]}
            onPress={() => setMode('strength')}
            activeOpacity={0.7}
          >
            <Dumbbell color={mode === 'strength' ? '#000' : Colors.textMuted} size={14} strokeWidth={2} />
            <Text style={[styles.modeBtnText, mode === 'strength' && styles.modeBtnTextActive]}>
              Tăng cơ
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'cardio' && styles.modeBtnCardioActive]}
            onPress={() => setMode('cardio')}
            activeOpacity={0.7}
          >
            <Flame color={mode === 'cardio' ? '#fff' : Colors.textMuted} size={14} strokeWidth={2} />
            <Text style={[styles.modeBtnText, mode === 'cardio' && styles.modeBtnTextCardioActive]}>
              Cardio
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Active tab ── */}
        {mode === 'strength' ? <StrengthTab /> : <CardioTab />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: 60 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.8,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  /* Mode toggle */
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
    gap: 3,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  modeBtnActive: {
    backgroundColor: Colors.accent,
  },
  modeBtnCardioActive: {
    backgroundColor: '#F97316',
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  modeBtnTextActive: {
    color: '#000',
  },
  modeBtnTextCardioActive: {
    color: '#fff',
  },
});