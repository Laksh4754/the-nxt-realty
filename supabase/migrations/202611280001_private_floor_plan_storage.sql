-- Apply only after review. This migration creates a private bucket for new floor-plan uploads.
-- It does not move/delete legacy objects or alter the public property-images bucket.
-- Keep the SECURITY DEFINER lookup outside the exposed public API schema. The public
-- wrapper remains invoker-only for the admin UI and existing RLS policies.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_nxt_admin()
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from public.admin_users where user_id=(select auth.uid()));
$$;
revoke all on function private.is_nxt_admin() from public, anon, authenticated;
grant execute on function private.is_nxt_admin() to authenticated;

create or replace function public.is_nxt_admin()
returns boolean language sql stable security invoker set search_path=pg_catalog as $$
  select private.is_nxt_admin();
$$;
revoke all on function public.is_nxt_admin() from public, anon;
grant execute on function public.is_nxt_admin() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('floor-plan-private', 'floor-plan-private', false, 10485760,
        array['image/png','image/jpeg','image/webp','image/avif','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "NXT admins can upload private floor plans" on storage.objects;
create policy "NXT admins can upload private floor plans" on storage.objects
for insert to authenticated with check (bucket_id='floor-plan-private' and public.is_nxt_admin());
drop policy if exists "NXT admins can update private floor plans" on storage.objects;
create policy "NXT admins can update private floor plans" on storage.objects
for update to authenticated using (bucket_id='floor-plan-private' and public.is_nxt_admin())
with check (bucket_id='floor-plan-private' and public.is_nxt_admin());
drop policy if exists "NXT admins can delete private floor plans" on storage.objects;
create policy "NXT admins can delete private floor plans" on storage.objects
for delete to authenticated using (bucket_id='floor-plan-private' and public.is_nxt_admin());

-- No anon/authenticated SELECT policy is created. Signed URLs are issued only by the
-- floor-plan-access Edge Function after it saves a consented lead and checks listing metadata.
