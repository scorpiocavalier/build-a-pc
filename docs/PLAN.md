# Astral Tech Gaming — Project Plan

**astralgaming.ca** — a bilingual (English/French) online store for PC
components and custom-built gaming PCs, with a guided **PC builder** that
checks part compatibility and lets customers have Astral Tech Gaming
assemble the build, with Windows installed.

This is a **real business** taking real orders, so payments, tax, fulfilment,
security and legal compliance are first-class concerns.

> Status: draft v3 — updated with the owner's second round of answers.
> Remaining open questions are in [§11](#11-open-questions).

---

## 1. Business context

| Topic | Decision |
|---|---|
| Brand / domain | **Astral Tech Gaming** — `astralgaming.ca` (**not yet registered**, see §12) |
| Locations | **Toronto, ON** and **Montreal, QC** — both offer **pickup** and local **in-person delivery** |
| Market | Canada, prices in **CAD**. Worldwide is a possible later step. |
| Languages | **English and French from launch** (Quebec customers are expected soon) |
| Inventory | Owned stock (no dropshipping) |
| Core service | Sell individual parts **and** build PCs in-house |
| Assembly | **Flat fee**, about **1 hour** of build time, **Windows included** |
| Fulfilment | Pickup at either location, or in-person delivery near either city. Carrier shipping later. |
| Payment methods | **Card** (online), **Interac e-Transfer**, **cash**. Cash is capped at **$10,000** per order. Deposits are accepted for custom builds. |
| Returns | **30 days**. Assembled PCs can be returned **only if found defective**. **30% restocking fee** on returns that aren't for a defect. |
| Warranty | Handled by the manufacturer; we show the warranty terms on each product |
| Sales tax | **Registration status unknown.** Tax collection can be switched on per province (§6). |
| Catalog data | Owner provides products, specs and images later. Placeholder seed data until then. |
| Admin users | **2**, both full admins |
| Running costs budget | **≤ $100 CAD / month** |

### What these answers mean for the build
- **Two locations are built in from the start.** Each location has its own
  address, pickup hours, delivery area and stock count. Orders are
  fulfilled from one location.
- **Bilingual from day one.** URLs are `/en/...` and `/fr/...`. Product
  names and descriptions are stored in both languages. Emails, receipts and
  legal pages exist in both.
- **Quebec rules apply at launch**: French version of the site (Charter of
  the French Language / Bill 96), Law 25 privacy obligations, and Quebec
  consumer protection rules for the returns policy.
- **Two tax regimes**: Ontario HST, and Quebec GST + QST.
- **Windows becomes an inventory item.** Each assembled build uses up one
  Windows licence, so licences are tracked like any other stock.

---

## 2. Scope

### v1 (launch)
| Area | What ships |
|---|---|
| **Storefront (EN/FR)** | Category browsing, spec filters (socket, chipset, memory type, wattage, form factor…), search, product pages showing stock at each location, cart, checkout |
| **PC builder** | Step-by-step part picker, live compatibility checks, power estimate, shareable build links, add the whole build to the cart **as parts or assembled with Windows** |
| **Prebuilt PCs** | Admin-curated builds sold as one product |
| **Checkout** | Choose pickup or delivery and a location. Pay by card, e-Transfer or cash, or pay a deposit on custom builds. Province-aware tax (when switched on). |
| **Accounts** | Sign in, order history & status, saved builds, wishlist, addresses, start a return, preferred language |
| **Admin** | Products & specs (EN/FR), CSV import, stock per location, orders (assembly → pickup/delivery), recording offline payments, returns with restocking fees, schedules, settings, reports |

### Out of scope for v1 (candidates for later)
Carrier shipping & international sales, multi-currency, reviews & ratings,
price and stock alerts, discount codes, financing / buy-now-pay-later,
distributor feed integrations, transfers of stock between the two locations
through the website (in v1 these are a manual stock adjustment).

### Success criteria
- A customer can design a compatible PC and order it assembled in < 5 minutes.
- Stock is never oversold at either location, including on cash and
  e-Transfer orders.
- Every page and email a customer sees is available in French.
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
| Translations | **next-intl**, with locale-prefixed routes (`/en`, `/fr`) | — |
| Hosting | **Vercel Pro** (the free Hobby plan doesn't allow commercial use) | ~$28 (1 developer seat) |
| Database | **PostgreSQL on Neon** (Launch plan) or Supabase Pro, with backups | ~$0–35 |
| ORM | **Prisma** | — |
| Auth | **Auth.js**: email magic link + Google; admins require Google sign-in from an allow-list | — |
| Card payments | **Stripe** Payment Element (cards, Apple Pay, Google Pay), with French-language checkout | per-transaction fees only |
| Sales tax | **Our own province rate table**, with a switch to turn collection on or off per province | — |
| Search & filters | Postgres full-text in English and French + JSONB filters | — |
| Images | **Cloudflare R2** + `next/image` | ~$0 (free tier: 10 GB) |
| Email | **Resend** + React Email (EN/FR templates) | ~$0 → ~$28 if volume grows |
| Rate limiting | **Upstash Redis** | ~$0 (free tier) |
| Errors / analytics | **Sentry** + Vercel Web Analytics (no cookies, which keeps Law 25 consent simple) | ~$0 |
| Domain | `astralgaming.ca` | ~$2 (~$20/yr) |
| **Total** | | **≈ $30–95**, typically under $60 |

Validation with **Zod**, tests with **Vitest** + **Playwright**, CI on
**GitHub Actions**.

---

## 4. Architecture

```
┌──────────────────────────── Next.js app ────────────────────────────┐
│  /[locale]/ (en | fr)                                               │
│    (shop)     /, /c/[category], /p/[slug], /prebuilt, /search, /cart│
│    (builder)  /build, /build/[shareId]                              │
│    (account)  /account, /account/orders, /account/builds            │
│    (info)     /locations, /returns, /warranty, /privacy, /terms     │
│  /admin/**    ← admin allow-list, checked in middleware             │
│                 AND in every server action                          │
│                                                                     │
│  src/server/*  services: catalog · cart · orders · payments ·       │
│                inventory · locations · fulfilment · tax · returns · │
│                email                                                │
│  src/lib/compat  compatibility engine (pure TS, client + server)    │
│  /api/webhooks/stripe   source of truth for card payments           │
└──────────────┬────────────────────────┬──────────────────┬──────────┘
          PostgreSQL                  Stripe          R2 · Resend
```

Principles:
- **Business logic lives in `src/server/*` services**, not in components,
  so the storefront and admin share it and it can be tested on its own.
- **Money is stored as whole cents** with a `currency` column (always `CAD`
  for now).
- **No hard-coded customer-facing text.** UI strings come from `messages/en.json`
  and `messages/fr.json`. Product content uses translatable fields. CI fails
  if a key exists in one language but not the other.
- **The admin dashboard is English-only** (only 2 internal users), which
  keeps the translation work focused on what customers see.
- **Stripe webhooks, not redirects, decide that a card payment succeeded.**

### Repo layout
```
src/
  app/[locale]/   # (shop), (builder), (account), (info)
  app/admin/      # English-only dashboard
  app/api/
  components/     # ui/ = shadcn primitives
  server/         # domain services
  lib/
    compat/       # compatibility rules + tests
    specs/        # per-category Zod spec schemas + EN/FR labels
    money.ts  tax.ts
messages/         # en.json, fr.json
prisma/           # schema.prisma, migrations/, seed.ts
tests/e2e/
docs/
```

---

## 5. Data model

```
User(id, email, name, role[CUSTOMER|ADMIN], locale[en|fr], marketingConsentAt?, createdAt)
Address(id, userId, name, line1, line2, city, province, postalCode, country, phone, isDefault)

Location(id, code[TOR|MTL], name, address JSONB, province, phone,
         pickupHours JSONB, deliveryFeeCents, deliveryPostalPrefixes[], active)

Category(id, slug, name {en,fr}, parentId, specSchemaKey)
Brand(id, slug, name)
Product(id, slug {en,fr}, sku, mpn, upc, name {en,fr}, description {en,fr},
        brandId, categoryId, type[PART|PREBUILT|SOFTWARE_LICENSE|SERVICE],
        specs JSONB, priceCents, compareAtCents, currency,
        warrantyMonths, warrantyNotes {en,fr}, status[DRAFT|ACTIVE|ARCHIVED],
        prebuiltBuildId?, createdAt, updatedAt)
ProductImage(id, productId, url, alt {en,fr}, position)
Inventory(productId, locationId, onHand, reserved, reorderPoint)   PK(productId, locationId)
InventoryMovement(id, productId, locationId, delta, reason[SALE|RETURN|ADJUSTMENT|TRANSFER|WRITE_OFF],
                  orderId?, returnId?, actorId?, note, createdAt)

Cart(id, userId?, anonymousToken?, locationId?, updatedAt)
CartLine(id, cartId, productId?, buildId?, quantity, assemble Boolean)

Build(id, userId?, shareId, name, createdAt, updatedAt)
BuildItem(buildId, slot, productId, quantity)

Order(id, number, userId?, email, phone, locale, status,
      locationId, fulfilment[PICKUP|DELIVERY], deliveryAddress JSONB?,
      requestedWindow JSONB, scheduledAt?,
      subtotalCents, assemblyCents, deliveryCents, taxCents, totalCents,
      depositRequiredCents, paidCents, currency, taxBreakdown JSONB, placedAt, ...)
OrderLine(id, orderId, productId, buildGroupId?, nameSnapshot, skuSnapshot,
          unitPriceCents, quantity)
BuildGroup(id, orderId, buildSnapshot JSONB, assemble, assemblyFeeCents,
           windowsLicenseProductId?, assembledById?, assembledAt?)

Payment(id, orderId, method[CARD|ETRANSFER|CASH], kind[DEPOSIT|BALANCE|FULL],
        amountCents, status[PENDING|SUCCEEDED|FAILED|REFUNDED],
        stripePaymentIntentId?, reference?, recordedById?, receivedAt?)
Refund(id, orderId, paymentId, amountCents, restockingFeeCents, method,
       reason, stripeRefundId?, createdAt)

ReturnRequest(id, orderId, type[DEFECTIVE|CHANGE_OF_MIND],
              status[REQUESTED|APPROVED|RECEIVED|INSPECTED|REFUNDED|REJECTED],
              reason, lines JSONB, restockingFeeCents, inspectionNotes,
              requestedAt, resolvedAt)

TaxRate(province PK, gstRate, pstRate, hstRate, qstRate, collect Boolean, effectiveFrom)
Setting(key PK, value JSONB)   # assembly fee, deposit %, cash cap, restocking %, return window,
                               # e-Transfer email, GST/HST & QST numbers, build turnaround

WishlistItem(userId, productId, createdAt)
AuditLog(id, actorId, action, entity, entityId, diff JSONB, createdAt)
```

`{en,fr}` marks a translatable field, stored as JSONB `{ "en": "...", "fr": "..." }`.
When French is missing, the site falls back to English and the admin flags
the product as "missing French".

### Per-category specs
Each `Product.specs` is JSONB checked against a Zod schema chosen by
`Category.specSchemaKey`. That one schema drives the admin edit form, CSV
import checks, storefront filters (with EN/FR labels) and compatibility
rules. Spec values are mostly language-neutral (sockets, wattages, sizes),
so only the labels need translating.

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

There will be a **CSV template for each category**, with `name_en`,
`name_fr`, `description_en`, `description_fr` and the spec columns, so the
owner can prepare the catalog in a spreadsheet.

### Order lifecycle
```
PLACED ─► CONFIRMED ─► ASSEMBLING ─► READY ─┬─► PICKED_UP
  │          │        (assembled builds)    └─► OUT_FOR_DELIVERY ─► DELIVERED
  ▼          ▼
CANCELLED  CANCELLED                 PICKED_UP / DELIVERED ─► (PARTIALLY_)RETURNED
```
Payment status (`UNPAID → DEPOSIT_PAID → PAID → (PARTIALLY_)REFUNDED`) is
tracked separately, worked out from the order's `Payment` rows.

---

## 6. Checkout, payments, tax & fulfilment

### Checkout flow
1. The cart is stored on the server (a cookie identifies guests; their cart
   merges into their account when they sign in).
2. The customer chooses **Pickup** (Toronto or Montreal) or **Delivery**
   (the postal code must be in one location's delivery area, which picks
   the fulfilling location).
3. Availability is checked against **that location's stock**. Items
   available only at the other location are flagged, and admins can
   arrange a manual transfer.
4. The customer chooses preferred days and times for pickup or delivery.
   An admin confirms.
5. Tax is calculated from the **TaxRate** row for the province where the
   goods are handed over (the pickup location's province, or the delivery
   address's province). It is applied only when that province's `collect`
   switch is on.
6. Payment (rules below). **Stock is reserved** when the order is placed,
   using a guarded update inside a transaction. Unpaid reservations expire
   after a set time: a daily cron job sends a reminder, then cancels.

### Payment rules (all values editable in admin Settings)
| Order type | Card | e-Transfer | Cash |
|---|---|---|---|
| Parts only | Paid upfront | Paid before pickup/delivery; reservation held 48 h | Paid at pickup/delivery |
| Assembled PC | Full amount, or **deposit** upfront and the rest at pickup/delivery | Full amount, or deposit before assembly starts | **Deposit (card or e-Transfer) required before assembly**; rest in cash |

- **Cash cap**: checkout won't offer cash when the order total is
  **$10,000 or more**. The rest of the payment must be by card or
  e-Transfer.
  > ⚠️ Check with an accountant: the federal government has proposed
  > restrictions on businesses accepting cash payments of $10,000 or more
  > (Bill C-2, *Strong Borders Act*). Keeping the cap just under $10,000
  > is the safe default.
- **Deposit**: a percentage (e.g. 30%) or fixed amount, set in Settings.
  Assembly can't start until it's received.
- **Card balance payments**: a payment link is emailed when the build is
  ready, or the balance is paid in person.

### Tax
| Province | Rate | Notes |
|---|---|---|
| Ontario | HST 13% | |
| Quebec | GST 5% + QST 9.975% | QST is registered with Revenu Québec, separately from GST |

Rates live in the database and can be edited in admin without a code change.
- **Registration status is unknown**, so each province has a "collect tax"
  switch. While it's off, checkout shows no tax and receipts don't show a
  registration number.
- Small suppliers (under about $30,000 in taxable sales over four quarters)
  generally aren't required to register for GST/HST or QST. They can
  register voluntarily, and a business selling in two provinces usually
  benefits from doing so. **The owner should confirm this with an
  accountant before launch.**
- Assembly fees and the Windows licence are taxed like the goods.

### Assembly & Windows
- **Flat assembly fee** (amount set in Settings) for any assembled build.
- A **Windows licence** product (Home or Pro, see §11) is added
  automatically to every assembled build and taken from that location's
  stock. Either its price is folded into the assembly fee, or it's shown
  as its own line (§11).
- **Turnaround**: about 1 hour to build, plus testing and queue time. The
  storefront shows "Ready in X business days", set in Settings.
- Admins get a printable **build sheet** (parts list, BIOS/Windows
  checklist, sign-off fields, licence recorded).

### Returns (30 days)
| Situation | Allowed? | Restocking fee |
|---|---|---|
| Part, change of mind, within 30 days | Yes | **30%** |
| Part, defective / dead on arrival | Yes (refund or exchange) | None |
| Assembled PC, change of mind | **No** | — |
| Assembled PC, found defective on inspection | Yes (repair, replace or refund) | None |
| Windows licence once activated | No | — |

Flow: the customer requests a return → an admin approves it → items are
received at a location → inspected (defective or not, which sets the fee) →
refunded (card through Stripe; e-Transfer or cash recorded by hand) →
restocked or written off.

> ⚠️ Have the final policy wording checked against Ontario and Quebec
> consumer protection rules, especially the restocking fee and how it's
> shown before purchase. The fee must be stated clearly at checkout and in
> the order confirmation.

---

## 7. PC builder & compatibility engine

### Builder UX
1. Slots in this order: CPU → Motherboard → Memory → Storage → GPU → Case →
   PSU → Cooler → Fans → accessories.
2. Each slot's part list is **pre-filtered to compatible parts in stock at
   the selected location**, with a toggle to show incompatible parts
   greyed out alongside the reason.
3. A running summary shows the price, estimated wattage and any issues.
4. Guests' builds are saved in the browser; signed-in users' builds are
   saved to their account. Every build gets a shareable link.
5. **"Have us build it"** adds the flat assembly fee and Windows. The build
   is checked again on the server, and stock is checked, before it goes
   into the cart.
6. Admins can publish any build as a **Prebuilt PC** product.

### Rule engine
```ts
type Severity = "error" | "warning" | "info";
type Issue = { ruleId: string; severity: Severity; messageKey: string; params: object; slots: Slot[] };
type Rule = (build: ResolvedBuild) => Issue[];
```
Rules return translation keys rather than text, so every issue appears in
English or French. Errors block adding an **assembled** build to the cart.
For parts-only orders, the customer must acknowledge errors before adding.

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
| Motherboard may need a BIOS update for this CPU | warning (admins see it on the build sheet) |
| Memory faster than the board or CPU supports | info |
| Assembled build has no storage drive to install Windows on | error |

The specs these rules rely on are **required** in the schemas, and CSV
import rejects rows that are missing them.

---

## 8. Admin dashboard (2 admins, English)

- **Access**: an allow-list of 2 Google accounts with 2-step verification
  enforced. One `ADMIN` role.
- **Today view** (filter by location): new orders, payments and deposits
  to confirm, builds to assemble, pickups and deliveries today, low stock.
- **Products**: EN/FR fields side by side, forms generated from each
  category's spec schema, image upload, draft/publish, "missing French"
  filter, CSV import with a dry run first, prebuilt PCs.
- **Inventory**: stock per location, adjustments (with a reason), manual
  transfers between Toronto and Montreal, Windows licence count, low-stock list.
- **Orders**: status board, record e-Transfer, cash and deposit payments,
  send a balance payment link, schedule pickup or delivery, build sheet /
  packing slip, cancel, refund.
- **Returns**: approve, receive, inspect (defective or change of mind),
  automatic restocking fee, refund, restock or write off.
- **Settings**: locations & hours, delivery areas & fees, tax rates and
  collection switches, registration numbers, assembly fee, deposit, cash
  cap, restocking %, return window, build turnaround, e-Transfer email.
- **Reports**: revenue by period, location and payment method; top
  products; stock value per location; deposits still waiting on a balance.
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
- `hreflang` links between `/en` and `/fr` pages; French slugs.
- Product structured data, sitemap, LocalBusiness structured data for each
  of the two locations.

**Accessibility**: WCAG 2.2 AA. The builder works with a keyboard, and
compatibility problems aren't shown by colour alone.

**Legal (Canada & Quebec)**
- **French language (Bill 96)**: the full customer-facing site, checkout,
  emails, invoices and terms are in French, and French must be at least as
  available as English.
- **Privacy (PIPEDA + Quebec Law 25)**: bilingual privacy policy, a named
  person responsible for privacy, a way to request data access or
  deletion, a privacy incident log, and no tracking cookies without consent
  (cookieless analytics avoids needing a consent banner in v1).
- **CASL**: marketing emails only with explicit opt-in (stored with a
  timestamp).
- **Consumer protection (ON & QC)**: terms of sale, the 30-day return policy
  with the restocking fee shown clearly before purchase, warranty page
  ("warranty is provided by the manufacturer", plus links).

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
| **0. Foundations** | Empty bilingual app deployed, CI green | Next.js + TS + Tailwind + shadcn; next-intl with `/en` `/fr` routing and a CI check for missing translations; lint/format; Prisma + Neon; Auth.js with admin allow-list; Vitest + Playwright; GitHub Actions; Sentry; placeholder Astral Tech Gaming branding |
| **1. Catalog + product admin** | Browsable bilingual store with placeholder data | Locations; categories, brands, products with EN/FR fields; spec schemas for 8 core categories; stock per location; admin product editing + R2 image upload; CSV templates & import; filters; product pages; search in both languages |
| **2. Cart, checkout & payments** | Test orders end to end: pickup & delivery, all 3 payment methods | Cart; pickup/delivery & location selection; time windows; province tax with collection switches; Stripe card payments + webhooks; e-Transfer, cash, deposits, cash cap; stock reservation & expiry; bilingual emails |
| **3. PC builder & assembly** | Design a PC and order it assembled with Windows | Rule engine (translated messages) + thorough tests; builder UI; compatible-part filtering per location; wattage estimate; saved/shared builds; assembly fee + Windows licence; prebuilt PCs; build sheet |
| **4. Accounts** | Customers self-serve | Sign in; order history & status; saved builds & addresses; wishlist; return requests; language preference |
| **5. Admin operations** | Admins can run both locations | Today view; order board; offline & deposit payments; balance payment links; pickup/delivery scheduling; returns with inspection & restocking fee; transfers; settings; reports; audit log |
| **6. Launch** | astralgaming.ca live | Owner's real catalog (EN/FR) imported; legal pages reviewed (EN/FR); tax registration settled & switches set; security & accessibility review; production Stripe; DNS & email domain setup (SPF/DKIM); backup restore test; monitoring; soft launch |

**Later:** carrier shipping across Canada, international sales &
multi-currency, Stripe Tax, reviews, stock alerts, discount codes,
financing, stock transfer workflow.

---

### Progress

- **Phase 0: done.**
- **Phase 1: done**, with two deliberate differences from §5:
  - Product URLs use one slug for both languages (e.g. `/fr/p/amd-ryzen-7-9800x3d`).
    Model names are mostly the same in both languages; per-language slugs can come later.
  - Unknown product URLs show the not-found page with `noindex` but an HTTP
    200 status, because pages stream before the product lookup finishes.

## 11. Open questions

1. **Delivery areas**: how far from each location do you deliver (e.g.
   Toronto and the GTA, Montreal Island and Laval)? What's the delivery fee
   for each, or is it free?
2. **Stock**: is stock kept separately at Toronto and Montreal (our current
   assumption), or is it one shared pool?
3. **Assembly fee & Windows**: how much is the flat fee? Is the Windows
   licence included in that fee or shown as its own line? Windows Home,
   Pro, or a choice for the customer?
4. **Deposit**: percentage or fixed amount for custom builds? Is it
   refundable if the customer cancels before assembly?
5. **Restocking fee**: does the 30% apply to unopened parts too, or only to
   opened ones?
6. **French product content**: will you provide French names and
   descriptions, or should we start with machine translation that you
   review?
7. **Business registration**: is the business registered in Ontario,
   Quebec or both, and do you have (or plan to talk to) an accountant
   about GST/HST/QST?

---

## 12. Next steps

1. **Register `astralgaming.ca` now**, before someone else takes it
   (~$20/year at any CIRA-certified registrar; `.ca` requires a Canadian
   presence, which the business meets).
2. Talk to an accountant about GST/HST/QST registration and the $10,000
   cash cap.
3. Start **Phase 0** on this branch (none of the open questions block it).
4. A logo and brand colours can come later. Phase 0 uses a neutral
   placeholder theme that's easy to swap.
