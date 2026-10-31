import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { formatOrderNumber } from "@/lib/checkout/order-number";
import { formatMoney } from "@/lib/money";
import type { MyOrder } from "@/server/account/orders";

export async function OrderList({ orders }: { orders: MyOrder[] }) {
  const [t, order, locale] = await Promise.all([
    getTranslations("Account"),
    getTranslations("Order"),
    getLocale(),
  ]);
  if (orders.length === 0) {
    return (
      <p className="rounded-lg border bg-surface p-6 text-muted">
        {t("noOrders")}{" "}
        <Link href="/shop" className="text-accent hover:underline">
          {t("startShopping")}
        </Link>
      </p>
    );
  }
  const date = new Intl.DateTimeFormat(`${locale}-CA`, {
    dateStyle: "medium",
    timeZone: "America/Toronto",
  });

  return (
    <ul className="flex flex-col divide-y rounded-lg border bg-surface">
      {orders.map((o) => (
        <li key={o.id}>
          <Link
            href={`/orders/${o.id}?t=${o.accessToken}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:bg-surface-raised"
          >
            <span className="font-medium">{formatOrderNumber(o.number)}</span>
            <span className="text-sm text-muted">{date.format(o.placedAt)}</span>
            <span className="rounded-full border px-2 py-0.5 text-xs">
              {order(`status.${o.status}`)}
            </span>
            {o.returns[0] && (
              <span className="rounded-full border border-accent/40 px-2 py-0.5 text-xs">
                {t("returnBadge", { status: order(`returnStatus.${o.returns[0].status}`) })}
              </span>
            )}
            <span className="ml-auto font-semibold tabular-nums">
              {formatMoney(o.totalCents, locale)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
