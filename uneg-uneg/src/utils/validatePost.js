// Cerminan dari supabase/functions/_shared/content.ts — server tetap menjadi penentu akhir.
export const MAX_LENGTH = 280;
export const MAX_LINKS = 2;

const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

export function normalizePost(input) {
  return String(input ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLE, '')
    .trim()
    .replace(/\n{3,}/g, '\n\n');
}

export function countChars(text) {
  return Array.from(text).length;
}

/** @returns {{ ok: boolean, value: string, length: number, error?: string }} */
export function validatePost(input) {
  const value = normalizePost(input);
  const length = countChars(value);

  if (length === 0) return { ok: false, value, length, error: 'Tulis sesuatu dulu.' };
  if (length > MAX_LENGTH) {
    return { ok: false, value, length, error: `Kelebihan ${length - MAX_LENGTH} karakter.` };
  }
  const links = value.match(/https?:\/\/|www\./gi)?.length ?? 0;
  if (links > MAX_LINKS) {
    return { ok: false, value, length, error: `Gunakan maksimal ${MAX_LINKS} tautan.` };
  }
  return { ok: true, value, length };
}
