begin;
-- A message cannot turn a known path belonging to another person into a shared attachment.
create function private.message_attachment_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.attachment_path is not null and (split_part(new.attachment_path,'/',1)<>auth.uid()::text or split_part(new.attachment_path,'/',2)<>new.conversation_id::text) then raise exception 'Anexo inválido.';end if;
 return new;
end; $$;
create trigger message_attachment_guard before insert on public.messages for each row execute function private.message_attachment_guard();
-- Authors cannot associate files with books they do not own.
create function private.audio_path_guard() returns trigger language plpgsql set search_path='' as $$
begin if split_part(new.path,'/',2)<>new.book_id::text then raise exception 'Arquivo de áudio inválido.';end if;return new;end; $$;
create trigger audio_path_guard before insert on public.audiobook_files for each row execute function private.audio_path_guard();
-- Invites are explicit, with acceptance by the invited account.
create table public.club_invites(
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.book_clubs on delete cascade,
 sender_id uuid not null references public.profiles on delete cascade,recipient_id uuid not null references public.profiles on delete cascade,
 created_at timestamptz not null default now(),unique(club_id,recipient_id)
);
create index club_invites_recipient_idx on public.club_invites(recipient_id);
alter table public.club_invites enable row level security;
revoke all on public.club_invites from anon,authenticated;
grant select,insert,delete on public.club_invites to authenticated;
create policy invites_read on public.club_invites for select to authenticated using(recipient_id=(select auth.uid()) or sender_id=(select auth.uid()));
create policy invites_insert on public.club_invites for insert to authenticated with check(sender_id=(select auth.uid()) and not private.blocked(recipient_id) and exists(select 1 from public.book_clubs c where c.id=club_id and c.owner_id=(select auth.uid())));
create policy invites_delete on public.club_invites for delete to authenticated using(recipient_id=(select auth.uid()) or sender_id=(select auth.uid()));
create function private.accept_invite(invite_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 if auth.uid() is null then raise exception 'Acesso negado.';end if;
 delete from public.club_invites where id=$1 and recipient_id=auth.uid() and not private.blocked(sender_id) returning club_id into cid;
 if cid is null then raise exception 'Convite indisponível.';end if;
 insert into public.club_members(club_id,user_id) values(cid,auth.uid()) on conflict do nothing;return cid;
end; $$;
create function public.accept_club_invite(invite_id uuid) returns uuid language sql security invoker set search_path='' as $$select private.accept_invite($1);$$;
create function private.notify_invite() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.notifications(user_id,body,link) values(new.recipient_id,'Você recebeu um convite para um clube de leitura.','/clubes');return new;end; $$;
create trigger notify_invite after insert on public.club_invites for each row execute function private.notify_invite();
-- Aggregate only rows readable by the caller. No definer view bypass.
create function public.conversation_summary() returns table(id uuid,created_at timestamptz,last_message timestamptz,unread bigint) language sql stable security invoker set search_path='' as $$
 select c.id,c.created_at,max(m.created_at),count(m.id) filter(where m.created_at>cm.last_read_at and m.user_id<>auth.uid())
 from public.conversations c join public.conversation_members cm on cm.conversation_id=c.id and cm.user_id=auth.uid()
 left join public.messages m on m.conversation_id=c.id where c.club_id is null group by c.id,cm.last_read_at order by coalesce(max(m.created_at),c.created_at) desc limit 100;
$$;
create function private.channel_access() returns boolean language sql stable security invoker set search_path='' as $$
 select private.in_conversation(case when (select realtime.topic()) ~ '^typing:[a-f0-9-]{36}$' then substr((select realtime.topic()),8)::uuid else null end);
$$;
create policy typing_receive on realtime.messages for select to authenticated using(extension='broadcast' and private.channel_access());
create policy typing_send on realtime.messages for insert to authenticated with check(extension='broadcast' and private.channel_access());
revoke all on function private.message_attachment_guard(),private.audio_path_guard(),private.accept_invite(uuid),private.notify_invite(),private.channel_access() from public,anon,authenticated;
grant execute on function private.accept_invite(uuid),private.channel_access() to authenticated;
revoke all on function public.accept_club_invite(uuid),public.conversation_summary() from public,anon;
grant execute on function public.accept_club_invite(uuid),public.conversation_summary() to authenticated;
alter publication supabase_realtime add table public.conversation_members;
commit;
