import { Hammer, MapPin, Truck, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

const BUILD_PHOTOS = [1, 2, 3, 4, 5] as const;

export default function HomePage() {
  const t = useTranslations("Home");

  const steps = [
    { key: "choose", Icon: Wrench },
    { key: "build", Icon: Hammer },
    { key: "handoff", Icon: Truck },
  ] as const;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_30%,color-mix(in_oklch,var(--accent)_22%,transparent),transparent)]"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[1.1fr_0.9fr] md:py-20">
          <div className="flex flex-col gap-6">
            <p className="text-sm font-medium tracking-widest text-accent uppercase">
              {t("eyebrow")}
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {t("title")}
            </h1>
            <p className="max-w-xl text-lg text-pretty text-muted">{t("lead")}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/build">{t("ctaBuild")}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/prebuilt">{t("ctaPrebuilt")}</Link>
              </Button>
            </div>
            <p className="text-sm text-muted">{t("comingSoon")}</p>
          </div>

          <div className="mx-auto w-full max-w-sm">
            <video
              className="aspect-[9/16] w-full rounded-2xl border object-cover shadow-[0_0_60px_-15px_var(--accent)]"
              src="/videos/build-showcase.mp4"
              poster="/videos/build-showcase-poster.webp"
              autoPlay
              muted
              loop
              playsInline
              aria-label={t("videoLabel")}
            />
          </div>
        </div>
      </section>

      {/* Recent builds */}
      <section id="builds" className="scroll-mt-20 border-t bg-surface/50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-semibold tracking-tight">{t("buildsTitle")}</h2>
          <p className="mt-2 max-w-2xl text-muted">{t("buildsLead")}</p>
          <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {BUILD_PHOTOS.map((n) => (
              <li
                key={n}
                className="overflow-hidden rounded-lg border bg-surface first:col-span-2 md:first:col-span-1"
              >
                <Image
                  src={`/images/builds/build-${n}.webp`}
                  alt={t(`buildAlt.${n}`)}
                  width={1200}
                  height={1600}
                  sizes="(min-width: 1024px) 20vw, (min-width: 768px) 33vw, 50vw"
                  className="aspect-[3/4] h-full w-full object-cover transition-transform duration-500 hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100"
                />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-semibold tracking-tight">{t("stepsTitle")}</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map(({ key, Icon }, i) => (
              <li key={key} className="rounded-lg border bg-surface p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="font-mono text-sm text-muted">0{i + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{t(`steps.${key}.title`)}</h3>
                <p className="mt-1 text-muted">{t(`steps.${key}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Locations */}
      <section id="locations" className="scroll-mt-20 border-t bg-surface/50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-semibold tracking-tight">{t("locationsTitle")}</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {(["toronto", "montreal"] as const).map((city) => (
              <li key={city} className="flex items-center gap-3 rounded-lg border bg-surface p-6">
                <MapPin aria-hidden="true" className="size-5 text-accent" />
                <span className="text-lg font-medium">{t(`locations.${city}`)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted">{t("locationsNote")}</p>
        </div>
      </section>
    </>
  );
}
