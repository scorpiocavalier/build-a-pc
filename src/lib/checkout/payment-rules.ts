import type { PaymentMethod } from "@/generated/prisma/enums";

// Which payment methods an order may use (docs/PLAN.md §6). Values come from
// admin settings so the owner can change them without a deploy.

export type PaymentRuleSettings = {
  cardEnabled: boolean;
  // Cash is only offered below this total (strictly less than).
  cashMaxCents: number;
  depositPercent: number;
};

export function allowedPaymentMethods(
  totalCents: number,
  settings: PaymentRuleSettings,
): PaymentMethod[] {
  const methods: PaymentMethod[] = [];
  if (settings.cardEnabled) methods.push("CARD");
  methods.push("ETRANSFER");
  if (totalCents < settings.cashMaxCents) methods.push("CASH");
  return methods;
}

// Deposit required before assembly starts. Parts-only orders need none.
export function depositFor(
  totalCents: number,
  hasAssembly: boolean,
  settings: Pick<PaymentRuleSettings, "depositPercent">,
): number {
  if (!hasAssembly) return 0;
  return Math.ceil((totalCents * settings.depositPercent) / 100);
}

export function paymentStatusFor(paidCents: number, totalCents: number) {
  if (paidCents <= 0) return "UNPAID" as const;
  if (paidCents < totalCents) return "PARTIALLY_PAID" as const;
  return "PAID" as const;
}
