// src/lib/supabase.ts throws at import time if these are unset — real
// value doesn't matter for unit tests that never actually hit the network,
// it just needs to exist so the module loads.
process.env.EXPO_PUBLIC_SUPABASE_URL ||= 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_KEY ||= 'test-anon-key';
