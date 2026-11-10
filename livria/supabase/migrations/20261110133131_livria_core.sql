-- LIVRIA. Fresh, isolated Supabase project. No production seeds.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon;

create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 username text not null unique check (username ~ '^[a-z0-9_]{3,32}$'),
 display_name text not null check (length(display_name) between 1 and 80),
 bio text not null default '' check(length(bio)<=1000), tagline text not null default '' check(length(tagline)<=160),
 avatar_url text, banner_url text, accent text not null default '#153f35', genres text[] not null default '{}',
 is_private boolean not null default false, share_activity boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.profile_settings (
 user_id uuid primary key references public.profiles on delete cascade,
 theme text not null default 'system' check(theme in ('system','light','dark','sepia')),
 notify_messages boolean not null default true, notify_social boolean not null default true,
 allow_dm boolean not null default true, daily_minutes int not null default 20 check(daily_minutes between 1 and 1440),
 yearly_books int not null default 12 check(yearly_books between 1 and 10000)
);
create table public.user_follows (
 follower_id uuid references public.profiles on delete cascade, following_id uuid references public.profiles on delete cascade,
 approved boolean not null default false, created_at timestamptz not null default now(),
 primary key(follower_id,following_id), check(follower_id<>following_id)
);
create index follows_target_idx on public.user_follows(following_id);
create table public.user_blocks (
 user_id uuid references public.profiles on delete cascade, blocked_id uuid references public.profiles on delete cascade,
 primary key(user_id,blocked_id),check(user_id<>blocked_id)
);
create index blocks_target_idx on public.user_blocks(blocked_id);
create table private.admins(user_id uuid primary key references auth.users on delete cascade);
alter table private.admins enable row level security;

create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from private.admins where user_id=auth.uid()); $$;
create function private.blocked(other_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.user_blocks where (user_id=auth.uid() and blocked_id=other_id) or (user_id=other_id and blocked_id=auth.uid())); $$;
create function private.can_profile(other_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select other_id=auth.uid() or exists(select 1 from public.profiles p where p.id=other_id and not private.blocked(other_id) and (not p.is_private or exists(select 1 from public.user_follows f where f.follower_id=auth.uid() and f.following_id=other_id and f.approved))); $$;

create table public.books (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles on delete cascade,
 title text not null check(length(title) between 1 and 200), author text not null check(length(author) between 1 and 200),
 synopsis text not null default '' check(length(synopsis)<=6000), category text not null default 'Literatura', language text not null default 'pt-BR',
 cover_url text, pdf_path text not null unique, sha256 text unique, pages int not null default 0 check(pages>=0),
 license text not null check(license in ('public_domain','creative_commons','author_permission','own_work')),
 license_details text not null check(length(license_details) between 3 and 2000), allow_download boolean not null default false,
 visibility text not null default 'private' check(visibility in ('private','community')),
 status text not null default 'draft' check(status in ('draft','pending','approved','rejected','hidden')),
 created_at timestamptz not null default now(),
 search tsvector generated always as (to_tsvector('portuguese', title||' '||author||' '||synopsis)) stored
);
create index books_search_idx on public.books using gin(search);
create index books_catalog_idx on public.books(status,visibility,created_at desc);
create index books_owner_idx on public.books(owner_id);
create function private.can_book(book_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.books b where b.id=book_id and (b.owner_id=auth.uid() or private.is_admin() or (b.status='approved' and b.visibility='community'))); $$;

create table public.user_library (
 user_id uuid references public.profiles on delete cascade, book_id uuid references public.books on delete cascade,
 shelf text not null default 'want' check(shelf in ('want','reading','finished','abandoned')),
 favorite boolean not null default false, created_at timestamptz not null default now(),primary key(user_id,book_id)
);
create index library_book_idx on public.user_library(book_id);
create table public.reading_progress (
 user_id uuid references public.profiles on delete cascade, book_id uuid references public.books on delete cascade,
 page int not null default 1 check(page>0), scroll_ratio real not null default 0 check(scroll_ratio between 0 and 1),
 mode text not null default 'paged' check(mode in ('paged','scroll','text')),
 zoom real not null default 1 check(zoom between 0.5 and 3), updated_at timestamptz not null default now(),
 primary key(user_id,book_id)
);
create table public.reading_sessions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,
 book_id uuid not null references public.books on delete cascade, seconds int not null check(seconds between 0 and 30),
 page int not null check(page>0),created_at timestamptz not null default now()
);
create index sessions_user_time_idx on public.reading_sessions(user_id,created_at desc);
create index sessions_book_idx on public.reading_sessions(book_id);
create table public.bookmarks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade,
 book_id uuid not null references public.books on delete cascade, page int not null check(page>0),label text not null default '' check(length(label)<=200),
 created_at timestamptz not null default now(),unique(user_id,book_id,page)
);
create table public.highlights (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,
 book_id uuid not null references public.books on delete cascade, page int not null check(page>0),
 quote text not null check(length(quote) between 1 and 10000), rects jsonb not null check(jsonb_typeof(rects)='array'),
 color text not null default 'yellow' check(color in ('yellow','green','pink')), note text not null default '' check(length(note)<=5000),created_at timestamptz not null default now()
);
create table public.reading_notes (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,
 book_id uuid not null references public.books on delete cascade,page int not null check(page>0),
 body text not null check(length(body) between 1 and 10000),created_at timestamptz not null default now()
);
create table public.audiobook_files (
 id uuid primary key default gen_random_uuid(), book_id uuid not null references public.books on delete cascade,
 owner_id uuid not null references public.profiles on delete cascade, title text not null check(length(title)<=200),
 path text not null unique, chapter int not null default 1 check(chapter>0),created_at timestamptz not null default now()
);
create index audio_book_idx on public.audiobook_files(book_id,chapter);
create table public.audio_progress (
 user_id uuid references public.profiles on delete cascade, audio_id uuid references public.audiobook_files on delete cascade,
 seconds double precision not null default 0 check(seconds>=0),updated_at timestamptz not null default now(),primary key(user_id,audio_id)
);

create table public.posts (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,
 body text not null check(length(body) between 1 and 5000),book_id uuid references public.books on delete set null,
 spoiler boolean not null default false,created_at timestamptz not null default now()
);
create index posts_time_idx on public.posts(created_at desc);
create index posts_user_idx on public.posts(user_id);
create table public.post_comments (
 id uuid primary key default gen_random_uuid(),post_id uuid not null references public.posts on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,body text not null check(length(body) between 1 and 2000),created_at timestamptz not null default now()
);
create index comments_post_idx on public.post_comments(post_id,created_at);
create table public.post_reactions (
 post_id uuid references public.posts on delete cascade,user_id uuid references public.profiles on delete cascade,primary key(post_id,user_id)
);
create table public.reviews (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,
 book_id uuid not null references public.books on delete cascade,rating int not null check(rating between 1 and 5),
 body text not null default '' check(length(body)<=5000),spoiler boolean not null default false,created_at timestamptz not null default now(),unique(user_id,book_id)
);
create index reviews_book_idx on public.reviews(book_id);

create table public.book_clubs (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles on delete cascade,
 name text not null check(length(name) between 3 and 100),description text not null default '' check(length(description)<=3000),
 rules text not null default '' check(length(rules)<=4000),privacy text not null default 'public' check(privacy in ('public','private','invite')),
 book_id uuid references public.books on delete set null,deadline date,created_at timestamptz not null default now()
);
create index clubs_owner_idx on public.book_clubs(owner_id);
create table public.club_members (
 club_id uuid references public.book_clubs on delete cascade,user_id uuid references public.profiles on delete cascade,
 role text not null default 'member' check(role in ('member','moderator','admin')),created_at timestamptz not null default now(),primary key(club_id,user_id)
);
create index club_members_user_idx on public.club_members(user_id);
create function private.in_club(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (exists(select 1 from public.book_clubs where id=cid and owner_id=auth.uid()) or exists(select 1 from public.club_members where club_id=cid and user_id=auth.uid())); $$;
create table public.conversations (
 id uuid primary key default gen_random_uuid(),direct_key text unique,club_id uuid unique references public.book_clubs on delete cascade,
 created_at timestamptz not null default now()
);
create table public.conversation_members (
 conversation_id uuid references public.conversations on delete cascade,user_id uuid references public.profiles on delete cascade,
 last_read_at timestamptz not null default now(), muted boolean not null default false,primary key(conversation_id,user_id)
);
create index conversation_members_user_idx on public.conversation_members(user_id);
create function private.in_conversation(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (exists(select 1 from public.conversation_members where conversation_id=cid and user_id=auth.uid()) or exists(select 1 from public.conversations where id=cid and private.in_club(club_id))); $$;
create table public.messages (
 id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.conversations on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,body text not null check(length(body) between 1 and 4000),
 attachment_path text,book_id uuid references public.books on delete set null,created_at timestamptz not null default now(),edited_at timestamptz
);
create index messages_conversation_time_idx on public.messages(conversation_id,created_at desc);
create index messages_user_idx on public.messages(user_id);
create table public.club_discussions (
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.book_clubs on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,title text not null check(length(title) between 1 and 200),
 body text not null check(length(body) between 1 and 5000),spoiler boolean not null default true,created_at timestamptz not null default now()
);
create index discussions_club_idx on public.club_discussions(club_id,created_at);
create table public.notifications (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,
 body text not null,link text,read boolean not null default false,created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id,created_at desc);
create table public.reports (
 id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles on delete set null,
 target_type text not null check(target_type in ('book','profile','post','message','club')),target_id uuid not null,
 reason text not null check(length(reason) between 3 and 2000),status text not null default 'open' check(status in ('open','resolved')),
 created_at timestamptz not null default now()
);
create table public.moderation_actions (
 id uuid primary key default gen_random_uuid(),admin_id uuid references public.profiles on delete set null,
 book_id uuid references public.books on delete set null,action text not null,created_at timestamptz not null default now()
);
create table public.app_versions (
 version text primary key,version_code int not null unique,notes text not null,apk_url text not null check(apk_url like 'https://%'),created_at timestamptz not null default now()
);

-- Triggers never trust client-set status, timestamps, or authorization claims.
create function private.new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,username,display_name) values(new.id,'leitor_'||replace(new.id::text,'-',''),'Novo leitor');
 insert into public.profile_settings(user_id) values(new.id);return new;
end; $$;
-- Trim generated username to fit the constraint.
create or replace function private.new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,username,display_name) values(new.id,'leitor_'||substr(replace(new.id::text,'-',''),1,24),'Novo leitor');
 insert into public.profile_settings(user_id) values(new.id);return new;
end; $$;
create trigger new_livria_user after insert on auth.users for each row execute function private.new_user();
create function private.follow_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then select not is_private into new.approved from public.profiles where id=new.following_id;
 elsif auth.uid()<>old.following_id then raise exception 'Somente o destinatário pode aprovar.';end if;
 if private.blocked(new.following_id) then raise exception 'Interação indisponível.';end if;return new;
end; $$;
create trigger follow_guard before insert or update on public.user_follows for each row execute function private.follow_guard();
create function private.progress_guard() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now();return new;end; $$;
create trigger progress_time before insert or update on public.reading_progress for each row execute function private.progress_guard();
create trigger audio_time before insert or update on public.audio_progress for each row execute function private.progress_guard();
create function private.club_conversation() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.conversations(club_id) values(new.id);return new;end; $$;
create trigger new_club after insert on public.book_clubs for each row execute function private.club_conversation();
create function private.message_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.in_conversation(new.conversation_id) then raise exception 'Acesso negado.';end if;
 if exists(select 1 from public.conversation_members where conversation_id=new.conversation_id and private.blocked(user_id)) then raise exception 'Interação indisponível.';end if;
 if tg_op='UPDATE' then
  if new.conversation_id<>old.conversation_id or new.user_id<>old.user_id or new.created_at<>old.created_at then raise exception 'Mensagem imutável.';end if;
  new.edited_at=now();
 else
  new.created_at=now();
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  if (select count(*) from public.messages where user_id=auth.uid() and created_at>now()-interval '1 minute')>=30 then raise exception 'Aguarde um minuto para continuar.';end if;
 end if;
 return new;
end; $$;
create trigger message_guard before insert or update on public.messages for each row execute function private.message_guard();
create function private.notify_message() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.notifications(user_id,body,link)
 select cm.user_id,'Você recebeu uma nova mensagem.','/mensagens/'||new.conversation_id from public.conversation_members cm
 join public.profile_settings s on s.user_id=cm.user_id where cm.conversation_id=new.conversation_id and cm.user_id<>new.user_id and not cm.muted and s.notify_messages;
 return new;
end; $$;
create trigger notify_message after insert on public.messages for each row execute function private.notify_message();

-- Atomic, authenticated operations. Definer implementation remains outside exposed schema.
create function private.open_dm(other_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; k text;
begin
 if auth.uid() is null or other_id=auth.uid() or private.blocked(other_id) or not private.can_profile(other_id) or not exists(select 1 from public.profile_settings where user_id=other_id and allow_dm) then raise exception 'Conversa indisponível.';end if;
 k=least(auth.uid()::text,other_id::text)||':'||greatest(auth.uid()::text,other_id::text);
 insert into public.conversations(direct_key) values(k) on conflict(direct_key) do update set direct_key=excluded.direct_key returning id into cid;
 insert into public.conversation_members(conversation_id,user_id) values(cid,auth.uid()),(cid,other_id) on conflict do nothing;return cid;
end; $$;
create function public.open_conversation(other_id uuid) returns uuid language sql security invoker set search_path='' as $$select private.open_dm(other_id);$$;
create function private.moderate_book(bid uuid,decision text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() or decision not in ('approved','rejected','hidden') then raise exception 'Acesso negado.';end if;
 if decision='approved' and not exists(select 1 from public.books where id=bid and sha256 is not null and pages>0) then raise exception 'Arquivo não validado.';end if;
 update public.books set status=decision where id=bid;
 insert into public.moderation_actions(admin_id,book_id,action) values(auth.uid(),bid,decision);
end; $$;
create function public.moderate_book(bid uuid,decision text) returns void language sql security invoker set search_path='' as $$select private.moderate_book(bid,decision);$$;
create function public.my_admin_status() returns boolean language sql security invoker set search_path='' as $$select private.is_admin();$$;

-- Enable RLS on every exposed table before granting access.
do $$declare t text;begin for t in select tablename from pg_tables where schemaname='public' loop execute format('alter table public.%I enable row level security',t);end loop;end$$;
create policy profiles_read on public.profiles for select to anon,authenticated using(private.can_profile(id));
create policy profiles_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy settings_own on public.profile_settings for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy follows_read on public.user_follows for select to authenticated using(follower_id=(select auth.uid()) or following_id=(select auth.uid()) or (approved and private.can_profile(follower_id) and private.can_profile(following_id)));
create policy follows_insert on public.user_follows for insert to authenticated with check(follower_id=(select auth.uid()) and not private.blocked(following_id));
create policy follows_update on public.user_follows for update to authenticated using(following_id=(select auth.uid())) with check(following_id=(select auth.uid()));
create policy follows_delete on public.user_follows for delete to authenticated using(follower_id=(select auth.uid()) or following_id=(select auth.uid()));
create policy blocks_own on public.user_blocks for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy books_read on public.books for select to anon,authenticated using(private.can_book(id));
create policy books_insert on public.books for insert to authenticated with check(owner_id=(select auth.uid()) and status='draft' and sha256 is null and split_part(pdf_path,'/',1)=(select auth.uid())::text and split_part(pdf_path,'/',2)=id::text);
create policy books_delete on public.books for delete to authenticated using(owner_id=(select auth.uid()));
-- Client cannot promote a book or replace an approved file. Finalization happens in Edge Function.
create policy books_update on public.books for update to authenticated using(owner_id=(select auth.uid()) and status='draft') with check(owner_id=(select auth.uid()) and status='draft' and sha256 is null);
do $$declare t text;begin foreach t in array array['user_library','reading_progress','reading_sessions','bookmarks','highlights','reading_notes'] loop
 execute format('create policy own_read on public.%I for select to authenticated using(user_id=(select auth.uid()))',t);
 execute format('create policy own_insert on public.%I for insert to authenticated with check(user_id=(select auth.uid()) and private.can_book(book_id))',t);
 execute format('create policy own_update on public.%I for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and private.can_book(book_id))',t);
 execute format('create policy own_delete on public.%I for delete to authenticated using(user_id=(select auth.uid()))',t);
end loop;end$$;
create policy audio_read on public.audiobook_files for select to authenticated using(private.can_book(book_id));
create policy audio_insert on public.audiobook_files for insert to authenticated with check(owner_id=(select auth.uid()) and exists(select 1 from public.books where id=book_id and owner_id=(select auth.uid())) and split_part(path,'/',1)=(select auth.uid())::text);
create policy audio_delete on public.audiobook_files for delete to authenticated using(owner_id=(select auth.uid()));
create policy audio_progress_own on public.audio_progress for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.audiobook_files where id=audio_id));
create policy posts_read on public.posts for select to authenticated using(private.can_profile(user_id));
create policy posts_insert on public.posts for insert to authenticated with check(user_id=(select auth.uid()) and (book_id is null or private.can_book(book_id)));
create policy posts_delete on public.posts for delete to authenticated using(user_id=(select auth.uid()));
create policy comments_read on public.post_comments for select to authenticated using(exists(select 1 from public.posts where id=post_id));
create policy comments_insert on public.post_comments for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.posts where id=post_id));
create policy comments_delete on public.post_comments for delete to authenticated using(user_id=(select auth.uid()));
create policy reactions_read on public.post_reactions for select to authenticated using(exists(select 1 from public.posts where id=post_id));
create policy reactions_insert on public.post_reactions for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.posts where id=post_id));
create policy reactions_delete on public.post_reactions for delete to authenticated using(user_id=(select auth.uid()));
create policy reviews_read on public.reviews for select to authenticated using(private.can_profile(user_id) and private.can_book(book_id));
create policy reviews_insert on public.reviews for insert to authenticated with check(user_id=(select auth.uid()) and private.can_book(book_id));
create policy reviews_update on public.reviews for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and private.can_book(book_id));
create policy reviews_delete on public.reviews for delete to authenticated using(user_id=(select auth.uid()));
create policy clubs_read on public.book_clubs for select to authenticated using(privacy='public' or private.in_club(id));
create policy clubs_insert on public.book_clubs for insert to authenticated with check(owner_id=(select auth.uid()) and (book_id is null or private.can_book(book_id)));
create policy clubs_update on public.book_clubs for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy clubs_delete on public.book_clubs for delete to authenticated using(owner_id=(select auth.uid()));
create policy club_members_read on public.club_members for select to authenticated using(private.in_club(club_id) or exists(select 1 from public.book_clubs where id=club_id and privacy='public'));
create policy club_members_insert on public.club_members for insert to authenticated with check(role='member' and user_id=(select auth.uid()) and exists(select 1 from public.book_clubs where id=club_id and privacy='public'));
create policy club_members_delete on public.club_members for delete to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.book_clubs where id=club_id and owner_id=(select auth.uid())));
create policy conversations_read on public.conversations for select to authenticated using(private.in_conversation(id));
create policy conv_members_read on public.conversation_members for select to authenticated using(private.in_conversation(conversation_id));
create policy conv_members_update on public.conversation_members for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy messages_read on public.messages for select to authenticated using(private.in_conversation(conversation_id) and not private.blocked(user_id));
create policy messages_insert on public.messages for insert to authenticated with check(user_id=(select auth.uid()) and private.in_conversation(conversation_id));
create policy messages_update on public.messages for update to authenticated using(user_id=(select auth.uid()) and private.in_conversation(conversation_id)) with check(user_id=(select auth.uid()) and private.in_conversation(conversation_id));
create policy messages_delete on public.messages for delete to authenticated using(user_id=(select auth.uid()) and private.in_conversation(conversation_id));
create policy discussions_read on public.club_discussions for select to authenticated using(private.in_club(club_id));
create policy discussions_insert on public.club_discussions for insert to authenticated with check(user_id=(select auth.uid()) and private.in_club(club_id));
create policy discussions_delete on public.club_discussions for delete to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.book_clubs where id=club_id and owner_id=(select auth.uid())));
create policy notifications_read on public.notifications for select to authenticated using(user_id=(select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy reports_insert on public.reports for insert to authenticated with check(user_id=(select auth.uid()) and status='open');
create policy reports_read on public.reports for select to authenticated using(user_id=(select auth.uid()) or private.is_admin());
create policy reports_update on public.reports for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy moderation_read on public.moderation_actions for select to authenticated using(private.is_admin());
create policy versions_read on public.app_versions for select to anon,authenticated using(true);

revoke all on all tables in schema public from anon,authenticated;
grant select on public.profiles,public.books,public.app_versions to anon;
grant select on all tables in schema public to authenticated;
grant update(display_name,username,bio,tagline,avatar_url,banner_url,accent,genres,is_private,share_activity) on public.profiles to authenticated;
grant insert,update,delete on public.profile_settings,public.user_library,public.reading_progress,public.bookmarks,public.highlights,public.reading_notes,public.audio_progress,public.reviews to authenticated;
grant insert,delete on public.user_blocks,public.posts,public.post_comments,public.post_reactions,public.audiobook_files,public.club_members to authenticated;
grant insert on public.reading_sessions to authenticated;
grant insert,delete on public.books,public.user_follows,public.book_clubs,public.messages,public.club_discussions to authenticated;
grant update(title,author,synopsis,category,language,cover_url,license,license_details,visibility,allow_download) on public.books to authenticated;
grant update(approved) on public.user_follows to authenticated;
grant update(name,description,rules,book_id,deadline) on public.book_clubs to authenticated;
grant update(last_read_at,muted) on public.conversation_members to authenticated;
grant update(body,edited_at) on public.messages to authenticated;
grant update(read) on public.notifications to authenticated;
grant insert on public.reports to authenticated;
grant update(status) on public.reports to authenticated;
revoke all on all functions in schema private from public;
grant execute on function private.is_admin(),private.blocked(uuid),private.can_profile(uuid),private.can_book(uuid),private.in_club(uuid),private.in_conversation(uuid) to authenticated,anon;
grant execute on function private.open_dm(uuid),private.moderate_book(uuid,text) to authenticated;
revoke all on function public.open_conversation(uuid),public.moderate_book(uuid,text),public.my_admin_status() from public,anon;
grant execute on function public.open_conversation(uuid),public.moderate_book(uuid,text),public.my_admin_status() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('book-files','book-files',false,20971520,array['application/pdf']),
 ('book-covers','book-covers',true,5242880,array['image/jpeg','image/png','image/webp']),
 ('profile-images','profile-images',true,5242880,array['image/jpeg','image/png','image/webp']),
 ('message-attachments','message-attachments',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('audiobook-files','audiobook-files',false,52428800,array['audio/mpeg','audio/mp4','audio/ogg','audio/wav']);
create policy images_read on storage.objects for select to anon,authenticated using(bucket_id in ('book-covers','profile-images'));
create policy images_insert on storage.objects for insert to authenticated with check(bucket_id in ('book-covers','profile-images') and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy images_delete on storage.objects for delete to authenticated using(bucket_id in ('book-covers','profile-images') and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy pdf_read on storage.objects for select to authenticated using(bucket_id='book-files' and exists(select 1 from public.books b where b.pdf_path=name and b.status='approved' and private.can_book(b.id)));
create policy pdf_insert on storage.objects for insert to authenticated with check(bucket_id='book-files' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.books b where b.pdf_path=name and b.owner_id=(select auth.uid()) and b.status='draft'));
create policy pdf_delete on storage.objects for delete to authenticated using(bucket_id='book-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy attachments_insert on storage.objects for insert to authenticated with check(bucket_id='message-attachments' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.conversations c where c.id::text=(storage.foldername(name))[2] and private.in_conversation(c.id)));
create policy attachments_read on storage.objects for select to authenticated using(bucket_id='message-attachments' and exists(select 1 from public.messages m where m.attachment_path=name and private.in_conversation(m.conversation_id) and not private.blocked(m.user_id)));
create policy audio_files_read on storage.objects for select to authenticated using(bucket_id='audiobook-files' and exists(select 1 from public.audiobook_files a join public.books b on b.id=a.book_id where a.path=name and b.status='approved' and private.can_book(b.id)));
create policy audio_files_insert on storage.objects for insert to authenticated with check(bucket_id='audiobook-files' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.books b where b.id::text=(storage.foldername(name))[2] and b.owner_id=(select auth.uid())));
create policy audio_files_delete on storage.objects for delete to authenticated using(bucket_id='audiobook-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
alter publication supabase_realtime add table public.messages,public.posts,public.notifications,public.club_discussions;
commit;
