import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform, Alert } from 'react-native';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

export type { Session, User };

WebBrowser.maybeCompleteAuthSession();

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

function getWebOAuthRedirectTo(): string {
  const configured = process.env.EXPO_PUBLIC_WEB_URL?.trim();
  if (configured) {
    const base = configured.replace(/\/$/, '');
    return `${base}/auth-callback`;
  }
  // Fallback to origin only for localhost dev
  const origin = window.location.origin;
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return `${origin}/auth-callback`;
  }
  // For production, EXPO_PUBLIC_WEB_URL must be set
  console.error(
    'Missing EXPO_PUBLIC_WEB_URL env variable for production OAuth redirect. ' +
    'Set it in your Vercel environment variables or .env file.'
  );
  return `${origin}/auth-callback`; // fallback, will likely fail
}

export async function signInWithGoogle(): Promise<void> {
  if (Platform.OS === 'web') {
    // On web: full-page redirect handled by Supabase
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getWebOAuthRedirectTo(),
      },
    });
    return;
  }

  // On native: open an in-app browser session
  const redirectTo = Linking.createURL('/auth-callback');
  console.log('🔐 Native OAuth redirectTo:', redirectTo);
  
  // Debug: show redirectTo on screen
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    Alert.alert('Debug', `Redirect URL:\n${redirectTo}`, [{ text: 'OK' }]);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw error ?? new Error('No OAuth URL returned');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  console.log('🔐 OAuth result type:', result.type, 'URL:', result.url);
  
  if (result.type === 'success') {
    const fragment = result.url.split('#')[1] ?? '';
    const params = new URLSearchParams(fragment);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    console.log('🔐 Tokens received, setting session...');
    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });
    }
  } else {
    console.error('🔐 OAuth cancelled or error');
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export function onAuthStateChange(
  callback: (session: Session | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}
