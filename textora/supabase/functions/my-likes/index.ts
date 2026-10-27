import {
  adminClient, clientIp, enforceRateLimit, handleError, hashId, HttpError,
  json, preflight, readJson, requireAnonId, requireUuid,
} from "../_shared/common.ts";

// Mengembalikan daftar post_id yang sudah di-Like oleh identitas anonim ini.
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  try {
    const body = await readJson(req);
    const anonId = requireAnonId(body.anon_id);
    if (!Array.isArray(body.post_ids) || body.post_ids.length === 0 || body.post_ids.length > 50) {
      throw new HttpError(400, "bad_request", "Daftar postingan tidak valid.");
    }
    const postIds = body.post_ids.map((id) => requireUuid(id, "post_ids"));

    const db = adminClient();
    const ipHash = await hashId(clientIp(req), "ip");
    await enforceRateLimit(db, ipHash, "my-likes", 60, 60, "Terlalu banyak permintaan. Tunggu sebentar.");

    const anonHash = await hashId(anonId, "anon");
    const { data, error } = await db
      .from("likes").select("post_id").eq("anonymous_id_hash", anonHash).in("post_id", postIds);
    if (error) throw error;

    return json(req, { liked_ids: (data ?? []).map((row) => row.post_id) });
  } catch (err) {
    return handleError(req, err);
  }
});
