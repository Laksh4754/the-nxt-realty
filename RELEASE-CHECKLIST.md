# Release and rollback checklist

These checks prepare a release; production changes happen only after local integration checks and pull request CI pass.

## Before release

- [ ] Review the change: it adds private floor-plan storage and admin-only storage policies, plus an Edge Function that records a consented enquiry before issuing a five-minute signed URL. It does not move or delete existing objects or modify listing/enquiry rows.
- [ ] Confirm the **Static assets and Supabase smoke** and **Playwright desktop and mobile smoke** GitHub Actions checks pass on the pull request.
- [ ] Verify `main` requires these checks and a pull request, and blocks force pushes and deletion.
- [ ] Production is served by Vercel with `main` as its production branch (confirmed during release preparation). Verify the production deployment after merging.
- [ ] Run migration, storage-policy, Edge Function, enquiry and signed-URL checks against local Supabase with dummy data before changing production. Browser tests use a mocked backend and do not satisfy this requirement.
- [ ] Record the live baseline, then apply the additive migration and deploy the Edge Function only after all checks pass. Keep the `private` schema out of Data API exposed schemas and configure the function's service-role key through Supabase function secrets.
- [ ] After release, verify the production site on desktop and mobile: homepage, filters, a property detail, images, enquiry links and browser console. Test a real floor-plan unlock if a plan has been added to a listing.

## If a release breaks the site

1. Use Vercel deployment history to identify the last known-good production deployment.
2. Use Vercel's rollback or promote action and verify the production domain points to the restored deployment.
3. Recheck the homepage, a published property detail page and Supabase listing status on desktop and mobile.
4. Revert or fix the offending GitHub change in a pull request. Keep the failed deployment and check logs available for diagnosis.
5. Resume releases only after the required checks pass.

This checklist does not change GitHub rulesets or hosting settings.
