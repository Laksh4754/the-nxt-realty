-- Read-only policy audit. Run in Supabase SQL Editor and inspect results.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public','storage')
  and tablename in ('properties','leads','admin_users','objects')
order by schemaname, tablename, policyname;

-- Check RLS is enabled on the core tables.
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('properties','leads','admin_users')
order by c.relname;

-- Check project columns expected by the upgraded editor.
select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='properties'
  and column_name in ('configurations','developer_name','project_highlights','payment_plan','video_url','virtual_tour_url','floor_plans','project_type')
order by column_name;
