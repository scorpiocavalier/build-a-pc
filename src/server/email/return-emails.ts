import "server-only";

import { createTranslator } from "next-intl";

import { formatOrderNumber } from "@/lib/checkout/order-number";
import { localize } from "@/lib/localized";
import { formatMoney } from "@/lib/money";
import { parseAdminEmails } from "@/server/admin-allowlist";
import { orderUrl } from "@/server/orders/view";
import type { ReturnView } from "@/server/returns";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

import { renderEmail, type Block } from "./render";
import { sendEmail } from "./send";

export type ReturnEmailKind = "requested" | "approved" | "declined";

const siteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

// To the customer, in the language of the order.
export async function sendReturnEmail(request: ReturnView, kind: ReturnEmailKind) {
  const locale = request.order.locale;
  const t = createTranslator({ locale, messages: locale === "fr" ? fr : en });
  const rma = `RMA-${request.number}`;
  const number = formatOrderNumber(request.order.number);
  const items: Block = {
    kind: "table",
    rows: request.lines.map((line) => [
      localize(line.orderLine.name, locale),
      `× ${line.quantity}`,
    ]),
  };
  const fee: Block[] =
    request.feeCents > 0
      ? [
          {
            kind: "p",
            text: t("Returns.feeEstimate", { amount: formatMoney(request.feeCents, locale) }),
          },
        ]
      : [];
  const note: Block[] = request.adminNote
    ? [{ kind: "p", text: t("Returns.storeNote", { note: request.adminNote }) }]
    : [];

  const subject = t(`Email.return.${kind}Subject`, { rma, number });
  const blocks: Block[] = [
    { kind: "p", text: t("Email.greeting", { name: request.order.name }) },
    { kind: "p", text: t(`Email.return.${kind}Body`, { rma, number }) },
    items,
    ...(kind === "declined" ? [] : fee),
    ...note,
    { kind: "link", text: t("Email.viewOrder"), href: orderUrl(request.order) },
    { kind: "p", text: t("Email.signoff") },
  ];
  await sendEmail({ to: request.order.email, subject, ...renderEmail(subject, blocks) });
}

// A heads-up to staff (English, like the admin dashboard).
export async function notifyAdminsOfReturn(request: ReturnView) {
  const admins = [...parseAdminEmails(process.env.ADMIN_EMAILS)];
  if (admins.length === 0) return;
  const subject = `Return request RMA-${request.number} for ${formatOrderNumber(request.order.number)}`;
  const { html, text } = renderEmail(subject, [
    {
      kind: "p",
      text: `${request.order.name} (${request.order.email}) asked to return items. Reason: ${request.reason}.`,
    },
    {
      kind: "table",
      rows: request.lines.map((line) => [
        localize(line.orderLine.name, "en"),
        `× ${line.quantity}`,
      ]),
    },
    { kind: "p", text: request.details },
    { kind: "link", text: "Review the request", href: `${siteUrl()}/admin/returns` },
  ]);
  for (const to of admins) await sendEmail({ to, subject, html, text });
}
