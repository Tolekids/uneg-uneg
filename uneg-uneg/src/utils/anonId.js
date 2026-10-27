// Identitas anonim per-browser untuk fitur Like.
// Ini BUKAN bukti identitas manusia: menghapus data situs atau berganti browser menghasilkan
// identitas baru. Server hanya menyimpan hash-nya, dan membatasi frekuensi aksi per IP.
const KEY = 'textora.anon';
let memoryId = null;

function randomId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getAnonId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id || id.length < 16) {
      id = randomId();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    memoryId ??= randomId();
    return memoryId;
  }
}
