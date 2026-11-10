-- User metadata supplies presentation only, never administrative authorization.
create or replace function private.new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,username,display_name) values(new.id,'leitor_'||substr(replace(new.id::text,'-',''),1,24),left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'Novo leitor'),80));
 insert into public.profile_settings(user_id) values(new.id);return new;
end; $$;
alter table public.profiles add constraint profile_accent_format check(accent ~ '^#[0-9a-fA-F]{6}$');
