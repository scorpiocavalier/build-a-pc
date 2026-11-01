# Deploying to Vercel (first look)

This gets the site online at a `*.vercel.app` address with the placeholder
catalog, so you can click around before doing the rest of
[`LAUNCH.md`](LAUNCH.md). It takes about 15 minutes and costs nothing on
Vercel's Hobby plan and Neon's free plan.

## 1. Create the Vercel project

1. Go to <https://vercel.com/signup> and sign up **with GitHub**.
2. **Add New… → Project**, then **Import** `scorpiocavalier/build-a-pc`.
   If it isn't listed, click **Adjust GitHub App Permissions** and give
   Vercel access to that repository.
3. Leave the settings as detected (Framework: Next.js) and click **Deploy**.
   **This first deploy will fail** ("Can't reach database server"). That's
   expected: there's no database yet.

## 2. Add a database (Neon)

1. In the project, open the **Storage** tab → **Create Database** → **Neon**
   (Serverless Postgres) → **Continue**.
2. Pick the free plan and a region close to your customers (a Canadian region
   if one is offered, otherwise US East). Name it `astral`.
3. When asked, connect it to this project for **all environments**. This adds
   `DATABASE_URL` and `DATABASE_URL_UNPOOLED` automatically.

## 3. Add the other settings

In the project, go to **Settings → Environment Variables** and add these for
all environments:

| Name | Value |
| --- | --- |
| `AUTH_SECRET` | A long random string. In a terminal: `openssl rand -base64 33`, or use <https://generate-secret.vercel.app/32> |
| `ADMIN_EMAILS` | Your Google address (comma-separated if two admins) |
| `CRON_SECRET` | Another long random string |
| `SEED_DEMO_DATA` | `1`. **Temporary**: loads the placeholder catalog on the next deploy |

## 4. Deploy again

1. Open **Deployments**, click **⋯** on the failed deployment → **Redeploy**.
2. In the build log you should see `Applying database migrations…`, then
   `Loading demo data…` and `Seeded 2 locations, 9 categories…`.
3. When it's done, click **Visit**. Check `https://<your-project>.vercel.app/api/health`
   shows `{"ok":true}`.
4. **Delete the `SEED_DEMO_DATA` variable now.** Otherwise every deploy resets
   the placeholder products (and later, could overwrite your edits to them).

From now on, every merge to `main` deploys automatically, and every pull
request gets its own preview link.

## What works on this first deploy

- Browsing in English and French, search, the PC builder, prebuilt PCs,
  cart, and checkout with **e-Transfer or cash** (orders are real rows in
  your database; emails are only written to Vercel's logs).
- Order pages, returns requests, policy pages.

Not yet, until you add the keys from `LAUNCH.md`:

| Feature | Needs |
| --- | --- |
| Admin dashboard | Google sign-in (below) |
| Card payments | Stripe keys |
| Customer sign-in and real emails | Resend key and a verified domain |
| Product photo uploads | Cloudflare R2 |

## Optional: sign in to the admin

1. In <https://console.cloud.google.com>, create a project, then
   **APIs & Services → OAuth consent screen** (External; add your email as a
   test user).
2. **Credentials → Create credentials → OAuth client ID** → Web application.
   Authorized redirect URI:
   `https://<your-project>.vercel.app/api/auth/callback/google`
3. Add `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in Vercel, redeploy, then go
   to `/admin`.

## Good to know

- Search engines are told not to index the site until you set
  `NEXT_PUBLIC_SITE_URL` to your real domain.
- Preview deployments use the same database as production unless you turn on
  Neon's branch-per-preview option in the Neon integration settings.
- **Hobby plan limits:** the job that cancels unpaid orders runs once a day
  (Hobby doesn't allow hourly jobs), and Vercel's Hobby terms don't allow
  commercial sites. Before launch, upgrade to Pro and set the schedule in
  `vercel.json` back to `0 * * * *` (hourly).
