import { supabase } from './supabase.js';

// A database row lock serializes allocation across API processes and instances.
// Numbers are deliberately not recycled after a failed booking.
export async function nextQueueNumber(client = supabase) {
  const { data, error } = await client.rpc('allocate_queue_number');
  if (error) throw error;
  if (!Number.isSafeInteger(data) || data < 1) throw new Error('Không thể cấp số phiếu khám.');
  return data;
}
