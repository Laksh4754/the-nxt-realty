-- Applied to the configured Supabase project as listing_media_identity_fields (20261127180407).
-- Additive media columns only; existing rows, RLS, and storage policies are preserved.
alter table public.properties
  add column if not exists developer_logo_url text,
  add column if not exists project_logo_url text,
  add column if not exists lifestyle_highlights jsonb not null default '[]'::jsonb;

-- Configuration floor plans are stored as objects inside the existing configurations JSONB:
-- [{ label, area, price, bedrooms, floor_plans: [{ url, name, type }] }]
-- The existing property-images bucket and admin-only storage policies remain in use.

alter table public.properties add column if not exists media_assets jsonb not null default '[]'::jsonb;
