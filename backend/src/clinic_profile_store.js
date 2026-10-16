import { supabase } from './supabase.js';

// Update profile JSON only when its source version is still current so unrelated
// settings, contact, and department-task updates do not silently overwrite each other.
export async function mutateClinicProfile(mutator, attempts = 4) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data: row, error: readError } = await supabase.from('clinic_profile')
      .select('profile,updated_at').eq('id', true).maybeSingle();
    if (readError || !row) return { data: null, error: readError || new Error('Clinic profile missing') };
    let profile;
    try { profile = mutator(row.profile || {}); }
    catch (error) { return { data: null, error }; }
    let update = supabase.from('clinic_profile').update({ profile }).eq('id', true);
    if (row.updated_at) update = update.eq('updated_at', row.updated_at);
    const saved = await update.select('profile,updated_at').maybeSingle();
    if (saved.error) return { data: null, error: saved.error };
    if (saved.data) return saved;
  }
  return { data: null, error: Object.assign(new Error('Clinic profile changed concurrently'), { code: 'PROFILE_CONFLICT' }) };
}
