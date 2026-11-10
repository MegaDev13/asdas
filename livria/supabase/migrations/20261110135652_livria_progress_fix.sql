create or replace function private.save_reading_progress_impl(book_id uuid,page int,mode text,zoom real,scroll_ratio real,expected_updated_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved jsonb;
begin
 if auth.uid() is null or not private.can_book($1) then raise exception 'Livro indisponível.';end if;
 if $2>(select b.pages from public.books b where b.id=$1) then raise exception 'Página inválida.';end if;
 insert into public.reading_progress as p(user_id,book_id,page,mode,zoom,scroll_ratio) values(auth.uid(),$1,$2,$3,$4,$5)
 on conflict on constraint reading_progress_pkey do update set page=excluded.page,mode=excluded.mode,zoom=excluded.zoom,scroll_ratio=excluded.scroll_ratio
 where p.updated_at is not distinct from $6 returning to_jsonb(p.*) into saved;return saved;
end; $$;
