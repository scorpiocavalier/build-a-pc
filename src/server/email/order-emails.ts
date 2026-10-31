import "server-only";

import { createTranslator } from "next-intl";

import { formatOrderNumber } from "@/lib/checkout/order-number";
import { formatDate } from "@/lib/checkout/windows";
import { formatRate } from "@/lib/checkout/pricing";
import { localize } from "@/lib/localized";
import { formatMoney } from "@/lib/money";
import { formatAddress, orderUrl, type OrderView } from "@/server/orders/view";
import { getSettings } from "@/server/settings";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

import { renderEmail as render, type Block } from "./render";
import { sendEmail, type Email } from "./send";

// Customer emails, in the language the order was placed in. Each email is
// built as HTML and plain text from the same pieces.

export type OrderEmailKind = "received" | "paid" | "ready" | "cancelled";

export async function buildOrderEmail(
  order: OrderView,
  kind: OrderEmailKind,
  extra: { refundedCents?: number } = {},
): Promise<Email> {
  const locale = order.locale;
  const t = createTranslator({ locale, messages: locale === "fr" ? fr : en });
  const money = (cents: number) => formatMoney(cents, locale);
  const number = formatOrderNumber(order.number);
  const settings = await getSettings();
  const location = localize(order.location.name, locale);

  const summary: Block = {
    kind: "table",
    rows: [
      ...order.lines.map(
        (line) =>
          [
            `${line.quantity} × ${localize(line.name, locale)}`,
            money(line.unitPriceCents * line.quantity),
          ] as [string, string],
      ),
      [t("Checkout.subtotal"), money(order.subtotalCents)],
      ...(order.assemblyCents > 0
        ? [[t("Checkout.assembly"), money(order.assemblyCents)] as [string, string]]
        : []),
      ...(order.fulfilment === "DELIVERY"
        ? [
            [
              t("Checkout.deliveryFee"),
              order.deliveryCents ? money(order.deliveryCents) : t("Checkout.free"),
            ] as [string, string],
          ]
        : []),
      ...order.taxBreakdown.map(
        (tax) =>
          [
            t("Checkout.taxLine", { name: tax.name, rate: formatRate(tax.rate, locale) }),
            money(tax.cents),
          ] as [string, string],
      ),
      [t("Checkout.total"), money(order.totalCents)],
    ],
  };
  const fulfilment: Block = {
    kind: "p",
    text:
      (order.fulfilment === "PICKUP"
        ? `${t("Order.fulfilmentPickup", { location })}. ${t("Order.pickupAddress", {
            address: localize(order.location.address, locale),
            hours: localize(order.location.hours, locale),
          })}`
        : t("Order.fulfilmentDelivery", { address: formatAddress(order.deliveryAddress!) })) +
      `. ${t("Order.requested", {
        date: formatDate(order.requestedWindow.date, locale),
        slot: t(`Checkout.slots.${order.requestedWindow.slot}`),
      })}`,
  };
  const link: Block = { kind: "link", text: t("Email.viewOrder"), href: orderUrl(order) };
  const greeting: Block = { kind: "p", text: t("Email.greeting", { name: order.name }) };
  const taxNumbers = [
    settings.gstNumber && `GST/HST ${settings.gstNumber}`,
    settings.qstNumber && `QST ${settings.qstNumber}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const footer: Block[] = [
    ...(taxNumbers
      ? [{ kind: "p", text: t("Email.receiptNumbers", { numbers: taxNumbers }) } as Block]
      : []),
    { kind: "p", text: t("Email.signoff") },
  ];

  let subject: string;
  let blocks: Block[];
  switch (kind) {
    case "received": {
      subject = t("Email.subjectReceived", { number });
      const payment: Block[] = [];
      const owing = order.totalCents - order.paidCents;
      const depositOwing = Math.max(0, order.depositCents - order.paidCents);
      // e-Transfer orders, and cash orders that need an e-Transfer deposit first.
      if (
        (order.paymentMethod === "ETRANSFER" ||
          (order.paymentMethod === "CASH" && depositOwing > 0)) &&
        owing > 0
      ) {
        payment.push({
          kind: "p",
          text: !settings.etransferEmail
            ? t("Order.etransferPending")
            : depositOwing > 0
              ? t("Order.etransferDeposit", {
                  amount: money(depositOwing),
                  total: money(owing),
                  email: settings.etransferEmail,
                  number,
                })
              : t("Order.etransferSteps", {
                  amount: money(owing),
                  email: settings.etransferEmail,
                  number,
                }),
        });
        if (depositOwing > 0) {
          payment.push({
            kind: "p",
            text: t("Order.assemblyNote", { days: settings.assemblyDays }),
          });
        }
        if (order.holdUntil) {
          payment.push({
            kind: "p",
            text: t("Order.payBy", {
              deadline: new Intl.DateTimeFormat(`${locale}-CA`, {
                dateStyle: "long",
                timeStyle: "short",
                timeZone: "America/Toronto",
              }).format(order.holdUntil),
            }),
          });
        }
      }
      if (order.paymentMethod === "CASH" && depositOwing === 0) {
        payment.push({ kind: "p", text: t("Order.cashInfo", { amount: money(order.totalCents) }) });
      }
      blocks = [
        greeting,
        { kind: "p", text: t("Email.receivedBody") },
        summary,
        fulfilment,
        ...payment,
        link,
      ];
      break;
    }
    case "paid":
      subject = t("Email.subjectPaid", { number });
      blocks = [
        greeting,
        { kind: "p", text: t("Email.paidBody", { amount: money(order.paidCents) }) },
        summary,
        link,
      ];
      break;
    case "ready":
      subject = t("Email.subjectReady", { number });
      blocks = [
        greeting,
        {
          kind: "p",
          text:
            order.fulfilment === "PICKUP"
              ? t("Email.readyPickup", { location })
              : t("Email.readyDelivery"),
        },
        fulfilment,
        link,
      ];
      break;
    case "cancelled":
      subject = t("Email.subjectCancelled", { number });
      blocks = [
        greeting,
        { kind: "p", text: t("Email.cancelledBody") },
        ...(order.cancelReason
          ? [
              {
                kind: "p",
                text: t("Email.cancelledReason", { reason: order.cancelReason }),
              } as Block,
            ]
          : []),
        ...(extra.refundedCents
          ? [
              {
                kind: "p",
                text: t("Email.refunded", { amount: money(extra.refundedCents) }),
              } as Block,
            ]
          : []),
        link,
      ];
      break;
  }

  return { to: order.email, subject, ...render(subject, [...blocks, ...footer]) };
}

export async function sendOrderEmail(
  order: OrderView,
  kind: OrderEmailKind,
  extra?: { refundedCents?: number },
) {
  await sendEmail(await buildOrderEmail(order, kind, extra));
}
