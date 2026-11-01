import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LegalPage } from "@/components/legal/legal-page";
import { localeAlternates } from "@/server/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Legal");
  return {
    title: t("returns.title"),
    description: t("returns.description"),
    alternates: await localeAlternates("/returns"),
  };
}

export default function Page() {
  return <LegalPage page="returns" />;
}
