-- Run once in the Supabase SQL Editor of a NEW/dedicated Habiba project.
begin;
create table if not exists public.habiba_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.habiba_store (
  id integer primary key check (id = 1),
  document jsonb not null,
  revision integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint habiba_document_shape check (
    jsonb_typeof(document) = 'object' and
    jsonb_typeof(document->'products') = 'array' and
    jsonb_typeof(document->'bundles') = 'array' and
    jsonb_typeof(document->'settings') = 'object'
  )
);
alter table public.habiba_admins enable row level security;
alter table public.habiba_store enable row level security;
revoke all on public.habiba_admins, public.habiba_store from anon, authenticated;
grant select on public.habiba_admins to authenticated;
grant select on public.habiba_store to anon, authenticated;
-- Only an administrator can update. No browser role can insert/delete the store row or admin memberships.
grant update(document,revision,updated_at) on public.habiba_store to authenticated;
drop policy if exists "admin reads own membership" on public.habiba_admins;
create policy "admin reads own membership" on public.habiba_admins for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "public catalogue read" on public.habiba_store;
create policy "public catalogue read" on public.habiba_store for select to anon, authenticated using (id = 1);
drop policy if exists "admin catalogue update" on public.habiba_store;
create policy "admin catalogue update" on public.habiba_store for update to authenticated
using (exists(select 1 from public.habiba_admins where user_id=(select auth.uid())))
with check (id=1 and exists(select 1 from public.habiba_admins where user_id=(select auth.uid())));
insert into public.habiba_store(id,document) values (1,'{"products":[],"bundles":[],"settings":{"shippingThreshold":1000,"defaultDiscount":10,"promoEnabled":true,"promoLabel":"SALE 10%","storeName":"Habiba Skin Care","announcementText":"حبيبة ✦ BEAUTY IN EVERY DETAIL","tickerSpeed":28}}') on conflict(id) do nothing;
create or replace function public.habiba_save_store(p_document jsonb,p_revision integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare saved public.habiba_store;
begin
  if auth.uid() is null or not exists(select 1 from public.habiba_admins where user_id=auth.uid()) then
    raise exception 'غير مسموح بتعديل المتجر' using errcode='42501';
  end if;
  if not (p_document ?& array['products','bundles','settings']) or
     jsonb_typeof(p_document->'products') <> 'array' or
     jsonb_typeof(p_document->'bundles') <> 'array' or
     jsonb_typeof(p_document->'settings') <> 'object' then
    raise exception 'Invalid catalogue';
  end if;
  if octet_length(p_document::text) > 15000000 then raise exception 'الكتالوج كبير جدًا؛ استخدم روابط صور أصغر'; end if;
  update public.habiba_store set document=p_document,revision=revision+1,updated_at=now()
  where id=1 and revision=p_revision returning * into saved;
  if not found then raise exception 'اتغيرت البيانات من جلسة تانية. صدّر تعديلاتك كنسخة احتياطية ثم أعد تحميل الصفحة.' using errcode='40001'; end if;
  return jsonb_build_object('document',saved.document,'revision',saved.revision,'updated_at',saved.updated_at);
end $$;
revoke all on function public.habiba_save_store(jsonb,integer) from public,anon;
grant execute on function public.habiba_save_store(jsonb,integer) to authenticated;
commit;
-- AFTER creating your admin user in Authentication > Users, run with its actual UUID:
-- insert into public.habiba_admins(user_id) values ('YOUR-ADMIN-USER-UUID');
