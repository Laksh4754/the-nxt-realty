# Release and rollback checklist

These checks prepare a release. They do not deploy the site.

## Before release

- [ ] Review the change and confirm it does not alter listing data, design, or Supabase policies.
- [ ] Confirm the **Static assets and Supabase smoke** and **Playwright desktop and mobile smoke** checks pass on the pull request. These are the stable GitHub Actions check names; require these exact names in repository rules.
- [ ] Verify that active ruleset or classic branch protection for `main` requires `Static assets and Supabase smoke` and `Playwright desktop and mobile smoke`, requires pull requests, and blocks force pushes/deletion. The repository owner previously reported saving classic protection; this pull request does not change those GitHub settings.
- [ ] **Owner confirmation required:** identify the hosting project that currently serves the production domain, then confirm its production branch is `main` and production deploys are gated on required GitHub checks where supported. Vercel and Cloudflare Pages preview notifications do not establish which host owns production. Do not change host settings until the production project and domain are confirmed. A GitHub Actions workflow alone cannot enforce repository branch rules or hosting-project settings.
- [ ] Review the exact production change and approve it before merge or deploy.
- [ ] After an approved release, open the production URL on desktop and mobile; verify the homepage, filters, property detail, images, enquiry links, and browser console.

## If a release breaks the site

1. **Owner confirmation required:** use the confirmed production host’s deployment history to identify the last known-good production deployment. The repository does not establish whether production is hosted by Vercel or Cloudflare Pages.
2. Use that host’s rollback or promote-to-production action. Confirm the production domain points to the restored deployment.
3. Recheck the homepage, a published property detail page, and the Supabase listing status on desktop and mobile.
4. Revert or fix the offending GitHub change in a reviewed pull request. Keep the broken deployment and check logs available for diagnosis.
5. Resume releases only after the required checks pass and a reviewer approves.

The production host remains unconfirmed from repository evidence. The repository owner must identify the production project and domain before relying on host-specific release or rollback steps. This pull request does not change GitHub rulesets or hosting settings.
