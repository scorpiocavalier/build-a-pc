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
| `npm run db:studio`                  | Browse the database                            |

## Project layout

```
src/
  app/[locale]/   customer-facing site, /en and /fr
  app/admin/      admin dashboard (English only, allow-listed Google accounts)
  app/api/        route handlers (Auth.js)
  components/     shared UI (ui/ = button and other primitives)
  i18n/           locale routing and message loading
  lib/            pure helpers (money, utils)
  server/         server-only code: database, auth guards
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
