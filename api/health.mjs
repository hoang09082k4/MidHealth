import { hasFirebaseConfig } from '../backend/src/firebase_auth.js';
import { hasSupabaseConfig } from '../backend/src/supabase.js';

export default function handler(request, response) {
  response.status(200).json({
    status: 'ok',
    service: 'midhealth-vercel-admin-api',
    firebase: hasFirebaseConfig ? 'configured' : 'missing-config',
    supabase: hasSupabaseConfig ? 'configured' : 'missing-config',
  });
}
