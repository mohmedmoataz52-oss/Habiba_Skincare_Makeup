-- Run in Supabase SQL Editor after backend-setup.sql.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('habiba-reels','habiba-reels',true,31457280,array['video/mp4','video/webm']) on conflict(id) do nothing;
drop policy if exists "habiba admin uploads reels" on storage.objects;
create policy "habiba admin uploads reels" on storage.objects for insert to authenticated
with check(bucket_id='habiba-reels' and exists(select 1 from public.habiba_admins where user_id=(select auth.uid())));
