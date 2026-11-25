# Release and rollback checklist

These checks prepare a release. They do not deploy the site.

## Before release

- [ ] Review the change and confirm it does not alter listing data, design, or Supabase policies.
- [ ] Confirm the **Static assets and Supabase smoke** and **Playwright desktop and mobile smoke** checks pass on the pull request.
- [ ] In GitHub repository settings, require both named checks on the protected `main` branch before merging.
- [ ] In Vercel project settings, confirm production deploys come from `main` and configure the Git provider's required-check gate if available. A GitHub Actions workflow alone cannot enforce repository branch protection or Vercel project settings.
- [ ] Review the exact production change and approve it before merge or deploy.
- [ ] After an approved release, open the production URL on desktop and mobile; verify the homepage, filters, property detail, images, enquiry links, and browser console.

## If a release breaks the site

1. In Vercel, open the project’s **Deployments** list and identify the last known-good production deployment.
2. Use Vercel’s rollback/promote-to-production action for that deployment. Confirm the production domain points to the restored deployment.
3. Recheck the homepage, a published property detail page, and the Supabase listing status on desktop and mobile.
4. Revert or fix the offending GitHub change in a reviewed pull request. Keep the broken deployment and check logs available for diagnosis.
5. Resume releases only after the required checks pass and a reviewer approves.

Use Vercel’s current dashboard labels and project access controls; the dashboard was not available for inspection while this checklist was prepared.
