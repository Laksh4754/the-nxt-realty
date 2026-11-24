# The NXT Realty — upgraded property portal

A responsive property discovery website and admin workspace for The NXT Realty. This upgrade preserves the existing Supabase-backed project and extends it for builder projects with multiple configurations, separate pricing/area details, project highlights, amenities, payment plans, galleries, brochures, floor plans, video/virtual-tour links and location links.

## Project files

- `index.html`, `styles.css`, `app.js` — public homepage, search, filters and published project cards.
- `property.html`, `property.js` — individual project landing pages.
- `admin.html`, `admin.css`, `admin.js` — admin login, project editor, configuration rows and lead management.
- `config.js` — Supabase URL, publishable key, WhatsApp number and image bucket.
- `supabase-schema.sql` — original database bootstrap schema (for a brand-new database only).
- `migration_project_upgrade.sql` — additive migration for an existing NXT Realty database.
- `robots.txt`, `sitemap.xml` — initial search-engine discovery files; update the domain after it is purchased and connected.

## Important: upgrading your existing Supabase project

Your existing project already has `properties`, `leads` and `admin_users`, and your admin login was confirmed working. **Do not rerun the full `supabase-schema.sql` against the existing live database.**

1. Back up your Supabase project first (at minimum, export the `properties`, `leads` and `admin_users` tables).
2. Open Supabase → SQL Editor.
3. Open `migration_project_upgrade.sql` from this folder, copy its contents and run it once.
4. Confirm that `properties` now has these new columns: `developer_name`, `project_highlights`, `payment_plan`, `video_url`, `virtual_tour_url`, `floor_plans`, `configurations`, and `project_type`.
5. Confirm your existing admin user remains in `admin_users` and test sign-in at `admin.html`.

The migration adds columns and timestamp triggers. It removes only location CHECK constraints on `properties` so locations such as Dombivli and Thane can be saved. Run `policy_audit.sql` first and inspect existing policies: permissive policies combine, so this migration does not automatically remove unknown older policies. It does not drop project records or replace existing users. Review the SQL and retain a backup before running it.

## Local preview

Use VS Code Live Server, or run:

```bash
python -m http.server 8000
```

Open `http://localhost:8000`.

## Admin workflow

1. Open `admin.html` and sign in using the existing Supabase admin account.
2. Choose **Add project**.
3. Enter the project name, developer, location, description, highlights and amenities.
4. Add each configuration separately, with its own area range, starting price and bedroom count.
5. Upload project images and add brochure, floor-plan, video, virtual-tour and Google Maps URLs as available.
6. Save as Draft while information is being checked. Publish only after the details and permissions are verified.

Existing gallery images are retained when no new images are uploaded. New uploads are appended to the gallery. If a database save fails after a new upload, the admin code attempts to remove the newly uploaded objects.

## Security and launch checks

- `config.js` must contain only the Supabase project URL and publishable/anon key. Never put a `service_role` key or database password in browser files.
- Keep RLS enabled. Review all existing policies in Supabase; permissive policies combine, so older policies can weaken newer ones.
- Confirm public users can read only `published` projects and submit consented leads, while only authorised admin users can read/update leads or modify projects/storage.
- Confirm the `property-images` bucket is public for image viewing, with upload/update/delete restricted to admins.
- Check Supabase Auth redirect URLs after choosing the final production domain.
- Review privacy wording and add the business's actual official email, business address, retention period and legal details before launch. The included privacy page is a draft, not legal advice.
- Verify project prices, carpet areas, RERA IDs, amenities, payment terms, possession and connectivity claims before publishing.
- Test on desktop and mobile, test enquiry submission, and verify lead records in Supabase.
- Update `sitemap.xml` to the final verified domain and submit it in Google Search Console after deployment.

## Test checklist

- [ ] Homepage loads with Supabase available.
- [ ] Only published projects appear publicly.
- [ ] Search filters include the new localities and configurations.
- [ ] Admin login works and unauthorised users are rejected.
- [ ] Admin can create/edit a project with multiple configurations.
- [ ] Existing gallery remains when editing without new uploads.
- [ ] New images upload to the configured storage bucket.
- [ ] Draft projects do not appear publicly.
- [ ] Published project page shows configurations, highlights, amenities and supplied links.
- [ ] Public enquiry requires consent and creates a lead.
- [ ] Admin can update lead status.
- [ ] Mobile layout and all external links are checked.

## Deployment

This archive is not yet deployed. Once the migration and tests above are complete, deploy the folder to a new GitHub repository and Vercel project, configure the production domain and Supabase Auth redirect URLs, then submit the sitemap to Google Search Console. Do not point a public domain at the site until the live checks are complete.

## Testing boundary

JavaScript syntax and local file consistency can be checked before deployment. A real end-to-end test of Supabase database writes, storage uploads, authentication, email/redirect behaviour and public hosting requires running the migration in your Supabase project and testing the deployed/local app against that live project. No remote database has been changed by preparing this archive.
