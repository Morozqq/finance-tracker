import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Cloud mode turns on only when both build-time variables are present. */
export const hasCloud = Boolean(url && anonKey)

/**
 * persistSession + autoRefreshToken are what make "log in once" true: the
 * session lives in localStorage and the token is renewed in the background,
 * so the app reopens straight onto the dashboard.
 */
export const supabase: SupabaseClient | null = hasCloud
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null

export function requireClient(): SupabaseClient {
  if (!supabase) throw new Error('Supabase не настроен')
  return supabase
}
