import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BuildSummary } from "@/components/builder/build-summary";
import { SlotList } from "@/components/builder/slot-list";
import { Button } from "@/components/ui/button";
import { localize } from "@/lib/localized";
import { getAssemblyExtras, getSharedBuild } from "@/server/builder";
import { localeAlternates } from "@/server/seo";

import { customizeAction } from "../../actions";

type Props = PageProps<"/[locale]/build/s/[shareId]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [build, t, locale] = await Promise.all([
    getSharedBuild((await params).shareId),
    getTranslations("Builder"),
    getLocale(),
  ]);
  if (!build) return {};
  return {
    title: build.title ? localize(build.title, locale) : t("sharedTitle"),
    description: build.description ? localize(build.description, locale) : undefined,
    alternates: await localeAlternates(`/build/s/${build.shareId}`),
    // Only featured builds belong in search results.
    robots: build.featured ? undefined : { index: false },
  };
}

export default function SharedBuildPage({ params }: Props) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <Suspense
        fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-lg bg-surface" />}
      >
        <SharedBuild params={params} />
      </Suspense>
    </div>
  );
}

async function SharedBuild({ params }: Pick<Props, "params">) {
  const { shareId } = await params;
  const [build, extras, t, locale] = await Promise.all([
    getSharedBuild(shareId),
    getAssemblyExtras(),
    getTranslations("Builder"),
    getLocale(),
  ]);
  if (!build) notFound();

  return (
    <>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {build.title ? localize(build.title, locale) : t("sharedTitle")}
        </h1>
        {build.description && (
          <p className="mt-2 max-w-2xl text-muted">{localize(build.description, locale)}</p>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <SlotList build={build} editable={false} />
        <BuildSummary build={build} extras={extras}>
          <form action={customizeAction}>
            <input type="hidden" name="shareId" value={build.shareId} />
            <input type="hidden" name="locale" value={locale} />
            <Button className="w-full">{t("customize")}</Button>
          </form>
        </BuildSummary>
      </div>
    </>
  );
}
