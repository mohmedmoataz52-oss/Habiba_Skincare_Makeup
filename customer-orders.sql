-- Habiba customers and COD orders. Run AFTER backend-setup.sql.
-- No public customer lists, card details, or browser-controlled prices.
begin;
create table if not exists public.habiba_customers(
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null, full_name text not null default '', phone text not null default '',
 whatsapp_marketing boolean not null default false,email_marketing boolean not null default false,
 consent_at timestamptz,consent_version text not null default '2026-10-v1',
 welcome_used boolean not null default false,created_at timestamptz not null default now()
);
create table if not exists public.habiba_orders(
 id uuid primary key default gen_random_uuid(), customer_id uuid references auth.users(id) on delete set null,
 request_id uuid not null, details jsonb not null,
 status text not null default 'pending' check(status in('pending','confirmed','processing','shipped','completed','cancelled')),
 payment_method text not null default 'cod' check(payment_method='cod'),
 payment_status text not null default 'unpaid',created_at timestamptz not null default now(),
 unique(customer_id,request_id)
);
create index if not exists habiba_orders_customer_time on public.habiba_orders(customer_id,created_at desc);
create index if not exists habiba_orders_created on public.habiba_orders(created_at desc);
alter table public.habiba_customers enable row level security;
alter table public.habiba_orders enable row level security;
revoke all on public.habiba_customers,public.habiba_orders from anon,authenticated;
grant select on public.habiba_customers,public.habiba_orders to authenticated;
drop policy if exists "customer private profile" on public.habiba_customers;
create policy "customer private profile" on public.habiba_customers for select to authenticated using(id=(select auth.uid()) or exists(select 1 from public.habiba_admins where user_id=(select auth.uid())));
drop policy if exists "customer private orders" on public.habiba_orders;
create policy "customer private orders" on public.habiba_orders for select to authenticated using(customer_id=(select auth.uid()) or exists(select 1 from public.habiba_admins where user_id=(select auth.uid())));
create or replace function public.habiba_customer_created() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.habiba_customers(id,email,full_name,phone,whatsapp_marketing,email_marketing,consent_at)
 values(new.id,coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'full_name',''),160),left(coalesce(new.raw_user_meta_data->>'phone',''),25),coalesce(new.raw_user_meta_data->>'whatsapp_marketing','false')='true',coalesce(new.raw_user_meta_data->>'email_marketing','false')='true',now()) on conflict(id) do nothing;
 return new;
end $$;
revoke all on function public.habiba_customer_created() from public,anon,authenticated;
drop trigger if exists habiba_customer_on_signup on auth.users;
create trigger habiba_customer_on_signup after insert on auth.users for each row execute function public.habiba_customer_created();
insert into public.habiba_customers(id,email) select id,coalesce(email,'') from auth.users on conflict(id) do nothing;
create or replace function public.habiba_marketing_preferences(p_whatsapp boolean,p_email boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 update public.habiba_customers set whatsapp_marketing=coalesce(p_whatsapp,false),email_marketing=coalesce(p_email,false),consent_at=now() where id=auth.uid();
end $$;
revoke all on function public.habiba_marketing_preferences(boolean,boolean) from public,anon;
grant execute on function public.habiba_marketing_preferences(boolean,boolean) to authenticated;
create or replace function public.habiba_checkout(p_cart jsonb,p_delivery jsonb,p_request_id uuid,p_commit boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); cfg jsonb; products jsonb; bundles jsonb; settings jsonb; offer jsonb; c public.habiba_customers;
 line jsonb; product jsonb; item_id text; qty integer; unit_price numeric; regular numeric; subtotal numeric:=0;
 eligible numeric:=0; discount numeric:=0; global_discount numeric:=0; welcome_discount numeric:=0;
 shipping numeric; threshold numeric; pct numeric; total numeric; stock integer; item_list jsonb:='[]';
 result jsonb; previous public.habiba_orders; order_id uuid; city text; consumed boolean:=false; seen text[]:='{}'; idx integer;
 rates jsonb:='{"Cairo":80,"Giza":80,"Alexandria":95,"Ismailia":95,"Kafr El Sheikh":95,"Damietta":95,"Benha":95,"Beheira":95,"Sharqia":95,"Gharbia":95,"Tanta":95,"Mansoura":95,"Suez":95,"Port Said":95,"Qalyubia":95,"Menoufia":95,"Dakahlia":95,"Zagazig":95,"10th of Ramadan":95,"Qena":110,"Sohag":110,"Aswan":110,"Marsa Matrouh":110,"Minya":110,"North Coast":110,"Luxor":110,"Fayoum":110,"Assiut":110,"Beni Suef":110,"South Sinai":140,"Red Sea":140,"Sharm El Sheikh":140,"Hurghada":140}';
begin
 if uid is null then raise exception 'سجّل دخولك لإتمام الطلب'; end if;
 if not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'أكد الإيميل الأول'; end if;
 select * into c from public.habiba_customers where id=uid for update;
 if not found then raise exception 'ملف العميل غير جاهز؛ شغّل customer-orders.sql'; end if;
 if p_commit then
   select * into previous from public.habiba_orders where customer_id=uid and request_id=p_request_id;
   if found then return previous.details||jsonb_build_object('id',previous.id,'status',previous.status); end if;
 end if;
 if p_cart is null or jsonb_typeof(p_cart)<>'array' or jsonb_array_length(p_cart) not between 1 and 50 then raise exception 'السلة فارغة أو غير صالحة'; end if;
 if p_commit then select document into cfg from public.habiba_store where id=1 for update;
 else select document into cfg from public.habiba_store where id=1; end if;
 products:=cfg->'products';bundles:=cfg->'bundles';settings:=cfg->'settings';offer:=settings->'welcomeOffer';
 city:=p_delivery->>'city';shipping:=coalesce((settings->'shippingRates'->>city)::numeric,(rates->>city)::numeric);
 if shipping is null or shipping<0 then raise exception 'اختار منطقة شحن صحيحة'; end if;
 if p_commit and (length(coalesce(p_delivery->>'firstName',''))<1 or length(coalesce(p_delivery->>'lastName',''))<1 or length(coalesce(p_delivery->>'address',''))<5 or coalesce(p_delivery->>'phone','')!~ '^\+?[0-9 ()-]{10,20}$') then raise exception 'راجع الاسم والعنوان ورقم التليفون'; end if;
 if octet_length(p_delivery::text)>12000 then raise exception 'بيانات العنوان طويلة جدًا'; end if;
 for line in select value from jsonb_array_elements(p_cart) loop
   item_id:=line->>'id';qty:=(line->>'quantity')::integer;
   if qty is null or qty not between 1 and 99 or item_id is null or item_id=any(seen) then raise exception 'راجع كميات السلة'; end if;seen:=array_append(seen,item_id);
   product:=null;
   if left(item_id,7)='bundle-' then
     select value into product from jsonb_array_elements(bundles) where value->>'id'=substring(item_id from 8) limit 1;
   else
     select value into product from jsonb_array_elements(products) where value->>'id'=item_id limit 1;
   end if;
   if product is null then raise exception 'منتج اتحذف؛ راجع السلة'; end if;
   stock:=nullif(product->>'stock','')::integer;
   if stock is not null and stock<qty then raise exception 'الكمية المطلوبة غير متاحة: %',product->>'name'; end if;
   regular:=(product->>'price')::numeric;
   unit_price:=coalesce(nullif(product->>'salePrice','')::numeric,regular);
   if unit_price is null or unit_price<0 then raise exception 'سعر المنتج غير صالح'; end if;
   subtotal:=subtotal+unit_price*qty;
   if left(item_id,7)<>'bundle-' and (nullif(product->>'salePrice','') is null or unit_price>=regular) and
      (coalesce((offer->>'allProducts')::boolean,true) or coalesce(offer->'productIds','[]'::jsonb)?item_id) then eligible:=eligible+unit_price*qty; end if;
   item_list:=item_list||jsonb_build_array(jsonb_build_object('id',item_id,'name',product->>'name','price',unit_price,'quantity',qty,'lineTotal',unit_price*qty));
   if p_commit and stock is not null and left(item_id,7)<>'bundle-' then
     select ordinality::integer-1 into idx from jsonb_array_elements(products) with ordinality where value->>'id'=item_id;
     products:=jsonb_set(products,array[idx::text,'stock'],to_jsonb(stock-qty));
   elsif p_commit and stock is not null and left(item_id,7)='bundle-' then
     select ordinality::integer-1 into idx from jsonb_array_elements(bundles) with ordinality where value->>'id'=substring(item_id from 8);
     bundles:=jsonb_set(bundles,array[idx::text,'stock'],to_jsonb(stock-qty));
   end if;
 end loop;
 if coalesce((settings->>'promoEnabled')::boolean,false) then global_discount:=round(subtotal*least(100,greatest(0,coalesce((settings->>'defaultDiscount')::numeric,0)))/100,2); end if;
 if coalesce((offer->>'enabled')::boolean,false) and not c.welcome_used and not exists(select 1 from public.habiba_orders where customer_id=uid and status<>'cancelled') then
   pct:=least(90,greatest(0,coalesce((offer->>'percent')::numeric,0)));welcome_discount:=round(eligible*pct/100,2);
 end if;
 discount:=greatest(global_discount,welcome_discount);consumed:=welcome_discount>0 and welcome_discount>=global_discount;
 threshold:=coalesce((settings->>'shippingThreshold')::numeric,0);
 if threshold>0 and subtotal>=threshold then shipping:=0;end if;
 total:=round(subtotal-discount+shipping,2);
 result:=jsonb_build_object('items',item_list,'subtotal',subtotal,'discount',discount,'welcomeDiscount',case when consumed then welcome_discount else 0 end,'shipping',shipping,'total',total,'currency','EGP','paymentMethod','cod','paymentStatus','unpaid','delivery',p_delivery,'email',c.email);
 if p_commit then
   if p_request_id is null then raise exception 'معرّف الطلب مطلوب';end if;
   insert into public.habiba_orders(customer_id,request_id,details) values(uid,p_request_id,result) returning id into order_id;
   if consumed then update public.habiba_customers set welcome_used=true where id=uid;end if;
   update public.habiba_store set document=jsonb_set(jsonb_set(document,'{products}',products),'{bundles}',bundles),revision=revision+1,updated_at=now() where id=1;
   return result||jsonb_build_object('id',order_id,'status','pending');
 end if;
 return result;
end $$;
revoke all on function public.habiba_checkout(jsonb,jsonb,uuid,boolean) from public,anon;
grant execute on function public.habiba_checkout(jsonb,jsonb,uuid,boolean) to authenticated;
create or replace function public.habiba_order_status(p_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare o public.habiba_orders;cfg jsonb;arr jsonb;item jsonb;pos integer;remaining integer;kind text;pid text;
begin
 if not exists(select 1 from public.habiba_admins where user_id=auth.uid()) then raise exception 'Admin only' using errcode='42501';end if;
 if p_status not in('confirmed','processing','shipped','completed','cancelled') then raise exception 'Invalid status';end if;
 select * into o from public.habiba_orders where id=p_id for update;
 if not found then raise exception 'Order not found';end if;
 if o.status='cancelled' then if p_status='cancelled' then return;else raise exception 'الطلب الملغي لا يعاد تفعيله؛ أنشئ طلبًا جديدًا';end if;end if;
 if p_status='cancelled' then
  select document into cfg from public.habiba_store where id=1 for update;
  for item in select value from jsonb_array_elements(o.details->'items') loop
   pid:=item->>'id';kind:='products';if left(pid,7)='bundle-' then kind:='bundles';pid:=substring(pid from 8);end if;
   arr:=cfg->kind;pos:=null;remaining:=null;
   select ordinality::integer-1,nullif(value->>'stock','')::integer into pos,remaining from jsonb_array_elements(arr) with ordinality where value->>'id'=pid limit 1;
   if pos is not null and remaining is not null then cfg:=jsonb_set(cfg,array[kind,pos::text,'stock'],to_jsonb(remaining+(item->>'quantity')::integer));end if;
  end loop;
  update public.habiba_store set document=cfg,revision=revision+1,updated_at=now() where id=1;
 end if;
 update public.habiba_orders set status=p_status where id=p_id;
end $$;
revoke all on function public.habiba_order_status(uuid,text) from public,anon;
grant execute on function public.habiba_order_status(uuid,text) to authenticated;
commit;
