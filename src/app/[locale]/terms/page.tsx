import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LegalPage } from "@/components/legal/legal-page";
import { localeAlternates } from "@/server/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Legal");
  return {
    title: t("terms.title"),
    description: t("terms.description"),
    alternates: await localeAlternates("/terms"),
  };
}

export default function Page() {
  return <LegalPage page="terms" />;
}
