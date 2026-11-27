-- THE NXT REALTY 2.0 — Supabase schema and security
-- Run in Supabase SQL Editor. For an existing starter database, this script adds the new columns/tables.
-- Never expose the service_role key in browser code.
create extension if not exists pgcrypto;

create table if not exists public.admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table if not exists public.properties (
 id uuid primary key default gen_random_uuid(), title text, project_name text not null,
 location text not null,
 locality text, listing_type text not null default 'New Project', property_type text,
 price numeric(14,2), carpet_area numeric(10,2), area_unit text not null default 'sq.ft.',
 bedrooms integer, bathrooms integer, description text, image_url text, gallery_urls text[] not null default '{}',
 amenities text[] not null default '{}', possession_status text, rera_id text, map_url text, brochure_url text,
 latitude double precision, longitude double precision, developer_name text, developer_logo_url text, project_logo_url text, lifestyle_highlights jsonb not null default '[]'::jsonb, media_assets jsonb not null default '[]'::jsonb, project_highlights text[] not null default '{}', payment_plan text, video_url text, virtual_tour_url text, floor_plans jsonb not null default '[]'::jsonb, configurations jsonb not null default '[]'::jsonb, project_type text not null default 'residential', featured boolean not null default false,
 status text not null default 'draft' check (status in ('draft','published','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Add columns safely when upgrading the earlier starter schema.
alter table public.properties add column if not exists gallery_urls text[] not null default '{}';
alter table public.properties add column if not exists amenities text[] not null default '{}';
alter table public.properties add column if not exists possession_status text;
alter table public.properties add column if not exists rera_id text;
alter table public.properties add column if not exists map_url text;
alter table public.properties add column if not exists brochure_url text;
alter table public.properties add column if not exists latitude double precision;
alter table public.properties add column if not exists longitude double precision;
alter table public.properties add column if not exists developer_logo_url text;
alter table public.properties add column if not exists project_logo_url text;
alter table public.properties add column if not exists lifestyle_highlights jsonb not null default '[]'::jsonb;
alter table public.properties add column if not exists media_assets jsonb not null default '[]'::jsonb;

create table if not exists public.leads (
 id uuid primary key default gen_random_uuid(), name text not null, phone text not null,
 requirement text, preferred_location text, message text, source text not null default 'website',
 consent boolean not null default false, status text not null default 'new'
   check(status in ('new','contacted','site_visit','qualified','closed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create or replace function public.is_nxt_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.admin_users where user_id=(select auth.uid()));
$$;
alter table public.admin_users enable row level security;
alter table public.properties enable row level security;
alter table public.leads enable row level security;

drop policy if exists "Admins can view admin list" on public.admin_users;
create policy "Admins can view admin list" on public.admin_users for select to authenticated using (public.is_nxt_admin());
drop policy if exists "Public can view published properties" on public.properties;
create policy "Public can view published properties" on public.properties for select to anon,authenticated using(status='published' or public.is_nxt_admin());
drop policy if exists "Admins can insert properties" on public.properties;
create policy "Admins can insert properties" on public.properties for insert to authenticated with check(public.is_nxt_admin());
drop policy if exists "Admins can update properties" on public.properties;
create policy "Admins can update properties" on public.properties for update to authenticated using(public.is_nxt_admin()) with check(public.is_nxt_admin());
drop policy if exists "Admins can delete properties" on public.properties;
create policy "Admins can delete properties" on public.properties for delete to authenticated using(public.is_nxt_admin());
-- Website visitors can submit enquiries only. They cannot read or edit leads.
drop policy if exists "Public can submit consented leads" on public.leads;
create policy "Public can submit consented leads" on public.leads for insert to anon,authenticated with check(consent=true);
drop policy if exists "Admins can view leads" on public.leads;
create policy "Admins can view leads" on public.leads for select to authenticated using(public.is_nxt_admin());
drop policy if exists "Admins can update leads" on public.leads;
create policy "Admins can update leads" on public.leads for update to authenticated using(public.is_nxt_admin()) with check(public.is_nxt_admin());
drop policy if exists "Admins can delete leads" on public.leads;
create policy "Admins can delete leads" on public.leads for delete to authenticated using(public.is_nxt_admin());

insert into storage.buckets(id,name,public) values('property-images','property-images',true) on conflict(id) do update set public=true;
drop policy if exists "Anyone can view NXT property images" on storage.objects;
create policy "Anyone can view NXT property images" on storage.objects for select to anon,authenticated using(bucket_id='property-images');
drop policy if exists "NXT admins can upload property images" on storage.objects;
create policy "NXT admins can upload property images" on storage.objects for insert to authenticated with check(bucket_id='property-images' and public.is_nxt_admin());
drop policy if exists "NXT admins can update property images" on storage.objects;
create policy "NXT admins can update property images" on storage.objects for update to authenticated using(bucket_id='property-images' and public.is_nxt_admin()) with check(bucket_id='property-images' and public.is_nxt_admin());
drop policy if exists "NXT admins can delete property images" on storage.objects;
create policy "NXT admins can delete property images" on storage.objects for delete to authenticated using(bucket_id='property-images' and public.is_nxt_admin());


-- Explicit API grants. Row Level Security policies above remain the access-control boundary.
grant usage on schema public to anon, authenticated;
grant select on public.properties to anon, authenticated;
grant insert, select, update, delete on public.properties to authenticated;
grant insert on public.leads to anon, authenticated;
grant select, update, delete on public.leads to authenticated;
grant select on public.admin_users to authenticated;
grant execute on function public.is_nxt_admin() to anon, authenticated;

-- After creating the admin in Authentication > Users, allow that UUID to manage listings and leads:
-- insert into public.admin_users(user_id) values ('YOUR-AUTH-USER-UUID');
