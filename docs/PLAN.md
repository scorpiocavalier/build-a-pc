# Build-a-PC — Project Plan

An online store for PC components, with a guided **PC builder** that checks
part compatibility. This plan is for a **real business** taking real orders,
so payments, tax, fulfillment, security and legal compliance are first-class
concerns, not afterthoughts.

> Status: draft v1 — open questions in [§10](#10-open-questions) need answers
> before Phase 2 (checkout) starts.

---

## 1. Goals & scope

### v1 (launch) scope
| Area | What ships |
|---|---|
| **Storefront** | Category browsing, faceted filtering by specs (socket, chipset, memory type, wattage, form factor…), search, product detail pages, cart, checkout |
| **PC builder** | Step-by-step part picker, live compatibility checks, power estimate, shareable build link, "add whole build to cart" |
| **Accounts** | Sign up / sign in, order history & tracking, saved builds, wishlist, saved addresses |
| **Admin** | Product & spec management, bulk CSV import, inventory, order management (fulfil, cancel, refund), basic sales reports |

### Explicitly out of scope for v1
Marketplace / third-party sellers, product reviews & Q&A, price-drop alerts,
loyalty points, multi-currency, prebuilt-PC assembly service, native mobile
apps. Each is a candidate for v2 (see §9).

### Success criteria
- A customer can find a part, build a compatible PC, and pay in under 5 minutes.
- No order is ever charged without stock being reserved, and no stock is ever
  oversold.
- Lighthouse ≥ 90 (performance, accessibility, SEO) on home, category and
  product pages.
- Zero card data touches our servers (Stripe-hosted fields → PCI SAQ A).

---

## 2. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | SSR/ISR for SEO-critical catalog pages, server actions for mutations, one codebase |
| Styling / UI | **Tailwind CSS + shadcn/ui** (Radix primitives) | Accessible primitives, no heavy component lib lock-in |
| Database | **PostgreSQL** | Relational integrity for orders/inventory; JSONB for per-category specs |
| ORM | **Prisma** | Typed queries, migrations |
| Auth | **Auth.js** (email magic link + Google; credentials optional) | Mature, works with Prisma adapter, role field for admin |
| Payments | **Stripe** (Payment Element / Checkout) + **Stripe Tax** | PCI scope reduction, wallets (Apple/Google Pay), automatic tax |
| Search & facets | **Postgres full-text + JSONB filters** for v1; move to **Meilisearch/Typesense** if catalog > ~20k SKUs or latency suffers | Avoid running extra infra on day one |
| Images | **S3-compatible storage (Cloudflare R2 / S3)** + `next/image` | Cheap, CDN-backed |
| Email | **Resend** (or Postmark) + React Email templates | Order confirmations, shipping, password-less auth |
| Validation | **Zod** | Shared schemas between forms, server actions and the spec system |
| Testing | **Vitest** (unit), **Playwright** (e2e) | |
| Hosting | **Vercel** (app) + **Neon / Supabase** (managed Postgres) | Low ops; can move to containers later |
| Observability | **Sentry** (errors), Vercel Analytics / PostHog (product analytics) | |
| CI | **GitHub Actions**: lint, typecheck, unit, e2e, Prisma migration check | |

---

## 3. Architecture

```
┌─────────────────────────── Next.js app ───────────────────────────┐
│  (storefront)   /, /c/[category], /p/[slug], /search, /cart       │
│  (builder)      /build, /build/[shareId]                          │
│  (account)      /account, /account/orders, /account/builds        │
│  (admin)        /admin/**   ← role-gated in middleware + server   │
│                                                                   │
│  Server actions / route handlers                                  │
│    ├─ catalog service      ├─ cart service    ├─ order service    │
│    ├─ compatibility engine (pure TS, shared with client)          │
│    └─ /api/webhooks/stripe  (source of truth for payment state)   │
└──────────────┬──────────────────────┬─────────────────┬───────────┘
               │                      │                 │
          PostgreSQL               Stripe          R2/S3, Resend
```

Principles:
- **Domain logic lives in `src/server/*` services**, not in React components
  or route files, so it is testable and reusable by admin + storefront.
- **The compatibility engine is a pure function** (`parts in → issues out`),
  runs on the client for instant feedback and again on the server before a
  build is added to cart.
- **Money is integer minor units** (cents) everywhere; never floats.
- **Stripe webhooks, not redirects, decide whether an order is paid.**

### Proposed repo layout
```
src/
  app/                 # routes (route groups: (shop), (account), admin, api)
  components/          # UI (ui/ = shadcn primitives)
  server/
    catalog/  cart/  orders/  inventory/  payments/  auth/  email/
  lib/
    compat/            # compatibility engine + rules + tests
    specs/             # per-category Zod spec schemas
    money.ts
prisma/
  schema.prisma  migrations/  seed.ts
tests/e2e/
docs/
```

---

## 4. Data model (initial)

```
User(id, email, name, role[CUSTOMER|STAFF|ADMIN], createdAt)
Address(id, userId, name, line1, line2, city, region, postalCode, country, phone, isDefault)

Category(id, slug, name, parentId, specSchemaKey)     # e.g. "cpu", "motherboard"
Brand(id, slug, name)
Product(id, slug, sku, mpn, upc, name, brandId, categoryId,
        description, specs JSONB, priceCents, compareAtCents,
        status[DRAFT|ACTIVE|ARCHIVED], weightGrams, createdAt, updatedAt)
ProductImage(id, productId, url, alt, position)
Inventory(productId PK, onHand, reserved, reorderPoint)
InventoryMovement(id, productId, delta, reason, orderId?, actorId?, createdAt)   # audit trail

Cart(id, userId?, anonymousToken?, updatedAt)
CartItem(cartId, productId, quantity)

Order(id, number, userId?, email, status, subtotalCents, shippingCents,
      taxCents, totalCents, currency, shippingAddress JSONB, billingAddress JSONB,
      stripePaymentIntentId, placedAt, ...)
OrderItem(id, orderId, productId, nameSnapshot, skuSnapshot, unitPriceCents, quantity)
Shipment(id, orderId, carrier, trackingNumber, shippedAt, deliveredAt)
Refund(id, orderId, amountCents, reason, stripeRefundId, createdAt)

Build(id, userId?, shareId, name, createdAt, updatedAt)
BuildItem(buildId, slot[CPU|COOLER|MOTHERBOARD|RAM|GPU|STORAGE|PSU|CASE|FAN|...], productId, quantity)

WishlistItem(userId, productId, createdAt)
AuditLog(id, actorId, action, entity, entityId, diff JSONB, createdAt)
```

### Specs: JSONB + per-category Zod schemas
PC parts have very different attributes per category. Rather than one table
per category, each `Product.specs` is JSONB validated by a Zod schema keyed by
`Category.specSchemaKey`. Example:

```ts
// lib/specs/cpu.ts
export const cpuSpecs = z.object({
  socket: z.enum(["AM5", "AM4", "LGA1851", "LGA1700"]),
  cores: z.number().int(), threads: z.number().int(),
  baseClockGhz: z.number(), boostClockGhz: z.number(),
  tdpW: z.number().int(),
  integratedGraphics: z.boolean(),
  memoryTypes: z.array(z.enum(["DDR4", "DDR5"])),
  includesCooler: z.boolean(),
});
```

The same schema drives: admin form generation, CSV import validation,
storefront filter facets, and compatibility rules. GIN index on `specs` plus
expression indexes for the hottest filter keys (e.g. `specs->>'socket'`).

### Order state machine
```
PENDING_PAYMENT → PAID → PROCESSING → SHIPPED → DELIVERED
       │            │         │
       ▼            ▼         ▼
   EXPIRED     CANCELLED  (PARTIALLY_)REFUNDED
```
Transitions only through `server/orders` functions; each writes an AuditLog entry.

---

## 5. PC builder & compatibility engine

### Builder UX
1. Slots listed in a sensible order: CPU → Motherboard → Memory → Storage →
   GPU → Case → PSU → Cooler → Fans.
2. Choosing a slot opens a part list **pre-filtered to compatible parts**
   (with a toggle to "show incompatible" greyed out with the reason).
3. Running summary: total price, estimated wattage, issues panel.
4. Build saved to localStorage for guests, to the DB for signed-in users;
   every build gets a shareable `/build/[shareId]` URL.
5. "Add build to cart" re-validates server-side and checks stock.

### Rule engine design
```ts
type Severity = "error" | "warning" | "info";
type Issue = { ruleId: string; severity: Severity; message: string; slots: Slot[] };
type Rule = (build: ResolvedBuild) => Issue[];
```
Rules are small, independent, unit-tested functions. Errors block "add build
to cart" (with an explicit override for experienced users); warnings don't.

### v1 rule set
| Rule | Severity |
|---|---|
| CPU socket = motherboard socket | error |
| Memory type (DDR4/DDR5) supported by motherboard (and CPU) | error |
| Memory module count ≤ motherboard slots; total capacity ≤ board max | error |
| Motherboard form factor fits case (ATX / mATX / ITX / E-ATX) | error |
| GPU length ≤ case max GPU length | error |
| CPU cooler height ≤ case max cooler height | error |
| Cooler supports CPU socket | error |
| AIO radiator size supported by case mount positions | error |
| PSU form factor fits case (ATX / SFX) | error |
| M.2 drives ≤ motherboard M.2 slots; SATA drives ≤ SATA ports | error |
| PSU wattage ≥ estimated load × 1.3 headroom (≥ 1.0 is warning, < 1.0 error) | warning / error |
| GPU power connectors (e.g. 12V-2x6) available on PSU | warning |
| No GPU and CPU lacks integrated graphics | error |
| CPU has no bundled cooler and no cooler selected | warning |
| Motherboard may need BIOS update for this CPU generation | warning |
| Memory speed above board/CPU rated speed (will run at lower speed) | info |

Power estimate = CPU TDP + GPU board power + fixed allowances per drive,
fan, and motherboard/RAM. Kept deliberately conservative.

**Data quality is the real risk here** — rules are only as good as the specs.
The spec schemas make the required fields mandatory per category, and the
admin import flags any product missing compatibility-critical fields.

---

## 6. Checkout, payments, tax & inventory

1. Cart is server-side (cookie token for guests, merged into user cart on sign-in).
2. Checkout collects email + shipping address → shipping rate + **Stripe Tax**
   quote → creates an `Order(PENDING_PAYMENT)` and a Stripe PaymentIntent with
   an idempotency key.
3. **Inventory reserved** when the order is created (`reserved += qty` in a
   transaction with a row lock / conditional update that fails if
   `onHand - reserved < qty`). Unpaid reservations expire after ~30 minutes
   via a scheduled job (Vercel Cron).
4. Stripe webhook `payment_intent.succeeded` → order `PAID`, reservation
   becomes a deduction, confirmation email sent. Webhook handler is
   idempotent (store processed event IDs).
5. Refunds/cancellations from admin call Stripe and restock via
   `InventoryMovement`.

Guest checkout is supported; an account can be created after purchase.

---

## 7. Admin dashboard

- **Role-gated** (`STAFF`, `ADMIN`) in middleware *and* in every server action.
- **Products**: list/search, create/edit with spec form generated from the
  category's Zod schema, image upload, draft/publish, CSV bulk import with a
  dry-run validation report.
- **Inventory**: stock levels, manual adjustments (with reason), low-stock view.
- **Orders**: filter by status, order detail, mark shipped (carrier + tracking
  → customer email), cancel, full/partial refund.
- **Customers**: lookup, order history.
- **Reports** (v1-lite): revenue by day, top products, low stock.
- **Audit log** of every admin mutation.

---

## 8. Non-functional requirements

**Security**
- Auth.js sessions, HTTP-only secure cookies; admin requires 2FA-capable
  provider or enforced Google Workspace account.
- Authorization checked server-side on every action (never trust the UI).
- Zod validation on all inputs; Prisma parameterised queries.
- Rate limiting on auth, checkout and search (Upstash Redis or similar).
- Stripe webhook signature verification; secrets only in env vars.
- Security headers / CSP; dependency scanning (Dependabot) in CI.

**SEO & performance**
- Category/product pages statically generated with revalidation on admin edits.
- `Product` / `Offer` / `BreadcrumbList` structured data, sitemap, canonical
  URLs for filtered pages.
- Image optimisation, Core Web Vitals budget in CI (Lighthouse CI).

**Accessibility**: WCAG 2.2 AA — keyboard-navigable builder, proper labels on
filters, colour isn't the only signal for compatibility errors.

**Legal / business** (needs owner input, see §10)
- Terms of sale, privacy policy, returns & warranty policy, shipping policy.
- Cookie consent if selling into EU/UK; GDPR/CCPA data export & deletion.
- Tax registration in the jurisdictions you sell into (Stripe Tax handles
  calculation, not registration).

**Operations**
- Daily automated DB backups (managed provider) + tested restore.
- Separate `preview` and `production` environments, Stripe test vs live keys.
- Error alerting via Sentry; uptime monitor on checkout.

---

## 9. Roadmap (phased)

Each phase ends with something deployable to a preview environment.

| Phase | Deliverable | Key tasks |
|---|---|---|
| **0. Foundations** | Empty app deployed with CI | Next.js + TS + Tailwind + shadcn; ESLint/Prettier; Prisma + Postgres; Auth.js skeleton; Vitest + Playwright; GitHub Actions; Sentry; env management |
| **1. Catalog + basic admin** | Browsable store with real-looking data | Category/brand/product schema; spec Zod schemas for CPU, motherboard, RAM, GPU, storage, PSU, case, cooler; seed data; admin product CRUD + image upload + CSV import; category pages with facets; product page; search |
| **2. Cart & checkout** | Can place a test-mode order end to end | Server cart; shipping rates; Stripe Payment Element + Stripe Tax; order creation + inventory reservation; webhooks; confirmation emails; reservation expiry cron |
| **3. Accounts** | Customers manage their stuff | Sign up/in; order history & tracking; saved addresses; wishlist; guest→account cart merge |
| **4. PC builder** | Full builder with compatibility | Rule engine + exhaustive unit tests; builder UI; compatible-part filtering; wattage estimate; saved/shared builds; add-build-to-cart |
| **5. Admin completion** | Staff can run the store | Order management (ship, cancel, refund); inventory adjustments; audit log; reports; low-stock alerts |
| **6. Launch hardening** | Production go-live | Security review; load test checkout; accessibility audit; SEO (structured data, sitemap); legal pages; live Stripe keys; backups & restore drill; monitoring/alerts; soft launch |

**v2 candidates:** reviews & ratings, price/stock alerts, product
comparison, Meilisearch/Typesense, distributor feed integrations (auto
stock/price sync), benchmark-based "build for budget X" suggestions,
promotions/discount codes, multi-currency, prebuilt-PC assembly service.

---

## 10. Open questions

These shape tax, shipping, data and legal work — please answer before Phase 2.

1. **Market**: which country/countries do you sell into, and in what currency?
2. **Fulfilment**: do you hold your own stock, dropship from distributors,
   or a mix? (Determines whether we need distributor API/feed integration.)
3. **Catalog source & size**: how many SKUs at launch, and where do product
   specs and images come from — manual entry, distributor feeds, or a
   content provider (e.g. Icecat)?
4. **Shipping**: flat rate, free over a threshold, or live carrier rates?
   Which carriers?
5. **Returns/warranty**: return window, restocking fees, DOA process?
6. **Payment methods** beyond cards/Apple Pay/Google Pay (e.g. PayPal,
   buy-now-pay-later)?
7. **Brand**: store name, domain, logo/colours — or should we design a
   placeholder identity?
8. **Admin users**: how many staff, and do they need different permission
   levels beyond STAFF/ADMIN?
9. **Budget for services** (hosting, DB, email, search) — affects
   managed-vs-self-hosted choices.

---

## 11. Immediate next steps

1. Review this plan; answer §10 where you can.
2. Start **Phase 0**: scaffold the Next.js project, CI, database and auth
   skeleton on this branch.
3. In parallel, decide the launch category list and gather a spreadsheet of
   ~50 real products to seed Phase 1 and validate the spec schemas.
