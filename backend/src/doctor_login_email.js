export function doctorLoginEmail(fullName, birthYear) {
  const year = Number(birthYear);
  if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() - 18) return null;
  const words = String(fullName || '').replace(/^\s*(?:BS\.?|Bác sĩ)\s*/iu, '').trim()
    .replace(/[đĐ]/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.some(word => !/^[a-z]+$/.test(word))) return null;
  return `${words.at(-1)}${words.slice(0, -1).map(word => word[0]).join('')}${year}@midhealth.vn`;
}
