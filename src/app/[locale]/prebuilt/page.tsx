import { Cpu, Gpu } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { Suspense } from "react";

import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/localized";
import { formatMoney } from "@/lib/money";
import { getAssemblyExtras, listFeaturedBuilds } from "@/server/builder";
import { localeAlternates } from "@/server/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Builder");
  return {
    title: t("prebuiltTitle"),
    description: t("prebuiltLead"),
    alternates: await localeAlternates("/prebuilt"),
  };
}

// Photos of our own builds, shown on cards in turn until builds have photos.
const PHOTOS = [1, 2, 3, 4, 5].map((n) => `/images/builds/build-${n}.webp`);

export default async function PrebuiltPage() {
  const t = await getTranslations("Builder");
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("prebuiltTitle")}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t("prebuiltLead")}</p>
      </div>
      <Suspense
        fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-lg bg-surface" />}
      >
        <FeaturedBuilds />
      </Suspense>
    </div>
  );
}

async function FeaturedBuilds() {
  const [builds, extras, t, locale] = await Promise.all([
    listFeaturedBuilds(),
    getAssemblyExtras(),
    getTranslations("Builder"),
    getLocale(),
  ]);

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {builds.map((build, i) => {
        const total = build.partsCents + extras.feeCents + (extras.windows?.priceCents ?? 0);
        const title = build.title ? localize(build.title, locale) : t("sharedTitle");
        return (
          <li key={build.id}>
            <Link
              href={`/build/s/${build.shareId}`}
              className="group flex h-full flex-col overflow-hidden rounded-lg border bg-surface hover:border-accent/60"
            >
              <Image
                src={PHOTOS[i % PHOTOS.length]}
                alt=""
                width={1200}
                height={1600}
                sizes="(min-width: 768px) 50vw, 100vw"
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="flex flex-1 flex-col gap-2 p-5">
                <h2 className="text-xl font-semibold group-hover:text-accent">{title}</h2>
                {build.description && (
                  <p className="text-sm text-muted">{localize(build.description, locale)}</p>
                )}
                <ul className="mt-1 flex flex-col gap-1 text-sm">
                  {build.items.CPU && (
                    <li className="flex items-center gap-2">
                      <Cpu aria-hidden="true" className="size-4 text-accent" />
                      {build.items.CPU.brand} {localize(build.items.CPU.name, locale)}
                    </li>
                  )}
                  {build.items.GPU && (
                    <li className="flex items-center gap-2">
                      <Gpu aria-hidden="true" className="size-4 text-accent" />
                      {build.items.GPU.brand} {localize(build.items.GPU.name, locale)}
                    </li>
                  )}
                </ul>
                <p className="mt-auto pt-3 text-lg font-semibold">
                  {t("fromPrice", { price: formatMoney(total, locale) })}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
