# Astral Tech Gaming — Project Plan

**astralgaming.ca** — an online store for PC components and custom-built
gaming PCs, with a guided **PC builder** that checks part compatibility and
lets customers have Astral Tech Gaming assemble the build for them.

This is a **real business** taking real orders, so payments, tax, fulfilment,
security and legal compliance are first-class concerns.

> Status: draft v2 — updated with the owner's answers (see §1). Remaining
> open questions are in [§11](#11-open-questions).

---

## 1. Business context

| Topic | Decision |
|---|---|
| Brand / domain | **Astral Tech Gaming** — `astralgaming.ca` |
| Market | **Canada**, prices in **CAD**. Worldwide is a possible later step. |
| Inventory | Owned stock (no dropshipping, no distributor feeds in v1) |
| Core service | Sell individual parts **and** build PCs in-house |
| Fulfilment | **In-person local delivery** only for now; shipping later |
| Payment methods | **Card** (online), **Interac e-Transfer**, **cash** (on delivery) |
| Returns | **30-day** return policy |
| Warranty | Handled by the manufacturer; we show the warranty terms on each product |
| Catalog data | Owner provides products, specs and images later. Until then we use placeholder seed data. |
| Admin users | **2**, both full admins |
| Running costs budget | **≤ $100 CAD / month** |

### What this changes from a "standard" online store
- **Assembly is a v1 feature, not v2.** A finished PC builder offers
  "Have us build it" (with an assembly fee) as well as "parts only".
- **Orders can be placed without online payment.** Cash and e-Transfer
  orders are paid offline and marked as paid by an admin, so payments are
  modelled separately from orders (§6).
- **No carrier shipping in v1.** Checkout checks the delivery address is in
  our service area and lets the customer request a delivery window. Admins
  confirm the time.
- **Canadian sales tax** (GST/HST/PST/QST) instead of a generic tax service.
- **Canadian privacy & anti-spam law** (PIPEDA, CASL) instead of GDPR.

---

## 2. Scope

### v1 (launch)
| Area | What ships |
|---|---|
| **Storefront** | Category browsing, spec filters (socket, chipset, memory type, wattage, form factor…), search, product pages, cart, checkout |
| **PC builder** | Step-by-step part picker, live compatibility checks, power estimate, shareable build links, add the whole build to the cart **as parts or as an assembled PC** |
| **Prebuilt PCs** | Admin-curated builds sold as a single product (a saved build plus an assembly fee) |
| **Checkout** | Card via Stripe, or e-Transfer / cash. Delivery-area check, preferred delivery window, Canadian tax. |
| **Accounts** | Sign in, order history & status, saved builds, wishlist, saved addresses, start a return |
| **Admin** | Products & specs, CSV import, inventory, orders (assembly → delivery), recording offline payments, returns & refunds, delivery schedule, basic reports |

### Out of scope for v1 (candidates for later)
Carrier shipping & international sales, multi-currency, French-language
site (needed before marketing in Quebec), reviews & ratings, price and
stock alerts, discount codes, financing / buy-now-pay-later, distributor
feed integrations.

### Success criteria
- A customer can design a compatible PC and order it assembled in < 5 minutes.
- Stock is never oversold, including across online and offline payment.
- Admins can run the whole order lifecycle without leaving the dashboard.
- Lighthouse ≥ 90 (performance, accessibility, SEO) on key pages.
- No card data touches our servers (Stripe-hosted fields → PCI SAQ A).
- Monthly infrastructure cost stays under $100 CAD.

---

## 3. Tech stack & monthly cost

| Concern | Choice | Est. cost / month (CAD) |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | — |
| UI | **Tailwind CSS + shadcn/ui** (Radix) | — |
| Hosting | **Vercel Pro** (the free Hobby plan doesn't allow commercial use) | ~$28 (1 developer seat) |
| Database | **PostgreSQL on Neon** (Launch plan) or Supabase Pro, with backups | ~$0–35 |
| ORM | **Prisma** | — |
| Auth | **Auth.js**: email magic link + Google; admins require Google sign-in from an allow-list | — |
| Card payments | **Stripe** Payment Element (cards, Apple Pay, Google Pay) | per-transaction fees only |
| Sales tax | **Our own province rate table** (admin-editable). Stripe Tax adds ~0.5% per transaction, which only becomes worth it with nationwide or international shipping. | — |
| Search & filters | Postgres full-text + JSONB filters (no separate search service) | — |
| Images | **Cloudflare R2** + `next/image` | ~$0 (free tier: 10 GB) |
| Email | **Resend** + React Email | ~$0 (free tier) → ~$28 if volume grows |
| Rate limiting | **Upstash Redis** | ~$0 (free tier) |
| Errors / analytics | **Sentry** (free) + Vercel Web Analytics | ~$0 |
| Domain | `astralgaming.ca` (already owned?) | ~$2 |
| **Total** | | **≈ $30–95**, typically under $60 |

Validation with **Zod**, tests with **Vitest** + **Playwright**, CI on
**GitHub Actions** (free minutes are enough).

---

## 4. Architecture

```
┌──────────────────────────── Next.js app ────────────────────────────┐
│  (shop)      /, /c/[category], /p/[slug], /prebuilt, /search, /cart │
│  (builder)   /build, /build/[shareId]                               │
│  (account)   /account, /account/orders, /account/builds             │
│  (info)      /returns, /delivery, /warranty, /privacy, /terms       │
│  admin       /admin/**   ← admin allow-list, checked in middleware  │
│                            AND in every server action               │
│                                                                     │
│  src/server/*  services: catalog · cart · orders · payments ·       │
│                inventory · delivery · tax · returns · email         │
│  src/lib/compat  compatibility engine (pure TS, client + server)    │
│  /api/webhooks/stripe   source of truth for card payments           │
└──────────────┬────────────────────────┬──────────────────┬──────────┘
          PostgreSQL                  Stripe          R2 · Resend
```

Principles:
- **Business logic lives in `src/server/*` services**, not in components,
  so the storefront and admin share it and it can be tested on its own.
- **Money is stored as whole cents** with a `currency` column (always
  `CAD` for now), so adding other currencies later doesn't need a migration.
- **All text the customer sees goes through a translation layer** from day
  one (English only for now), so adding French later is translation work
  rather than a refactor.
- **Stripe webhooks, not redirects, decide that a card order is paid.**

### Repo layout
```
src/
  app/            # routes: (shop), (builder), (account), (info), admin, api
  components/     # ui/ = shadcn primitives
  server/         # domain services
  lib/
    compat/       # compatibility rules + tests
    specs/        # per-category Zod spec schemas
    money.ts  tax.ts  i18n/
prisma/           # schema.prisma, migrations/, seed.ts
tests/e2e/
docs/
```

---

## 5. Data model

```
User(id, email, name, role[CUSTOMER|ADMIN], marketingConsentAt?, createdAt)
Address(id, userId, name, line1, line2, city, province, postalCode, country, phone, isDefault)

Category(id, slug, name, parentId, specSchemaKey)
Brand(id, slug, name)
Product(id, slug, sku, mpn, upc, name, brandId, categoryId, type[PART|PREBUILT|SERVICE],
        description, specs JSONB, priceCents, compareAtCents, currency,
        warrantyMonths, warrantyNotes, returnable, status[DRAFT|ACTIVE|ARCHIVED],
        prebuiltBuildId?, createdAt, updatedAt)
ProductImage(id, productId, url, alt, position)
Inventory(productId PK, onHand, reserved, reorderPoint)
InventoryMovement(id, productId, delta, reason, orderId?, returnId?, actorId?, createdAt)

Cart(id, userId?, anonymousToken?, updatedAt)
CartLine(id, cartId, productId?, buildId?, quantity, assemble Boolean)

Build(id, userId?, shareId, name, createdAt, updatedAt)
BuildItem(buildId, slot, productId, quantity)

Order(id, number, userId?, email, phone, status, fulfilment[DELIVERY|PICKUP],
      deliveryAddress JSONB, requestedWindow JSONB, scheduledAt?,
      subtotalCents, assemblyCents, deliveryCents, taxCents, totalCents,
      paidCents, currency, taxBreakdown JSONB, placedAt, ...)
OrderLine(id, orderId, productId, buildGroupId?, nameSnapshot, skuSnapshot,
          unitPriceCents, quantity)
BuildGroup(id, orderId, buildSnapshot JSONB, assemble, assemblyFeeCents)

Payment(id, orderId, method[CARD|ETRANSFER|CASH], amountCents,
        status[PENDING|SUCCEEDED|FAILED|REFUNDED], stripePaymentIntentId?,
        reference?, recordedById?, receivedAt?)
Refund(id, orderId, paymentId, amountCents, method, reason, stripeRefundId?, createdAt)

ReturnRequest(id, orderId, status[REQUESTED|APPROVED|RECEIVED|REFUNDED|REJECTED],
              reason, lines JSONB, requestedAt, resolvedAt)

ServiceArea(id, name, postalPrefixes[], deliveryFeeCents, active)
TaxRate(province PK, gstRate, pstRate, hstRate, qstRate, effectiveFrom)

WishlistItem(userId, productId, createdAt)
AuditLog(id, actorId, action, entity, entityId, diff JSONB, createdAt)
```

### Per-category specs
Each `Product.specs` is JSONB checked against a Zod schema chosen by
`Category.specSchemaKey`. That one schema drives the admin edit form, CSV
import checks, storefront filters and compatibility rules.

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

We'll publish a **CSV template per category** so the owner can fill in
products, specs and images in a spreadsheet and bulk-import them.

### Order lifecycle
```
PLACED ──► CONFIRMED ──► ASSEMBLING ──► READY ──► OUT_FOR_DELIVERY ──► DELIVERED
  │           │              (assembled builds only)
  ▼           ▼
CANCELLED  CANCELLED                     DELIVERED ──► (PARTIALLY_)RETURNED
```
Payment status (`UNPAID → PARTIALLY_PAID → PAID → REFUNDED`) is tracked
separately, worked out from the order's `Payment` rows. This is what lets
cash-on-delivery and e-Transfer orders move through fulfilment before or
after they're paid, depending on the payment rules in §6.

---

## 6. Checkout, payments, tax & delivery

### Checkout flow
1. The cart is stored on the server (a cookie identifies guests; their cart
   merges into their account when they sign in).
2. The customer enters a delivery address. The postal code must fall in an
   active **ServiceArea**, otherwise the order can't go through (the page
   offers a "contact us" fallback).
3. The customer chooses preferred delivery days and times. An admin confirms
   the exact time afterwards.
4. Tax is calculated from the delivery province's **TaxRate** row and the
   breakdown (e.g. GST + PST) is stored on the order for receipts.
5. The customer chooses a payment method:
   - **Card**: Stripe Payment Element. The order is created as `PLACED`
     with a pending Payment. The Stripe webhook marks it `SUCCEEDED`, then
     the order becomes `CONFIRMED` and a confirmation email is sent.
   - **e-Transfer**: the confirmation page and email show where to send the
     money and an order-number reference. An admin records the Payment when
     it arrives.
   - **Cash**: paid on delivery, recorded by the admin when it's collected.
6. **Stock is reserved** when the order is created, using a guarded update
   inside a transaction that fails if `onHand − reserved < qty`. Unpaid
   reservations expire after a set time (a daily Vercel Cron job sends
   reminders, then cancels).

### Recommended payment rules (owner to confirm, §11)
| Order type | Card | e-Transfer | Cash |
|---|---|---|---|
| Parts only | Paid upfront | Paid before delivery; reservation held 48 h | Allowed, up to a set order total |
| Assembled PC | Paid upfront | Full payment or deposit before assembly starts | Deposit (card/e-Transfer) required before assembly, rest on delivery |

Reason: cash-on-delivery for a custom build means parts are taken out of
stock and assembled before any money is committed. A deposit protects
against no-shows.

### Tax
- Province rates live in the **TaxRate** table and can be edited in admin
  without a code change (for example when a province changes its rate).
- Assembly and delivery fees are taxed like the goods.
- Receipts and invoices show our GST/HST registration number.
- The owner should confirm registration status and treatment with an
  accountant before launch.

### Returns (30 days)
- Customers start a return from their order page within 30 days of delivery.
- An admin approves it, receives the items, and refunds or rejects.
- Stripe refunds card payments automatically. e-Transfer and cash refunds
  are recorded by hand.
- Returned items go back into stock (or are written off) through
  `InventoryMovement`.
- The policy page spells out conditions (e.g. opened parts, assembled
  builds, DOA vs change of mind). Wording is to be confirmed (§11).

---

## 7. PC builder & compatibility engine

### Builder UX
1. Slots in this order: CPU → Motherboard → Memory → Storage → GPU → Case →
   PSU → Cooler → Fans → (optional) OS / accessories.
2. Each slot's part list is **pre-filtered to compatible, in-stock parts**,
   with a toggle to show incompatible parts greyed out alongside the reason.
3. A running summary shows the price, estimated wattage and any issues.
4. Guests' builds are saved in the browser; signed-in users' builds are saved
   to their account. Every build gets a shareable link.
5. A **"Have us build it"** toggle adds the assembly fee. The build is
   checked again on the server, and stock is checked, before it goes into
   the cart.
6. Admins can publish any build as a **Prebuilt PC** product.

### Rule engine
```ts
type Severity = "error" | "warning" | "info";
type Issue = { ruleId: string; severity: Severity; message: string; slots: Slot[] };
type Rule = (build: ResolvedBuild) => Issue[];
```
Errors block adding an **assembled** build to the cart (we won't assemble
something that can't work). For parts-only orders, errors show a warning the
customer must acknowledge.

### v1 rules
| Rule | Severity |
|---|---|
| CPU socket = motherboard socket | error |
| Memory type (DDR4/DDR5) supported by motherboard and CPU | error |
| Memory modules ≤ motherboard slots; total capacity ≤ board max | error |
| Motherboard form factor fits case | error |
| GPU length ≤ case max GPU length | error |
| Cooler height ≤ case max cooler height | error |
| Cooler supports CPU socket | error |
| AIO radiator size supported by case | error |
| PSU form factor fits case (ATX / SFX) | error |
| M.2 drives ≤ M.2 slots; SATA drives ≤ SATA ports | error |
| PSU wattage vs estimated load (< 1.0× error, < 1.3× warning) | error / warning |
| GPU power connectors (e.g. 12V-2x6) available on PSU | warning |
| No GPU and CPU has no integrated graphics | error |
| No cooler selected and CPU has no bundled cooler | warning |
| Motherboard may need a BIOS update for this CPU | warning |
| Memory faster than the board or CPU supports | info |

Specs data quality is the main risk, so the specs that compatibility rules
rely on are **required** in the schemas, and CSV import rejects rows that
are missing them.

---

## 8. Admin dashboard (2 admins)

- **Access**: an allow-list of 2 Google accounts with 2-step verification
  enforced on those accounts. One `ADMIN` role; no staff tiers needed.
- **Today view**: new orders, payments to confirm, builds to assemble,
  deliveries scheduled today, low stock.
- **Products**: create/edit with forms generated from each category's spec
  schema, image upload, draft/publish, CSV import with a dry run first,
  prebuilt PCs.
- **Inventory**: stock levels, manual adjustments (with a reason), low-stock list.
- **Orders**: status board (Placed → Assembling → Ready → Out for delivery
  → Delivered), record e-Transfer and cash payments, schedule delivery,
  print a build sheet / packing slip, cancel, refund.
- **Returns**: approve, receive, refund, restock.
- **Settings**: service areas & delivery fees, tax rates, assembly fee,
  store info (GST/HST number, e-Transfer email).
- **Reports**: revenue by day/month and by payment method, top products,
  stock value.
- **Audit log** of every admin change.

---

## 9. Non-functional requirements

**Security**
- Secure, HTTP-only session cookies; admin access checked on the server for
  every action.
- Zod validation on all inputs; Prisma queries are parameterised.
- Rate limiting on sign-in, checkout and search.
- Stripe webhook signature verification; the handler is safe to run twice
  on the same event.
- Security headers / CSP; Dependabot alerts.

**SEO & performance**
- Category and product pages are pre-rendered and refreshed when an admin
  edits them.
- Product structured data, sitemap, canonical URLs, local-business
  structured data for astralgaming.ca.

**Accessibility**: WCAG 2.2 AA. The builder works with a keyboard, and
compatibility problems aren't shown by colour alone.

**Legal (Canada)**
- **PIPEDA**: privacy policy, access/deletion requests handled by admins.
- **CASL**: marketing emails only with explicit opt-in (stored with a
  timestamp); transactional emails are fine without it.
- **Quebec**: if delivering to or marketing in Quebec, plan for a French
  version of the site (Bill 96) and Law 25 privacy obligations.
- Terms of sale, 30-day return policy, delivery policy, warranty page
  ("warranty is provided by the manufacturer", plus links to their
  support pages).

**Operations**
- Separate preview and production environments, with Stripe test keys vs
  live keys.
- Managed daily database backups, plus one restore test before launch.
- Sentry alerts; uptime monitor on the home page and checkout.

---

## 10. Roadmap

Each phase ends with something you can try on a preview site.

| Phase | Deliverable | Key tasks |
|---|---|---|
| **0. Foundations** | Empty app deployed, CI green | Next.js + TS + Tailwind + shadcn; lint/format; Prisma + Neon; Auth.js with admin allow-list; Vitest + Playwright; GitHub Actions; Sentry; Astral Tech Gaming placeholder branding |
| **1. Catalog + product admin** | Browsable store with placeholder data | Categories, brands, products, spec schemas for 8 core categories; seed data; admin product editing + R2 image upload; CSV templates & import; category filters; product pages; search |
| **2. Cart, checkout & payments** | Test orders end to end with all 3 payment methods | Cart; service-area check; delivery window request; province tax table; Stripe card payments + webhooks; e-Transfer/cash flows; stock reservation & expiry; confirmation emails |
| **3. PC builder & assembly** | Design a PC and order it assembled | Rule engine + thorough tests; builder UI; compatible-part filtering; wattage estimate; saved/shared builds; assembly option; prebuilt PCs |
| **4. Accounts** | Customers self-serve | Sign in; order history & status; saved builds & addresses; wishlist; return requests |
| **5. Admin operations** | Admins can run the business | Today view; order board; offline payment recording; delivery scheduling; returns & refunds; build sheets; settings; reports; audit log |
| **6. Launch** | astralgaming.ca live | Owner's real catalog imported; legal pages; security & accessibility review; production Stripe; DNS & email domain auth (SPF/DKIM); backup restore test; monitoring; soft launch with friends & family |

**Later:** carrier shipping across Canada (Canada Post / courier rates),
French site, international sales & multi-currency, Stripe Tax, reviews,
stock alerts, discount codes, financing.

---

## 11. Open questions

1. **Home base & delivery area**: which city, and which postal codes /
   radius do you deliver to? Flat delivery fee, tiered by distance, or free?
2. **Pickup**: should customers also be able to pick up orders in person?
3. **Assembly**: flat assembly fee or tiered? Typical turnaround time to
   show customers? Is an OS installed (and sold) as part of the build?
4. **Payment rules**: are the recommended deposit / cash limits in §6 OK?
   Any maximum order total for cash?
5. **Returns detail**: does the 30-day policy cover opened parts and
   assembled PCs? Any restocking fee? How are dead-on-arrival parts
   handled vs change of mind?
6. **Tax**: are you GST/HST-registered, and in which province is the
   business based?
7. **Brand assets**: do you have a logo and brand colours, and is
   `astralgaming.ca` already registered (and where is its DNS)?
8. **Quebec**: do you expect Quebec customers in the near term?

---

## 12. Next steps

1. Owner answers §11 where possible (none of these block Phase 0 or 1).
2. Start **Phase 0** on this branch.
3. When you're ready to supply products, we'll send you the per-category CSV
   templates from Phase 1.
