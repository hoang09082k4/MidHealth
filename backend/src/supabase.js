import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

export const hasSupabaseConfig = Boolean(
  config.supabaseUrl
  && config.supabaseServiceRoleKey,
);

export const supabase = hasSupabaseConfig
  ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    global: { fetch: (url, options = {}) => fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(8000) }) },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  : null;
