-- Textora — skema database awal
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- posts
create table public.posts (
  id           uuid primary key default gen_random_uuid(),
  content      text not null,
  author_label text not null default 'Anonim',
  created_at   timestamptz not null default now(),
  status       text not null default 'published',
  like_count   integer not null default 0,
  constraint posts_content_len   check (char_length(content) between 1 and 280),
  constraint posts_content_text  check (content ~ '\S'),
  constraint posts_author_label  check (author_label = 'Anonim'),
  constraint posts_status_valid  check (status in ('published', 'hidden')),
  constraint posts_like_nonneg   check (like_count >= 0)
);

create index posts_feed_latest_idx  on public.posts (status, created_at desc, id desc);
create index posts_feed_popular_idx on public.posts (status, like_count desc, created_at desc, id desc);

-- ---------------------------------------------------------------- likes
create table public.likes (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid not null references public.posts (id) on delete cascade,
  anonymous_id_hash text not null,
  created_at        timestamptz not null default now(),
  constraint likes_one_per_identity unique (post_id, anonymous_id_hash)
);

create index likes_identity_idx on public.likes (anonymous_id_hash, post_id);

-- Jumlah Like dijaga oleh trigger, bukan oleh klien.
create or replace function public.sync_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger likes_sync_count
after insert or delete on public.likes
for each row execute function public.sync_like_count();

-- -------------------------------------------------------------- reports
create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.posts (id) on delete cascade,
  reason        text not null,
  details       text,
  reporter_hash text not null,
  created_at    timestamptz not null default now(),
  status        text not null default 'pending',
  constraint reports_reason_valid  check (reason in ('spam', 'harassment', 'violence', 'personal_info', 'other')),
  constraint reports_details_len   check (details is null or char_length(details) <= 500),
  constraint reports_status_valid  check (status in ('pending', 'reviewed', 'dismissed')),
  constraint reports_one_per_identity unique (post_id, reporter_hash)
);

create index reports_status_idx on public.reports (status, created_at desc);

-- ---------------------------------------------------------- rate limits
create table public.rate_limits (
  id         bigint generated always as identity primary key,
  key_hash   text not null,
  action     text not null,
  created_at timestamptz not null default now()
);

create index rate_limits_lookup_idx on public.rate_limits (key_hash, action, created_at);

-- Mencatat satu percobaan jika masih di bawah batas. Hanya bisa dipanggil
-- oleh service_role (Edge Function), tidak oleh pengunjung.
create or replace function public.consume_rate_limit(
  p_key text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count  integer;
  v_oldest timestamptz;
  v_window interval := make_interval(secs => p_window_seconds);
begin
  perform pg_advisory_xact_lock(hashtextextended(p_action || ':' || p_key, 0));

  delete from public.rate_limits
  where key_hash = p_key and action = p_action and created_at < now() - v_window;

  select count(*), min(created_at) into v_count, v_oldest
  from public.rate_limits
  where key_hash = p_key and action = p_action;

  if v_count >= p_limit then
    return query select false, greatest(ceil(extract(epoch from (v_oldest + v_window - now())))::integer, 1);
    return;
  end if;

  insert into public.rate_limits (key_hash, action) values (p_key, p_action);
  return query select true, 0;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;

-- ----------------------------------------------------------- moderators
create table public.moderators (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.moderators where user_id = auth.uid());
$$;

grant execute on function public.is_moderator() to authenticated;

-- ------------------------------------------------- Row Level Security
alter table public.posts       enable row level security;
alter table public.likes       enable row level security;
alter table public.reports     enable row level security;
alter table public.rate_limits enable row level security;
alter table public.moderators  enable row level security;

-- Cabut semua hak bawaan, lalu beri hanya yang dibutuhkan.
revoke all on public.posts, public.likes, public.reports, public.rate_limits, public.moderators from anon, authenticated;

-- posts: publik hanya membaca yang berstatus published.
grant select on public.posts to anon, authenticated;
create policy "publik membaca postingan published"
  on public.posts for select to anon, authenticated
  using (status = 'published');

-- posts: moderator membaca semua, mengubah status saja, dan menghapus.
grant update (status) on public.posts to authenticated;
grant delete on public.posts to authenticated;
create policy "moderator membaca semua postingan"
  on public.posts for select to authenticated
  using (public.is_moderator());
create policy "moderator mengubah status postingan"
  on public.posts for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());
create policy "moderator menghapus postingan"
  on public.posts for delete to authenticated
  using (public.is_moderator());

-- reports: hanya moderator. Pengiriman laporan lewat Edge Function.
grant select on public.reports to authenticated;
grant update (status) on public.reports to authenticated;
create policy "moderator membaca laporan"
  on public.reports for select to authenticated
  using (public.is_moderator());
create policy "moderator memperbarui status laporan"
  on public.reports for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

-- moderators: pengguna login hanya bisa melihat barisnya sendiri.
grant select on public.moderators to authenticated;
create policy "melihat status moderator sendiri"
  on public.moderators for select to authenticated
  using (user_id = auth.uid());

-- likes dan rate_limits: tanpa policy = tertutup untuk API publik.
-- Hanya service_role (Edge Function) yang bisa mengaksesnya.
