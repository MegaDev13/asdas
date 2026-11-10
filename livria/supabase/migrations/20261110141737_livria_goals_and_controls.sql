begin;
update storage.buckets set public=false where id='profile-images';
alter policy images_read on storage.objects using(bucket_id='book-covers');
create policy profile_images_read on storage.objects for select to anon,authenticated using(bucket_id='profile-images' and exists(select 1 from public.profiles p where p.id::text=(storage.foldername(name))[1] and private.can_profile(p.id)));
alter table public.user_library add column finished_at timestamptz;
create function private.library_finished() returns trigger language plpgsql set search_path='' as $$
begin
 if new.shelf='finished' then
  if tg_op='INSERT' then new.finished_at=now();elsif old.shelf<>'finished' then new.finished_at=now();else new.finished_at=old.finished_at;end if;
 else new.finished_at=null;end if;return new;
end; $$;
create trigger library_finished before insert or update on public.user_library for each row execute function private.library_finished();
create or replace function public.my_reading_statistics() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'total_seconds',(select coalesce(sum(seconds),0) from public.reading_sessions where user_id=auth.uid()),
 'observed_pages',(select count(distinct(book_id,page)) from public.reading_sessions where user_id=auth.uid()),
 'finished_books',(select count(*) from public.user_library where user_id=auth.uid() and shelf='finished'),
 'year_finished_books',(select count(*) from public.user_library where user_id=auth.uid() and shelf='finished' and extract(year from finished_at at time zone 'America/Bahia')=extract(year from now() at time zone 'America/Bahia')),
 'reading_books',(select count(*) from public.user_library where user_id=auth.uid() and shelf='reading'),
 'daily_minutes',(select daily_minutes from public.profile_settings where user_id=auth.uid()),
 'yearly_books',(select yearly_books from public.profile_settings where user_id=auth.uid()),
 'days',(select coalesce(jsonb_agg(x order by x.day),'[]'::jsonb) from (select (created_at at time zone 'America/Bahia')::date as day,sum(seconds) as seconds from public.reading_sessions where user_id=auth.uid() and created_at>now()-interval '400 days' group by 1) x));
$$;
revoke all on function private.library_finished() from public,anon,authenticated;
-- Rate limits use database time and locks, not client clocks.
create function private.social_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare n int;
begin
 if auth.uid() is null or new.user_id<>auth.uid() then raise exception 'Acesso negado.';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,3));
 execute format('select count(*) from public.%I where user_id=$1 and created_at>now()-interval ''1 minute''',tg_table_name) into n using auth.uid();
 if n>=10 then raise exception 'Aguarde um minuto antes de publicar novamente.';end if;
 new.created_at=now();return new;
end; $$;
create trigger posts_rate before insert on public.posts for each row execute function private.social_guard();
create trigger comments_rate before insert on public.post_comments for each row execute function private.social_guard();
create trigger reports_rate before insert on public.reports for each row execute function private.social_guard();
revoke all on function private.social_guard() from public,anon,authenticated;
-- Common foreign-key lookups.
create index bookmarks_book_idx on public.bookmarks(book_id);
create index bookmarks_user_idx on public.bookmarks(user_id);
create index highlights_book_idx on public.highlights(book_id);
create index highlights_user_idx on public.highlights(user_id);
create index notes_book_idx on public.reading_notes(book_id);
create index notes_user_idx on public.reading_notes(user_id);
create index reports_user_idx on public.reports(user_id);
create index reviews_user_idx on public.reviews(user_id);
create index reactions_user_idx on public.post_reactions(user_id);
create index comments_user_idx on public.post_comments(user_id);
create index audio_progress_audio_idx on public.audio_progress(audio_id);
create index audio_owner_idx on public.audiobook_files(owner_id);
create index invites_sender_idx on public.club_invites(sender_id);
create index clubs_book_idx on public.book_clubs(book_id);
create index moderation_admin_idx on public.moderation_actions(admin_id);
create index moderation_book_idx on public.moderation_actions(book_id);
create index posts_book_idx on public.posts(book_id);
create index messages_book_idx on public.messages(book_id);
commit;
