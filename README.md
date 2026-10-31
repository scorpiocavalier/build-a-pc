# Astral Tech Gaming

Online store for PC parts and custom-built gaming PCs — **astralgaming.ca**.
Bilingual (English/French), with pickup and delivery in Toronto and Montreal.

The full product and technical plan is in [`docs/PLAN.md`](docs/PLAN.md).

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 ·
next-intl · PostgreSQL + Prisma 7 · Auth.js · Sentry · Vitest · Playwright.

## Getting started

Requirements: Node.js 22+, Docker (or any local PostgreSQL 16).

```bash
cp .env.example .env          # then set AUTH_SECRET (npx auth secret)
docker compose up -d db       # local Postgres on :5432
npm install                   # also generates the Prisma client
npm run db:migrate            # apply migrations
npm run db:seed               # placeholder catalog: 2 locations, 8 categories, 24 products
npm run dev                   # http://localhost:3000
```

## Scripts

| Command                              | What it does                                   |
| ------------------------------------ | ---------------------------------------------- |
| `npm run dev`                        | Dev server                                     |
| `npm run build` / `npm start`        | Production build / serve it                    |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript                            |
| `npm run format`                     | Prettier (with Tailwind class sorting)         |
| `npm test`                           | Unit tests (Vitest)                            |
| `npm run test:e2e`                   | Browser tests (Playwright; run `build` first)  |
| `npm run db:migrate`                 | Create/apply a migration after schema changes  |
| `npm run db:seed`                    | Load/refresh the placeholder catalog           |
| `npm run db:studio`                  | Browse the database                            |

## Admin

- `/admin` needs a Google account listed in `ADMIN_EMAILS`.
- In `npm run dev` only, the sign-in page also has a **Development sign-in**
  button that signs in as the first `ADMIN_EMAILS` address without Google.
  It returns 404 in production builds.
- **Products**: create and edit products with English/French text, specs,
  price, stock per location and photos.
- **CSV import**: download a template per category (or an export of current
  products), fill it in a spreadsheet, then check and import. Columns match
  the admin form's field names; multi-value spec cells use `|`. Imports are
  all-or-nothing.

## Orders and payments

- Cart → checkout (pickup in Toronto/Montreal, or local delivery by postal
  code) → order page at `/<locale>/orders/<id>?t=<token>` (guests keep the link).
- Payment methods: card (Stripe Checkout; hidden until Stripe keys are set),
  Interac e-Transfer and cash (only under the cash limit). Admins record
  e-Transfer and cash payments on the order page.
- Stock is reserved at checkout with a guarded SQL update, so the last unit
  can't be sold twice, and deducted when the order is completed.
- `/api/webhooks/stripe` is the only thing that marks card orders paid; it
  ignores repeated events. `/api/cron/expire-orders` (hourly via
  `vercel.json`, needs `CRON_SECRET`) cancels unpaid orders past their hold.
- Emails go through Resend when `AUTH_RESEND_KEY` is set; otherwise they're
  printed to the server log.
- `/admin/settings`: pickup addresses and hours, delivery postal prefixes and
  fees, tax rates with a per-province "collect" switch, e-Transfer email,
  cash limit and hold times.

## Catalog design

- Each category's spec fields are defined once in `src/lib/specs/definitions.ts`
  (labels in English and French, allowed values, which are required, which
  are storefront filters). The admin form, CSV columns, validation and
  filters all come from there.
- Storefront reads (`src/server/catalog/queries.ts`) are cached and tagged
  `catalog`; admin writes call `updateTag("catalog")`.
- Stock is per location (`Inventory`), and every change is recorded in
  `InventoryMovement`.

## Project layout

```
src/
  app/[locale]/   customer-facing site, /en and /fr
  app/admin/      admin dashboard (English only, allow-listed Google accounts)
  app/api/        route handlers (Auth.js)
  components/     shared UI (ui/ = button and other primitives)
  i18n/           locale routing and message loading
  lib/            pure helpers: money, specs, catalog filters, CSV
  server/         server-only code: database, catalog, cart, orders, payments, email
  proxy.ts        locale redirects + cheap admin cookie check
messages/         en.json, fr.json — every customer-facing string
prisma/           schema and migrations
tests/e2e/        Playwright tests
```

## Conventions

- **No hard-coded customer-facing text.** Add strings to both
  `messages/en.json` and `messages/fr.json`; a unit test fails if the two
  files drift apart.
- **Money is integer cents** (`src/lib/money.ts`), currency CAD.
- **Admin access is checked on the server** with `requireAdmin()` in every
  admin page and server action. The proxy check is only a fast redirect.
- **Admins** are listed in `ADMIN_EMAILS` and must sign in with Google.
- With Cache Components on, anything that reads cookies or the session must
  sit inside a `<Suspense>` boundary.

## Deployment (planned)

Vercel (Pro) for the app, Neon for Postgres. Set the variables from
`.env.example` in the Vercel project, and run `npm run db:deploy` against the
production database on release.
