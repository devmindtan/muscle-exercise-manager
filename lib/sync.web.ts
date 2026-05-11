export async function pushPendingChanges(): Promise<void> {
  // Web uses localStorage-backed persistence, so there is nothing to push.
}

export async function pullRemoteChanges(): Promise<void> {
  // Optional cloud sync is not wired in the web fallback yet.
}

export async function seedFromSupabase(): Promise<void> {
  // Web persistence is localStorage-backed; nothing to seed.
}

export async function syncAll(): Promise<void> {
  // No-op on web.
}
