# Textora

Microblogging anonim berbasis teks. Baca tanpa akun; untuk memposting cukup selesaikan verifikasi Cloudflare Turnstile.
Stack: Vite (JavaScript) · Supabase (PostgreSQL + Edge Functions) · Cloudflare Turnstile · Netlify.

## Fitur
- Feed publik (tab **Terbaru** dan **Untukmu** = paling disukai), pemuatan bertahap, status loading/kosong/error
- Posting 1–280 karakter dengan penghitung real-time, tanpa upload media
- Semua postingan tampil sebagai **Anonim**
- CAPTCHA diverifikasi di server, rate limit 3 postingan / 10 menit per IP (hash), tolak duplikat
- Like/batal Like (unik per identitas anonim, dikonfirmasi server)
- Laporkan postingan, dan panel moderator `/admin.html` (login Supabase Auth)
- Tema terang/gelap, responsif, RLS aktif di semua tabel

## Struktur
```
index.html · admin.html · vite.config.js · netlify.toml
src/        components, services, state, utils, styles
supabase/   migrations/001_create_tables.sql, functions/{create-post,toggle-like,my-likes,report-post}
```

## Menjalankan
### 1. Supabase
```bash
npm i -g supabase            # atau gunakan npx supabase
supabase login
supabase link --project-ref PROJECT_REF
supabase db push             # menjalankan migrations/001_create_tables.sql
```
Di dashboard: **Authentication → Providers → Email**, matikan *Allow new users to sign up* (akun moderator dibuat manual).

### 2. Turnstile
Buat widget di dashboard Cloudflare, lalu ambil **site key** dan **secret key**.
Untuk development lokal boleh memakai kunci uji Cloudflare: site key `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA` (selalu lolos).

### 3. Secret & deploy Edge Functions
```bash
supabase secrets set TURNSTILE_SECRET_KEY=... HASH_PEPPER=$(openssl rand -hex 32) \
  ALLOWED_ORIGINS=https://NAMA-SITUS.netlify.app,http://localhost:5173
supabase functions deploy create-post toggle-like my-likes report-post --no-verify-jwt
```
`HASH_PEPPER` wajib diisi dan dijaga stabil; mengubahnya membuat semua hash Like lama tidak cocok lagi.
Opsional: `POST_LIMIT` dan `POST_WINDOW_SECONDS` (default 3 dan 600).

### 4. Frontend
```bash
cp .env.example .env     # isi URL, publishable key, dan site key Turnstile
npm install
npm run dev              # http://localhost:5173
npm run build            # hasil di dist/
```

### 5. Netlify
Hubungkan repo GitHub. Build command `npm run build`, publish directory `dist`, lalu isi tiga variabel `VITE_*` di pengaturan Netlify.
Header keamanan dan CSP sudah ada di `netlify.toml`.

### 6. Moderator
Buat pengguna di **Authentication → Users**, lalu jalankan di SQL Editor:
```sql
insert into public.moderators (user_id)
select id from auth.users where email = 'moderator@contoh.com';
```
Masuk di `/admin.html`.

## Keamanan
- Tabel tidak menerima insert dari publik; semua tulis lewat Edge Function dengan `service_role` (otomatis tersedia di server).
- Secret tidak pernah masuk bundle frontend; hanya `VITE_*` publik yang dipakai browser.
- Konten dirender sebagai teks biasa (`textContent`), tidak pernah HTML.

## Keterbatasan
- Anonimitas tidak absolut: hosting dan penyedia layanan dapat memproses metadata teknis seperti IP.
- Identitas Like disimpan di browser; membersihkan data situs membuat identitas baru. Rate limit per IP menahan penyalahgunaan massal, tetapi pengguna di jaringan yang sama berbagi batas.
- CAPTCHA mengurangi bot, bukan jaminan; moderasi tetap diperlukan.
- Retensi data: PRD belum menetapkan kebijakan. Pertimbangkan `pg_cron` untuk membersihkan `rate_limits` lama dan laporan yang sudah ditinjau.
