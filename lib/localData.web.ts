const STATE_KEY = 'muscle-manager:web-state';
const META_KEY = 'muscle-manager:web-meta';

export async function clearLocalData(): Promise<void> {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STATE_KEY);
  window.localStorage.removeItem(META_KEY);
}
