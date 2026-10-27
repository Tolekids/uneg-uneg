import { createClient } from "npm:@supabase/supabase-js@2";

// ALLOWED_ORIGINS: daftar origin dipisah koma, mis. "https://textora.netlify.app,http://localhost:5173".
// Jika kosong, semua origin diizinkan (hanya untuk uji coba).
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allow = allowedOrigins.includes("*")
    ? "*"
    : allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed", message: "Metode tidak didukung." }, 405);
  return null;
}

// Klien dengan service_role. Hanya dipakai di server; kuncinya disuntikkan otomatis oleh Supabase.
export function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > 8192) throw new HttpError(413, "payload_too_large", "Permintaan terlalu besar.");
  try {
    const data = JSON.parse(text);
    if (data === null || typeof data !== "object" || Array.isArray(data)) throw new Error();
    return data as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "bad_request", "Format permintaan tidak valid.");
  }
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

export function handleError(req: Request, err: unknown): Response {
  if (err instanceof HttpError) {
    return json(req, { error: err.code, message: err.message, ...err.extra }, err.status);
  }
  console.error("Kesalahan tak terduga:", err);
  return json(req, { error: "server_error", message: "Terjadi kesalahan di server. Coba lagi sebentar lagi." }, 500);
}

export function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

// Hash SHA-256 dengan "pepper" rahasia agar IP/ID anonim tidak tersimpan mentah.
export async function hashId(value: string, scope: string): Promise<string> {
  const pepper = Deno.env.get("HASH_PEPPER");
  if (!pepper) throw new Error("HASH_PEPPER belum diatur");
  const data = new TextEncoder().encode(`${pepper}:${scope}:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) throw new Error("TURNSTILE_SECRET_KEY belum diatur");

  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  if (ip !== "unknown") form.set("remoteip", ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Turnstile siteverify gagal: ${res.status}`);
  const result = await res.json();
  return result?.success === true;
}

// Rate limit sisi server melalui fungsi SQL consume_rate_limit.
export async function enforceRateLimit(
  db: ReturnType<typeof adminClient>,
  keyHash: string,
  action: string,
  limit: number,
  windowSeconds: number,
  message: string,
) {
  const { data, error } = await db.rpc("consume_rate_limit", {
    p_key: keyHash,
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.allowed) {
    throw new HttpError(429, "rate_limited", message, { retry_after: row?.retry_after_seconds ?? windowSeconds });
  }
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new HttpError(400, "bad_request", `${field} tidak valid.`);
  }
  return value.toLowerCase();
}

export function requireAnonId(value: unknown): string {
  if (typeof value !== "string" || value.length < 16 || value.length > 64) {
    throw new HttpError(400, "bad_request", "Identitas anonim tidak valid.");
  }
  return value;
}
