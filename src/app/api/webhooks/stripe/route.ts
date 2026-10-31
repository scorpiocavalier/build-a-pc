import type Stripe from "stripe";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { cancelOrder, recordPayment } from "@/server/orders/lifecycle";
import { constructWebhookEvent, refundPaymentIntent } from "@/server/payments/stripe";

// Stripe calls this after a Checkout session finishes or expires. It is the
// only thing that marks a card order paid. Stripe retries on any non-2xx
// response and may deliver an event more than once, so handling is idempotent.

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(await request.text(), signature);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  // Skip events we've already handled.
  try {
    await db.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ received: true, duplicate: true });
    }
    throw error;
  }

  try {
    await handle(event);
  } catch (error) {
    // Let Stripe retry: forget that we saw it.
    await db.stripeEvent.delete({ where: { id: event.id } }).catch(() => {});
    console.error(`[stripe] failed to handle ${event.type} ${event.id}`, error);
    return new Response("Handler error", { status: 500 });
  }
  return Response.json({ received: true });
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      // Some methods confirm later; async_payment_succeeded arrives then.
      if (session.payment_status !== "paid") return;
      const orderId = session.metadata?.orderId;
      if (!orderId) return;
      const paymentIntent =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);
      const result = await recordPayment(orderId, {
        method: "CARD",
        amountCents: session.amount_total ?? 0,
        stripeSessionId: session.id,
        stripePaymentIntentId: paymentIntent,
      });
      // Paid after we had already cancelled (e.g. expiry raced the payment):
      // refund rather than keep money for an order we won't fill.
      if (result.order.status === "CANCELLED" && paymentIntent) {
        await db.payment.upsert({
          where: { stripeSessionId: session.id },
          create: {
            orderId,
            method: "CARD",
            amountCents: session.amount_total ?? 0,
            status: "SUCCEEDED",
            stripeSessionId: session.id,
            stripePaymentIntentId: paymentIntent,
            receivedAt: new Date(),
          },
          update: { status: "SUCCEEDED", stripePaymentIntentId: paymentIntent },
        });
        await refundPaymentIntent(paymentIntent, session.amount_total ?? 0, orderId);
        await db.payment.update({
          where: { stripeSessionId: session.id },
          data: { status: "REFUNDED" },
        });
        await db.orderEvent.create({
          data: {
            orderId,
            type: "refunded",
            message: "Paid after cancellation; refunded automatically",
          },
        });
      }
      return;
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const orderId = event.data.object.metadata?.orderId;
      if (!orderId) return;
      const order = await db.order.findUnique({ where: { id: orderId } });
      if (order?.status === "PLACED" && order.paymentStatus === "UNPAID") {
        await cancelOrder(orderId, { reason: "Card payment not completed" });
      }
      return;
    }
  }
}
