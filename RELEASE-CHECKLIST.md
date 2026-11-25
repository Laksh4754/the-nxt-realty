# Release and rollback checklist

These checks prepare a release. They do not deploy the site.

## Before release

- [ ] Review the change and confirm it does not alter listing data, design, or Supabase policies.
- [ ] Confirm the **Static assets and Supabase smoke** and **Playwright desktop and mobile smoke** checks pass on the pull request. These are the stable GitHub Actions check names; require these exact names in repository rules.
- [ ] In GitHub, open **Settings → Rules → Rulesets** (or **Branches** on repositories using classic protection), create a ruleset targeting the `main` branch, and enable **Require status checks to pass before merging**. Add `Static assets and Supabase smoke` and `Playwright desktop and mobile smoke` as required checks. Also require pull requests before merging and block force pushes/deletion. Until an owner saves and enables this rule, the checks are advisory and `main` remains unprotected by them.
- [ ] In the connected production host, set the production branch to `main` and verify production deploys are gated on required GitHub checks where that host supports it. Preview deployments from this safeguards branch are not production releases. The repository has received both Vercel and Cloudflare Pages preview notifications; confirm which project currently owns the production domain before changing host settings. A GitHub Actions workflow alone cannot enforce repository branch rules or hosting-project settings.
- [ ] Review the exact production change and approve it before merge or deploy.
- [ ] After an approved release, open the production URL on desktop and mobile; verify the homepage, filters, property detail, images, enquiry links, and browser console.

## If a release breaks the site

1. In Vercel, open the project’s **Deployments** list and identify the last known-good production deployment.
2. Use Vercel’s rollback/promote-to-production action for that deployment. Confirm the production domain points to the restored deployment.
3. Recheck the homepage, a published property detail page, and the Supabase listing status on desktop and mobile.
4. Revert or fix the offending GitHub change in a reviewed pull request. Keep the broken deployment and check logs available for diagnosis.
5. Resume releases only after the required checks pass and a reviewer approves.

The GitHub ruleset and production-host settings were not changed as part of this pull request. The repository owner must save and enable them; until then, protection is not enforced.
