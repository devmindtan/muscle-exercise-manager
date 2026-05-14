import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { Colors } from '@/src/constants/colors';

/**
 * Landing point for Supabase OAuth redirects.
 * On native: this screen is never actually rendered because
 * WebBrowser.openAuthSessionAsync intercepts the deep link.
 * On web: Supabase redirects here with tokens in the URL fragment.
 */
export default function AuthCallbackScreen() {
  useEffect(() => {
    supabase.auth.getSession().then(() => {
      router.replace('/(tabs)');
    });
  }, []);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.bg,
      }}
    >
      <ActivityIndicator size="large" color={Colors.accent} />
    </View>
  );
}
