const STORAGE_PREFIX = 'midhealth_appointments';
const LEGACY_STORAGE_KEY = STORAGE_PREFIX;

function userKey(user) {
  const value = user?.uid || user?.email || user?.phoneNumber || '';
  return String(value).trim().toLowerCase() || 'guest';
}

function storageKey(user) {
  return `${STORAGE_PREFIX}:${userKey(user)}`;
}

function readJsonArray(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function appointmentKey(appointment) {
  return appointment?.id || appointment?.appointmentCode || appointment?.ticket || appointment?.paymentCode || '';
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function belongsToUser(appointment, user) {
  if (!appointment || !user) return false;
  if (appointment.ownerUid && appointment.ownerUid === user.uid) return true;
  const userEmail = normalizeEmail(user.email);
  if (!userEmail) return false;
  return [
    appointment.ownerEmail,
    appointment.email,
    appointment.patientEmail,
    appointment.patientProfile?.email,
  ].some((value) => normalizeEmail(value) === userEmail);
}

function attachOwner(appointment, user) {
  if (!appointment) return appointment;
  return {
    ...appointment,
    ownerUid: user?.uid || appointment.ownerUid || '',
    ownerEmail: normalizeEmail(user?.email) || normalizeEmail(appointment.ownerEmail),
    ownerPhone: user?.phoneNumber || appointment.ownerPhone || '',
  };
}

export function mergeAppointments(appointments) {
  const seen = new Set();
  return appointments.filter((item) => {
    const key = appointmentKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function readLocalAppointments(user) {
  const scoped = readJsonArray(storageKey(user));
  const legacy = user ? readJsonArray(LEGACY_STORAGE_KEY).filter((item) => belongsToUser(item, user)) : [];
  return mergeAppointments([...scoped, ...legacy]);
}

export function saveLocalAppointments(user, appointments) {
  const nextAppointments = mergeAppointments((appointments || []).filter(Boolean).map((item) => attachOwner(item, user)));
  localStorage.setItem(storageKey(user), JSON.stringify(nextAppointments));
  return nextAppointments;
}

export function saveLocalAppointment(user, appointment) {
  const nextAppointment = attachOwner(appointment, user);
  const current = readLocalAppointments(user);
  return saveLocalAppointments(user, [
    nextAppointment,
    ...current.filter((item) => appointmentKey(item) !== appointmentKey(nextAppointment)),
  ]);
}

export function appointmentBelongsToUser(appointment, user) {
  return belongsToUser(appointment, user);
}
