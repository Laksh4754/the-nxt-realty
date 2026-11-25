# The NXT Realty — release and recovery checklist

## Before merging or deploying
- [ ] Confirm the change is on a feature branch and review the diff.
- [ ] Run `node scripts/check-assets.mjs`.
- [ ] Run `node scripts/smoke.mjs` with network access to the configured Supabase project.
- [ ] Confirm homepage CSS, Supabase client and `config.js` references are present.
- [ ] Confirm only published listings appear publicly; drafts remain private.
- [ ] Check homepage, one property detail page and admin sign-in screen at mobile and desktop sizes.
- [ ] Confirm no service-role key, database password or other secret was added to browser files.
- [ ] Confirm GitHub Actions checks pass before merging.

## After production deployment
- [ ] Open `https://the-nxt-realty.vercel.app/` in a private/incognito browser window.
- [ ] Confirm the navy-and-gold styles load (not browser-default HTML).
- [ ] Confirm published property cards load from Supabase.
- [ ] Open a property card and confirm its detail page loads.
- [ ] Open `/admin.html` and confirm the sign-in screen is styled; do not attempt unauthorised access.
- [ ] Check `/sitemap.xml` and `/robots.txt`.
- [ ] Check the browser console and network panel for failed CSS, JS or Supabase requests.

## Rollback
1. Open the Vercel project **The NXT Realty** → **Deployments**.
2. Identify the last known-good production deployment (verify its commit and preview).
3. Use Vercel's **Instant Rollback** action for that deployment.
4. Re-test the live homepage, a published property page and admin sign-in screen.
5. Create a follow-up fix on a new Git branch; do not force-push or rewrite `main`.

## Notes
- The Supabase publishable/anon key is expected in browser configuration. It is not a secret; access control must be enforced by Supabase Row Level Security and policies.
- Never expose a Supabase `service_role` key or database password in client-side files or CI logs.
- The browser smoke test reads published records from the configured Supabase project. CI requires outbound access to the Supabase project and the public CDN.
- GitHub Actions checks are a safety net, not a guarantee. Always perform the production checks above after deployment.
