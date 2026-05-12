import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
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
  return `${window.location.origin}/auth-callback`;
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
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw error ?? new Error('No OAuth URL returned');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') {
    const fragment = result.url.split('#')[1] ?? '';
    const params = new URLSearchParams(fragment);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });
    }
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
