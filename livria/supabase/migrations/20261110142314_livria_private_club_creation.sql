-- Direct ownership must be checked without a STABLE lookup so INSERT RETURNING
-- can see the creator's new private club within the same statement.
alter policy clubs_read on public.book_clubs using(owner_id=(select auth.uid()) or privacy='public' or private.in_club(id));
