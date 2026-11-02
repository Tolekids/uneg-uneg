-- Uneg-Uneg — Skema tabel comments
create table if not exists public.comments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts (id) on delete cascade,
  content      text not null,
  author_label text not null default 'Anonim',
  created_at   timestamptz not null default now(),
  constraint comments_content_len check (char_length(content) between 1 and 280),
  constraint comments_content_text check (content ~ '\S'),
  constraint comments_author_label check (author_label = 'Anonim')
);

create index if not exists comments_post_id_idx on public.comments (post_id, created_at asc);

-- Row Level Security (RLS)
alter table public.comments enable row level security;

-- Grant permissions ke anon dan authenticated
grant select, insert on public.comments to anon, authenticated;

-- Policy membaca komentar
drop policy if exists "publik membaca komentar" on public.comments;
create policy "publik membaca komentar"
  on public.comments for select to anon, authenticated
  using (true);

-- Policy membuat komentar anonim
drop policy if exists "publik membuat komentar" on public.comments;
create policy "publik membuat komentar"
  on public.comments for insert to anon, authenticated
  with check (
    author_label = 'Anonim'
    and char_length(content) between 1 and 280
  );
