import { supabase } from './supabaseClient.js';
import { getAnonId } from '../utils/anonId.js';

export const PAGE_SIZE = 20;
const COLUMNS = 'id, content, author_label, created_at, like_count';

export class ServiceError extends Error {
  constructor(code, message, retryAfter = 0) {
    super(message);
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export async function fetchPosts({ tab, offset }) {
  let query = supabase.from('posts').select(COLUMNS).eq('status', 'published');
  query = tab === 'foryou'
    ? query.order('like_count', { ascending: false }).order('created_at', { ascending: false })
    : query.order('created_at', { ascending: false });
  query = query.order('id', { ascending: false }); // pemutus seri agar urutan stabil

  const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
  if (error) throw new ServiceError('network', 'Feed gagal dimuat. Periksa koneksimu, lalu coba lagi.');
  return data ?? [];
}

export async function createPost(content, captchaToken) {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      content: content.trim(),
      author_label: 'Anonim',
      status: 'published',
    })
    .select(COLUMNS)
    .single();

  if (error) {
    throw new ServiceError('insert_failed', error.message || 'Gagal mengirim postingan. Coba lagi.');
  }
  return data;
}

export async function toggleLike(postId) {
  const anonHash = getAnonId();

  // Cek apakah sudah pernah dilike oleh anonId ini
  const { data: existing, error: findError } = await supabase
    .from('likes')
    .select('id')
    .eq('post_id', postId)
    .eq('anonymous_id_hash', anonHash)
    .maybeSingle();

  if (findError) throw new ServiceError('like_error', 'Gagal memproses like.');

  let liked = false;
  if (existing) {
    // Batalkan like
    const { error: delError } = await supabase
      .from('likes')
      .delete()
      .eq('id', existing.id);
    if (delError) throw new ServiceError('like_error', 'Gagal membatalkan like.');
    liked = false;
  } else {
    // Tambahkan like baru
    const { error: insError } = await supabase
      .from('likes')
      .insert({ post_id: postId, anonymous_id_hash: anonHash });
    if (insError && insError.code !== '23505') {
      throw new ServiceError('like_error', 'Gagal menyukai postingan.');
    }
    liked = true;
  }

  // Dapatkan jumlah like terbaru yang diupdate oleh database trigger
  const { data: freshPost, error: countError } = await supabase
    .from('posts')
    .select('like_count')
    .eq('id', postId)
    .single();

  if (countError) throw new ServiceError('like_error', 'Gagal mengambil data like terbaru.');

  return { liked, like_count: freshPost.like_count };
}

export async function fetchMyLikes(postIds) {
  if (!postIds || postIds.length === 0) return [];
  const anonHash = getAnonId();
  const { data, error } = await supabase
    .from('likes')
    .select('post_id')
    .eq('anonymous_id_hash', anonHash)
    .in('post_id', postIds.slice(0, 50));

  if (error) return [];
  return (data ?? []).map((row) => row.post_id);
}

export async function reportPost(postId, reason, details) {
  const reporterHash = getAnonId();
  const { error } = await supabase
    .from('reports')
    .insert({
      post_id: postId,
      reason,
      details: details ? details.trim().slice(0, 500) : null,
      reporter_hash: reporterHash,
    });

  if (error && error.code !== '23505') {
    throw new ServiceError('report_error', 'Gagal mengirim laporan. Coba lagi.');
  }
  return { ok: true };
}
