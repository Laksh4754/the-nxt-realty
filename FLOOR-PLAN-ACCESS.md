# Floor-plan access and preview deployment

The public property detail page now draws a non-image placeholder for each enabled floor plan. It never puts the full-resolution image URL into page markup. A request calls the `floor-plan-access` Supabase Edge Function; the function checks the published listing and enabled plan, saves the consented lead, and only then returns a five-minute signed URL.

## Admin controls

- Rename an individual plan.
- Move an individual plan to another configuration.
- Show or hide an individual plan on the public listing.
- Move a plan up or down to change its display order.
- Replace its source with a newly uploaded file. The previous stored object is retained.
- Remove a plan from listing metadata. This does not delete its storage object.
- Add plans to a configuration. New source files are uploaded unchanged to the private `floor-plan-private` bucket.

Configuration labels and plan details remain editable. Legacy project-wide URLs are preserved in existing records for data integrity, but the public page no longer renders them. Any old URLs already shared or indexed can remain accessible at their original host; migrate any such plans to the private bucket before relying on this protection.

## Before production can protect existing plans

1. Review and apply `supabase/migrations/202611280001_private_floor_plan_storage.sql` to the intended Supabase project.
   Keep the `private` schema out of the Data API exposed-schema list; the public wrapper is invoker-only and anonymous callers have no execute permission.
2. Deploy `supabase/functions/floor-plan-access` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured as server-side function secrets. Never add the service role key to `config.js` or browser code.
3. In the admin, re-upload each plan that currently has a public URL, then save the listing with the private plan path. Existing public objects are deliberately not moved or deleted by this change. Until migrated, old source URLs may remain accessible to anyone who has them.
4. Verify a valid request saves a lead and returns a signed URL; verify invalid, cancelled, hidden-plan, and failed-save requests return no URL.

The Vercel Preview deployment is static and cannot deploy the Supabase migration or Edge Function. The preview shows the new gated design; its form explicitly remains a design preview and leaves plans locked because the real authorization service is not being activated here. The local supplied source folder is preserved and excluded from the Vercel upload by `.vercelignore`.
