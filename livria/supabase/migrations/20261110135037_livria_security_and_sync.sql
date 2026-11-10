begin;
-- Optimistic concurrency: a stale device cannot silently overwrite newer progress.
create function public.save_reading_progress(book_id uuid,page int,mode text,zoom real,scroll_ratio real,expected_updated_at timestamptz default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved jsonb;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.';end if;
 insert into public.reading_progress as p(user_id,book_id,page,mode,zoom,scroll_ratio)
 values(auth.uid(),$1,$2,$3,$4,$5)
 on conflict(user_id,book_id) do update set page=excluded.page,mode=excluded.mode,zoom=excluded.zoom,scroll_ratio=excluded.scroll_ratio
 where p.updated_at is not distinct from $6 returning to_jsonb(p.*) into saved;
 return saved;
end; $$;
-- Revoke direct UPDATE/INSERT: all progress writes must perform concurrency checks.
revoke insert,update on public.reading_progress from authenticated;
-- The checked RPC executes as caller and uses a private implementation to write atomically.
alter function public.save_reading_progress(uuid,int,text,real,real,timestamptz) rename to save_reading_progress_impl;
alter function public.save_reading_progress_impl(uuid,int,text,real,real,timestamptz) set schema private;
alter function private.save_reading_progress_impl(uuid,int,text,real,real,timestamptz) security definer;
create function public.save_reading_progress(book_id uuid,page int,mode text,zoom real,scroll_ratio real,expected_updated_at timestamptz default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not private.can_book($1) then raise exception 'Livro indisponível.';end if;
 return private.save_reading_progress_impl($1,$2,$3,$4,$5,$6);
end; $$;
-- The private definer must enforce the same book authorization itself as defense in depth.
create or replace function private.save_reading_progress_impl(book_id uuid,page int,mode text,zoom real,scroll_ratio real,expected_updated_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved jsonb;
begin
 if auth.uid() is null or not private.can_book($1) then raise exception 'Livro indisponível.';end if;
 if $2>(select b.pages from public.books b where b.id=$1) then raise exception 'Página inválida.';end if;
 insert into public.reading_progress as p(user_id,book_id,page,mode,zoom,scroll_ratio) values(auth.uid(),$1,$2,$3,$4,$5)
 on conflict(user_id,book_id) do update set page=excluded.page,mode=excluded.mode,zoom=excluded.zoom,scroll_ratio=excluded.scroll_ratio
 where p.updated_at is not distinct from $6 returning to_jsonb(p.*) into saved;return saved;
end; $$;
create function private.shared_activity(reader_id uuid) returns table(book_id uuid,title text,author text) language sql stable security definer set search_path='' as $$
 select b.id,b.title,b.author from public.user_library l join public.books b on b.id=l.book_id join public.profiles p on p.id=l.user_id
 where auth.uid() is not null and l.user_id=$1 and l.shelf='reading' and p.share_activity and private.can_profile(p.id)
 and b.status='approved' and (b.visibility='community' or b.owner_id=auth.uid()) order by l.created_at desc limit 20;
$$;
create function public.shared_reading_activity(reader_id uuid) returns table(book_id uuid,title text,author text) language sql security invoker set search_path='' as $$select * from private.shared_activity($1);$$;
create function public.my_reading_statistics() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'total_seconds',(select coalesce(sum(seconds),0) from public.reading_sessions where user_id=auth.uid()),
 'observed_pages',(select count(distinct(book_id,page)) from public.reading_sessions where user_id=auth.uid()),
 'finished_books',(select count(*) from public.user_library where user_id=auth.uid() and shelf='finished'),
 'reading_books',(select count(*) from public.user_library where user_id=auth.uid() and shelf='reading'),
 'daily_minutes',(select daily_minutes from public.profile_settings where user_id=auth.uid()),
 'yearly_books',(select yearly_books from public.profile_settings where user_id=auth.uid()),
 'days',(select coalesce(jsonb_agg(x order by x.day),'[]'::jsonb) from (select (created_at at time zone 'America/Bahia')::date as day,sum(seconds) as seconds from public.reading_sessions where user_id=auth.uid() and created_at>now()-interval '400 days' group by 1) x));
$$;
create function private.session_guard() returns trigger language plpgsql set search_path='' as $$
declare last_time timestamptz;
begin
 if auth.uid() is null or new.user_id<>auth.uid() then raise exception 'Acesso negado.';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 select max(created_at) into last_time from public.reading_sessions where user_id=auth.uid();
 if last_time>now()-interval '10 seconds' then raise exception 'Sessão de leitura já registrada.';end if;
 new.created_at=now();
 if last_time is not null then new.seconds=least(new.seconds,greatest(0,floor(extract(epoch from now()-last_time))::int));end if;
 return new;
end; $$;
create trigger session_guard before insert on public.reading_sessions for each row execute function private.session_guard();
create function private.notify_follow() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.notifications(user_id,body,link) select new.following_id,case when new.approved then 'Um novo leitor começou a seguir você.' else 'Você recebeu uma solicitação para seguir seu perfil.' end,'/perfil'
 from public.profile_settings where user_id=new.following_id and notify_social;return new;
end; $$;
create trigger notify_follow after insert on public.user_follows for each row execute function private.notify_follow();
create function private.book_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or new.owner_id<>auth.uid() then raise exception 'Acesso negado.';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,2));
 if (select count(*) from public.books where owner_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'Limite de dez envios por hora.';end if;
 new.created_at=now();return new;
end; $$;
create trigger book_guard before insert on public.books for each row execute function private.book_guard();
revoke all on function private.save_reading_progress_impl(uuid,int,text,real,real,timestamptz),private.shared_activity(uuid),private.session_guard(),private.notify_follow(),private.book_guard() from public,anon,authenticated;
grant execute on function private.save_reading_progress_impl(uuid,int,text,real,real,timestamptz),private.shared_activity(uuid) to authenticated;
revoke all on function public.save_reading_progress(uuid,int,text,real,real,timestamptz),public.shared_reading_activity(uuid),public.my_reading_statistics() from public,anon;
grant execute on function public.save_reading_progress(uuid,int,text,real,real,timestamptz),public.shared_reading_activity(uuid),public.my_reading_statistics() to authenticated;
-- Private admin lookup intentionally has no user policies; only trusted helper reads it.
create policy deny_admin_table on private.admins for select to authenticated using(false);
commit;
