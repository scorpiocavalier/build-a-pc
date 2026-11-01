# Launch checklist — astralgaming.ca

Everything the code needs is built (Phases 0–6). What's left is accounts,
keys, content and a few decisions only the owner can make. Work top to bottom;
each step says who does it and how to check it.

## 1. Decisions to confirm (owner)

These are written into the site with sensible defaults. Change the setting
or the text in `messages/en.json` / `messages/fr.json` (`Legal.*`) if needed.

- [ ] **Deposits on cancelled builds.** The returns page says a deposit may
      not be refunded in full once assembly has started.
- [ ] **Restocking fee.** 30% on returns that aren't defective, wrong or
      misdescribed, opened or not (`/admin/settings`).
- [ ] **Assembly workmanship.** The warranty page promises to fix problems
      caused by our assembly at no charge (no time limit is stated).
- [ ] **Delivery areas and fees.** Placeholder: Toronto `M`, Montreal `H`,
      $25 each (`/admin/settings` → locations).
- [ ] **Store addresses and hours** for both locations (`/admin/settings`).
- [ ] **Person responsible for privacy** (Quebec Law 25) and contact email
      (`/admin/settings`).
- [ ] Have the policy pages (`/returns`, `/warranty`, `/privacy`, `/terms`,
      English and French) read by a lawyer or the accountant. Update
      `LEGAL_UPDATED` in `src/components/legal/legal-page.tsx` when the
      wording changes.

## 2. Tax (owner + accountant)

- [ ] Decide GST/HST and QST registration (small-supplier threshold: $30,000
      over four quarters).
- [ ] Once registered: enter the numbers in `/admin/settings` (they appear on
      emails) and switch **Collect** on for Ontario and Quebec.
- [ ] Confirm the $10,000 cash cap (Bill C-2) with the accountant.

## 3. Accounts and keys (owner, with help)

| Service | What to do | Environment variables |
| --- | --- | --- |
| Domain | Register `astralgaming.ca` (CIRA registrar) | — |
| Vercel (Pro) | Import the GitHub repo; set the production domain | all below |
| Neon | Create the production database (Canada region if offered); enable daily backups | `DATABASE_URL` |
| Auth.js | Generate a secret: `npx auth secret` | `AUTH_SECRET` |
| Google Cloud | OAuth client for the 2 admins; redirect `https://astralgaming.ca/api/auth/callback/google`; both admins turn on 2-step verification | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ADMIN_EMAILS` |
| Resend | Verify the domain (adds SPF + DKIM DNS records); add a DMARC record | `AUTH_RESEND_KEY`, `EMAIL_FROM` |
| Stripe | Activate the account; use **test** keys on preview, **live** keys on production; add the webhook endpoint `https://astralgaming.ca/api/webhooks/stripe` with the 4 events listed in `.env.example` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Cloudflare R2 | Bucket with a public custom domain (e.g. `images.astralgaming.ca`) | `R2_*` |
| Cron | Any long random string (Vercel sends it to the hourly job) | `CRON_SECRET` |
| Sentry | Project for Next.js; alert on new issues by email | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_*` |
| Site | `https://astralgaming.ca` | `NEXT_PUBLIC_SITE_URL` |

Set the same variables on Vercel's **Preview** environment with test keys
and a separate Neon branch, so previews never touch real orders.

## 4. Database

- [ ] `npm run db:deploy` against production (applies all migrations).
- [ ] `npm run db:seed` **once** for locations, tax rates, categories and the
      Windows products — then delete the placeholder products in the admin, or
      import the real catalog over them.
- [ ] **Backup restore test:** restore a Neon backup to a new branch, point a
      preview deployment at it, and place a test order. Note how long it took.

## 5. Content (owner)

- [ ] Import the real catalog with the CSV templates (`/admin/import`),
      English and French names and descriptions, prices and stock per location.
- [ ] Product photos (`/admin/products/<id>`).
- [ ] Feature 2–4 prebuilt PCs (`/admin/builds`).
- [ ] e-Transfer email, deposit %, assembly fee and Windows SKU
      (`/admin/settings`).
- [ ] Logo and brand colours (optional; tokens are in `src/app/globals.css`).

## 6. Monitoring

- [ ] Uptime monitor (e.g. Better Stack or UptimeRobot, free tier) on
      `https://astralgaming.ca/api/health` (checks the database) and
      `https://astralgaming.ca/en/checkout`, alerting both admins.
- [ ] Sentry alert rule: email on new issues and on error spikes.
- [ ] Turn on Dependabot alerts in the GitHub repository settings
      (`.github/dependabot.yml` already schedules update PRs).
- [ ] Google Search Console and Bing Webmaster Tools: verify the domain and
      submit `https://astralgaming.ca/sitemap.xml`.

## 7. Soft launch

- [ ] On production with live Stripe keys, place real orders for each path
      and refund them: card pickup, e-Transfer delivery, cash, an assembled PC
      with a deposit and a balance payment link, a return with a card refund.
- [ ] Check every email arrives (not in spam) in English and French.
- [ ] Walk through the site with a keyboard only, and once with a screen
      reader (VoiceOver or NVDA) on the builder and checkout.
- [ ] Invite a few friends and customers for a week before announcing.

## What the code already covers

- Security headers and a Content Security Policy (`next.config.ts`), rate
  limits on sign-in, checkout, search and return requests
  (`src/server/rate-limit.ts`), admin checks in every server action, Stripe
  webhook signature checks, an audit log of admin changes.
- Bilingual pages, emails and policies; hreflang links, canonical URLs,
  sitemap, robots rules and structured data for products and stores.
- Privacy: essential cookies only, "Download my data" and "Delete my
  account" in the account page, a privacy policy naming the responsible
  person.
- Automated WCAG 2.2 AA checks (axe) on the main pages in CI
  (`tests/e2e/accessibility.spec.ts`).
