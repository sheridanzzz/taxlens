/** True when both Supabase URL and anon key are set (cloud auth + DB). */
export const isSupabaseConfigured = (): boolean =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when Neon is configured (Auth.js session endpoint available). */
export const isNeonConfigured = (): boolean =>
  !!process.env.DATABASE_URL || !!process.env.NEXT_PUBLIC_AUTH_BACKEND;

/** True when any cloud backend is configured. */
export const isCloudConfigured = (): boolean =>
  isSupabaseConfigured() || isNeonConfigured();
