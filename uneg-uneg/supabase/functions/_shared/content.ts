// Aturan validasi teks postingan. Cerminan dari src/utils/validatePost.js.
export const MAX_LENGTH = 280;
export const MAX_LINKS = 2;

// Karakter kontrol dan karakter pengarah teks (bidi) yang bisa dipakai untuk menipu tampilan.
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

export type ContentCheck =
  | { ok: true; value: string }
  | { ok: false; message: string };

export function validateContent(input: unknown): ContentCheck {
  if (typeof input !== "string") {
    return { ok: false, message: "Teks postingan wajib diisi." };
  }
  if (input.length > 4000) {
    return { ok: false, message: `Postingan maksimal ${MAX_LENGTH} karakter.` };
  }

  const value = input
    .replace(/\r\n?/g, "\n")
    .replace(INVISIBLE, "")
    .trim()
    .replace(/\n{3,}/g, "\n\n");

  const length = Array.from(value).length;
  if (length === 0) return { ok: false, message: "Postingan tidak boleh kosong." };
  if (length > MAX_LENGTH) {
    return { ok: false, message: `Postingan maksimal ${MAX_LENGTH} karakter.` };
  }

  const links = value.match(/https?:\/\/|www\./gi)?.length ?? 0;
  if (links > MAX_LINKS) {
    return { ok: false, message: `Gunakan maksimal ${MAX_LINKS} tautan per postingan.` };
  }

  return { ok: true, value };
}
