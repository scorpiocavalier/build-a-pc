# Two stores, one codebase

Toronto and Montreal are separate businesses: each has its own website,
domain, database, customers, prices, stock, Stripe account and admins. Both
run the same code from this repository, so every change merged to `main`
deploys to both.

| | Toronto | Montreal |
| --- | --- | --- |
| Vercel project | the existing `build-a-pc` project | a new project, e.g. `build-a-pc-montreal` |
| `NEXT_PUBLIC_STORE_LOCATION` | `TOR` | `MTL` |
| Database | the existing Neon database | a copy of it (step 2) |
| Domain | its own (e.g. `astralgaming.ca`) | its own (e.g. `astralgaming.quebec`) |
| Site opens in | English | French |

## How the code handles it

- **One setting:** `NEXT_PUBLIC_STORE_LOCATION` (`TOR` or `MTL`). The code in
  `src/lib/store-config.ts` turns it into the list of stores
  (`LOCATION_CODES`). Everything that lists stores reads that list, so with one
  store the site shows only that store.
- **Left unset** (development, automated tests), the site runs both stores
  together, as before.
- **On a one-store site:** stock transfers and every store picker are hidden.
  Orders, reports, the Today page and purchases only show that store's
  records, even though the copied database still holds the other store's
  history.
- **Wording:** the few sentences that name both cities are replaced per store
  from `messages/stores/<STORE>.<language>.json`. A unit test checks those
  files keep matching the main translation files.

**Rule for future changes:** never hard-code `"TOR"`/`"MTL"` or "Toronto and
Montreal". Use `LOCATION_CODES`, `LOCATION_NAMES`, `DEFAULT_LOCATION` or
`SINGLE_STORE` from `src/lib/store-config.ts`. For admin forms, use
`<LocationField>` and `<LocationOptions>` from
`src/components/admin/location-options.tsx`.

## Setting it up

### 1. Make the existing project the Toronto site

In Vercel, open the existing project → **Settings → Environment Variables**,
add `NEXT_PUBLIC_STORE_LOCATION` = `TOR` for all environments, then redeploy.

### 2. Copy the database for Montreal

1. In Neon, create a **new project** for Montreal (Canada region if offered)
   and copy its connection string.
2. On a computer with PostgreSQL's tools installed (`pg_dump`, `pg_restore`),
   copy everything from Toronto's database. Use the **direct** (unpooled)
   connection strings from Neon:

   ```bash
   pg_dump --format=custom --no-owner --no-privileges "$TORONTO_DATABASE_URL" > astral.dump
   pg_restore --no-owner --no-privileges --dbname "$MONTREAL_DATABASE_URL" astral.dump
   ```

3. Delete `astral.dump` afterwards: it contains customers' details.

From this point, the two databases are independent. The Montreal site shows
only Montreal's stock, orders and purchases. Its copy of Toronto's history
stays hidden but isn't deleted.

### 3. Create the Montreal Vercel project

1. **Add New… → Project** → import `scorpiocavalier/build-a-pc` again and name
   it `build-a-pc-montreal`.
2. Under **Environment Variables**, add the same names as the Toronto project
   with Montreal's own values:

| Name | Montreal value |
| --- | --- |
| `NEXT_PUBLIC_STORE_LOCATION` | `MTL` |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Montreal's Neon database (step 2) |
| `NEXT_PUBLIC_SITE_URL` | `https://<montreal domain>` |
| `AUTH_SECRET`, `CRON_SECRET` | New random strings (`openssl rand -base64 33`) |
| `ADMIN_EMAILS` | Montreal's admins |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | A Google OAuth client with the redirect `https://<montreal domain>/api/auth/callback/google` (it can be a second client in the same Google Cloud project) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Montreal's own Stripe account, with the webhook `https://<montreal domain>/api/webhooks/stripe` |
| `AUTH_RESEND_KEY`, `EMAIL_FROM` | Resend with Montreal's domain verified |
| `R2_*` | The same image bucket as Toronto works (the copied products point at those photos), or its own bucket if you copy the photos over |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_*` | Optional: a second Sentry project, or the same one |

3. Deploy, then add the Montreal domain under **Settings → Domains**.

### 4. Tidy each store's admin

On each site, sign in to the admin and check:

- **Settings:** that store's address, hours, delivery area, e-Transfer email,
  contact email, privacy officer and tax numbers.
- **Products:** prices (they're now independent per store) and any products
  that store doesn't sell (archive them).

## Things to know

- **Order numbers** continue from the same number in both databases, so the
  stores can each have an order `ATG-10050`. They're separate businesses, so
  this is only cosmetic. Ask if you'd like a store prefix such as `MTL-`.
- **Customer accounts** were copied to both sites. After the split, a
  customer who signs up on one site doesn't exist on the other.
- **Preview deployments** of pull requests build for both projects. Each uses
  its own project's Preview settings.
- **French on the Montreal site:** it opens in French by default (Quebec's
  Charter of the French Language). English stays available with the language
  switch. Have the legal pages checked by a lawyer.
