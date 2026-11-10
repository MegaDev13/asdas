-- A minimal discovery card enables follow requests without exposing private bios,
-- images, reading activity or full profile rows.
create function private.profile_directory(search text default '',profile_id uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(x),'[]'::jsonb) from (
  select p.id,p.username,p.display_name,p.is_private,
   not private.can_profile(p.id) as locked,
   case when private.can_profile(p.id) then p.avatar_url end as avatar_url,
   case when private.can_profile(p.id) then p.tagline else 'Perfil privado' end as tagline
  from public.profiles p where auth.uid() is not null and not private.blocked(p.id)
   and ($2 is null or p.id=$2)
   and ($1='' or p.username ilike '%'||left($1,100)||'%' or p.display_name ilike '%'||left($1,100)||'%')
  order by p.created_at desc limit 40
 ) x;
$$;
create function public.profile_directory(search text default '',profile_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.profile_directory($1,$2);$$;
revoke all on function private.profile_directory(text,uuid) from public,anon;
grant execute on function private.profile_directory(text,uuid) to authenticated;
revoke all on function public.profile_directory(text,uuid) from public,anon;
grant execute on function public.profile_directory(text,uuid) to authenticated;
