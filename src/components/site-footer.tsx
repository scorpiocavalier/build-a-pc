import { getTranslations } from "next-intl/server";

import { Logo } from "@/components/logo";

async function currentYear() {
  "use cache";
  return new Date().getFullYear();
}

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const year = await currentYear();

  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <Logo className="text-foreground" />
        <div className="flex flex-col gap-1 sm:items-end">
          <p>{t("warranty")}</p>
          <p>{t("rights", { year })}</p>
        </div>
      </div>
    </footer>
  );
}
