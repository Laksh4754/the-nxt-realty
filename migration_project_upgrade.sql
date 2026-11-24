-- NXT Realty project upgrade (non-destructive migration)
-- Run once in Supabase SQL Editor after backing up your project.
-- Adds project-level content and configuration-wise pricing without deleting existing columns/data.

alter table public.properties
  add column if not exists developer_name text,
  add column if not exists project_highlights text[] not null default '{}',
  add column if not exists payment_plan text,
  add column if not exists video_url text,
  add column if not exists virtual_tour_url text,
  add column if not exists floor_plans jsonb not null default '[]'::jsonb,
  add column if not exists configurations jsonb not null default '[]'::jsonb,
  add column if not exists project_type text not null default 'residential';

-- Remove only location CHECK constraints on properties, so new MMR localities can be added.
-- The location field remains required; validation is handled by the admin form.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid='public.properties'::regclass and contype='c'
      and pg_get_constraintdef(oid) ilike '%location%'
  loop
    execute format('alter table public.properties drop constraint %I', c.conname);
  end loop;
end $$;

-- Keep updated_at current for both properties and leads.
create or replace function public.nxt_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;
drop trigger if exists nxt_properties_updated_at on public.properties;
create trigger nxt_properties_updated_at before update on public.properties
for each row execute function public.nxt_set_updated_at();
drop trigger if exists nxt_leads_updated_at on public.leads;
create trigger nxt_leads_updated_at before update on public.leads
for each row execute function public.nxt_set_updated_at();

-- Ensure the expected public/admin policies exist. Existing unrelated policies are not removed.
drop policy if exists "Public can view published properties" on public.properties;
create policy "Public can view published properties" on public.properties
for select to anon, authenticated using (status='published' or public.is_nxt_admin());
