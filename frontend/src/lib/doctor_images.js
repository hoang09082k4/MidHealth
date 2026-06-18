const DOCTOR_FALLBACK_IMAGES = [
  '1bf4426b4444c51a9c55.jpg',
  '3f62dcffdad05b8e02c1.jpg',
  '448a5f1b5934d86a8125.jpg',
  '4ff24c634a4ccb12925d.jpg',
  '6a5870c976e6f7b8aef7.jpg',
  '6aec5f71595ed800814f.jpg',
  '6e11808d86a207fc5eb3.jpg',
  '790b4c984ab7cbe992a6.jpg',
  '91270d870ba88af6d3b9.jpg',
  'bfbae228e40765593c16.jpg',
  'e51eb8bfbe903fce6681.jpg',
  'f7698cf68ad90b8752c8.jpg',
];
const ASSET_PATH_LIMIT = 2048;

function resolveAssetPath(prefix, value = '') {
  const path = String(value || '').trim();
  if (!path) return '';
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(path)) return path;
  if (/^data:?image/i.test(path)) return '';
  if (path.length > ASSET_PATH_LIMIT && !/^(https?:)?\/\//i.test(path)) return '';
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('/')) return path;
  return `${String(prefix || '').replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function stableIndex(value = '') {
  const key = String(value || 'doctor');
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % DOCTOR_FALLBACK_IMAGES.length;
  }
  return hash;
}

export function doctorImageName(doctor = {}) {
  if (doctor.image) return String(doctor.image).trim().replace(/^\/image_doctor\//, '');
  return DOCTOR_FALLBACK_IMAGES[stableIndex(doctor.id || doctor.name || doctor.initials)];
}

export function doctorImagePath(doctor = {}) {
  const image = doctorImageName(doctor);
  return resolveAssetPath('/image_doctor', image);
}
