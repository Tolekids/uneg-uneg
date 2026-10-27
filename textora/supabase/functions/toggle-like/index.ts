import {
  adminClient, clientIp, enforceRateLimit, handleError, hashId, HttpError,
  json, preflight, readJson, requireAnonId, requireUuid,
} from "../_shared/common.ts";

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  try {
    const body = await readJson(req);
    const postId = requireUuid(body.post_id, "post_id");
    const anonId = requireAnonId(body.anon_id);

    const db = adminClient();
    const ipHash = await hashId(clientIp(req), "ip");
    await enforceRateLimit(db, ipHash, "toggle-like", 30, 60, "Terlalu banyak aksi Like. Tunggu sebentar.");

    const { data: post, error: postError } = await db
      .from("posts").select("id").eq("id", postId).eq("status", "published").maybeSingle();
    if (postError) throw postError;
    if (!post) throw new HttpError(404, "not_found", "Postingan tidak ditemukan.");

    const anonHash = await hashId(anonId, "anon");

    // Jika Like sudah ada, hapus (batalkan). Jika tidak, buat baru.
    const { data: removed, error: delError } = await db
      .from("likes").delete().eq("post_id", postId).eq("anonymous_id_hash", anonHash).select("id");
    if (delError) throw delError;

    let liked = false;
    if (!removed || removed.length === 0) {
      const { error: insError } = await db.from("likes").insert({ post_id: postId, anonymous_id_hash: anonHash });
      // 23505 = unique_violation: permintaan ganda bersamaan, anggap sudah di-Like.
      if (insError && insError.code !== "23505") throw insError;
      liked = true;
    }

    const { data: fresh, error: countError } = await db
      .from("posts").select("like_count").eq("id", postId).single();
    if (countError) throw countError;

    return json(req, { liked, like_count: fresh.like_count });
  } catch (err) {
    return handleError(req, err);
  }
});
