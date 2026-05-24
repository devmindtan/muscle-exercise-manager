import { supabase } from '@/src/lib/supabase';

function getRedirectTo() {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window.location.origin;
}

export async function signInWithGoogleWeb() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getRedirectTo(),
      skipBrowserRedirect: false,
    },
  });

  if (error) {
    throw error;
  }
}

export async function signOutWeb() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}
