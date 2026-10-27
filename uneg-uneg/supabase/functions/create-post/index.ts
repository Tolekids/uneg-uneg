import {
  adminClient, clientIp, enforceRateLimit, handleError, hashId, HttpError,
  json, preflight, readJson, verifyTurnstile,
} from "../_shared/common.ts";
import { validateContent } from "../_shared/content.ts";

const POST_LIMIT = Number(Deno.env.get("POST_LIMIT") ?? 3);
const POST_WINDOW_SECONDS = Number(Deno.env.get("POST_WINDOW_SECONDS") ?? 600);

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  try {
    const body = await readJson(req);

    // 1. Validasi payload dan teks (murah, dilakukan sebelum memanggil layanan luar).
    const check = validateContent(body.content);
    if (!check.ok) throw new HttpError(422, "invalid_content", check.message);

    const token = typeof body.captcha_token === "string" ? body.captcha_token : "";
    if (!token || token.length > 2048) {
      throw new HttpError(400, "captcha_required", "Selesaikan verifikasi sebelum memposting.");
    }

    // 2. Verifikasi token Turnstile di server.
    const ip = clientIp(req);
    const human = await verifyTurnstile(token, ip);
    if (!human) {
      throw new HttpError(403, "captcha_failed", "Verifikasi gagal atau kedaluwarsa. Coba lagi.");
    }

    // 3. Rate limit berdasarkan hash alamat IP (tidak bisa dilewati dengan mengganti browser).
    const db = adminClient();
    const ipHash = await hashId(ip, "ip");
    await enforceRateLimit(
      db, ipHash, "create-post", POST_LIMIT, POST_WINDOW_SECONDS,
      `Batas ${POST_LIMIT} postingan per ${Math.round(POST_WINDOW_SECONDS / 60)} menit tercapai. Coba lagi nanti.`,
    );

    // 4. Tolak postingan identik dalam 10 menit terakhir (spam berulang).
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: dup, error: dupError } = await db
      .from("posts").select("id").eq("content", check.value).gte("created_at", since).limit(1);
    if (dupError) throw dupError;
    if (dup && dup.length > 0) {
      throw new HttpError(409, "duplicate", "Postingan yang sama baru saja dikirim.");
    }

    // 5. Simpan.
    const { data, error } = await db
      .from("posts")
      .insert({ content: check.value })
      .select("id, content, author_label, created_at, like_count")
      .single();
    if (error) throw error;

    return json(req, { post: data }, 201);
  } catch (err) {
    return handleError(req, err);
  }
});
