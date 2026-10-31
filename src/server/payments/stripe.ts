import "server-only";

import Stripe from "stripe";

import { formatOrderNumber } from "@/lib/checkout/order-number";
import { orderUrl, type OrderView } from "@/server/orders/view";

// Card payments go through Stripe's hosted Checkout page, so card details
// never touch our servers (PCI SAQ A). Stripe webhooks, not the redirect,
// decide that an order is paid (src/app/api/webhooks/stripe/route.ts).

let client: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(key);
  return client;
}

export async function createCheckoutSession(order: OrderView, expiresAt: Date) {
  const url = orderUrl(order);
  return getStripe().checkout.sessions.create(
    {
      mode: "payment",
      client_reference_id: order.id,
      customer_email: order.email,
      locale: order.locale === "fr" ? "fr-CA" : "en",
      currency: "cad",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "cad",
            unit_amount: order.totalCents,
            product_data: {
              name: `Astral Tech Gaming ${formatOrderNumber(order.number)}`,
            },
          },
        },
      ],
      metadata: { orderId: order.id },
      payment_intent_data: { metadata: { orderId: order.id } },
      // Stripe requires at least 30 minutes.
      expires_at: Math.floor(expiresAt.getTime() / 1000),
      success_url: `${url}&paid=1`,
      cancel_url: url,
    },
    // Retrying the same order never creates a second session.
    { idempotencyKey: `checkout-${order.id}` },
  );
}

export async function refundPaymentIntent(
  paymentIntentId: string,
  amountCents: number,
  orderId: string,
) {
  return getStripe().refunds.create(
    { payment_intent: paymentIntentId, amount: amountCents, metadata: { orderId } },
    { idempotencyKey: `refund-${orderId}-${paymentIntentId}` },
  );
}

export function constructWebhookEvent(payload: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  // Verifying needs no network call, only the shared secret.
  return Stripe.webhooks.constructEvent(payload, signature, secret);
}
