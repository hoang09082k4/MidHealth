import { hasSupabaseConfig, supabase } from './supabase.js';
export async function logAdminEvent({ actor, actorRole = 'admin', eventType, entityType, entityId, message, metadata = {} }) {
  if (!hasSupabaseConfig) return;
  const { error } = await supabase.from('admin_events').insert({ actor_firebase_uid: actor?.localId || actor?.uid || null, actor_email: actor?.email || null, actor_role: actorRole, event_type: eventType, entity_type: entityType || null, entity_id: entityId || null, message, metadata });
  if (error) console.warn('Unable to record clinic audit event:', error.code || 'database unavailable');
}
