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


export function doctorImageName(doctor = {}) {
  if (doctor.image) return String(doctor.image).trim().replace(/^\/image_doctor\//, '');
  return '/image_chung/doctor-placeholder.svg';
}

export function doctorImagePath(doctor = {}) {
  const image = doctorImageName(doctor);
  return resolveAssetPath('/image_doctor', image);
}
