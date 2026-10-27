import {
  adminClient, clientIp, enforceRateLimit, handleError, hashId, HttpError,
  json, preflight, readJson, requireUuid,
} from "../_shared/common.ts";

const REASONS = ["spam", "harassment", "violence", "personal_info", "other"];

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  try {
    const body = await readJson(req);
    const postId = requireUuid(body.post_id, "post_id");

    if (typeof body.reason !== "string" || !REASONS.includes(body.reason)) {
      throw new HttpError(422, "invalid_reason", "Pilih alasan laporan.");
    }
    let details: string | null = null;
    if (body.details != null && body.details !== "") {
      if (typeof body.details !== "string") throw new HttpError(422, "invalid_details", "Detail laporan tidak valid.");
      details = body.details.trim().slice(0, 500) || null;
    }

    const db = adminClient();
    const reporterHash = await hashId(clientIp(req), "reporter");
    await enforceRateLimit(db, reporterHash, "report-post", 5, 600, "Terlalu banyak laporan. Coba lagi beberapa menit lagi.");

    const { data: post, error: postError } = await db
      .from("posts").select("id").eq("id", postId).maybeSingle();
    if (postError) throw postError;
    if (!post) throw new HttpError(404, "not_found", "Postingan tidak ditemukan.");

    const { error } = await db.from("reports").insert({
      post_id: postId, reason: body.reason, details, reporter_hash: reporterHash,
    });
    // 23505: sumber yang sama sudah melaporkan postingan ini. Tetap dianggap berhasil.
    if (error && error.code !== "23505") throw error;

    return json(req, { ok: true }, 201);
  } catch (err) {
    return handleError(req, err);
  }
});
