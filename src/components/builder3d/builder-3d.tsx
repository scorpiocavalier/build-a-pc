"use client";

import { AlertTriangle, Box, CheckCircle2, Info, RotateCcw, X, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";

import { candidatesAction, choosePartAction, removePartAction } from "@/app/[locale]/build/actions";
import { Button } from "@/components/ui/button";
import type { BuildSlot } from "@/generated/prisma/enums";
import { Link } from "@/i18n/navigation";
import type { Issue } from "@/lib/builder/compat";
import { buildScene } from "@/lib/builder/scene";
import { SLOT_MAX_QUANTITY, SLOTS, slotToParam } from "@/lib/builder/slots";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

import type { BuilderData, CandidateView } from "./types";

// three.js only runs in the browser, and only this page needs it, so it's
// loaded on demand instead of with the rest of the site.
const PcScene = dynamic(() => import("./pc-scene"), {
  ssr: false,
  loading: () => <SceneLoading />,
});

type Target = BuildSlot | "CASE";
const ALL: Target[] = [...SLOTS];
const OPTIONAL = new Set<Target>(["STORAGE_2", "GPU", "COOLER"]);

function SceneLoading() {
  const t = useTranslations("Builder3D");
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted">
      <Box aria-hidden="true" className="mr-2 size-4 animate-pulse text-accent" />
      {t("loading")}
    </div>
  );
}

type Support = { webgl: boolean; reducedMotion: boolean };
let cachedSupport: Support | null = null;

// What this browser can do, checked once. Null while rendering on the server.
function browserSupport(): Support {
  if (!cachedSupport) {
    let webgl = false;
    try {
      const canvas = document.createElement("canvas");
      webgl = !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {}
    cachedSupport = {
      webgl,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  }
  return cachedSupport;
}
const noSubscription = () => () => {};

export function Builder3D({ data, listHref }: { data: BuilderData; listHref: string }) {
  const t = useTranslations("Builder3D");
  const builder = useTranslations("Builder");
  const locale = useLocale();

  const firstMissing = ALL.find((slot) => !data.parts[slot as BuildSlot]) ?? "CPU";
  const [selected, setSelected] = useState<Target>(firstMissing);
  const [hovered, setHovered] = useState<Target | null>(null);
  const [exploded, setExploded] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const labelLayer = useRef<HTMLDivElement>(null);
  const support = useSyncExternalStore(noSubscription, browserSupport, () => null);

  const scene = useMemo(
    () =>
      buildScene(
        Object.fromEntries(
          Object.entries(data.parts).map(([slot, part]) => [
            slot,
            { specs: part.specs, quantity: part.quantity },
          ]),
        ),
      ),
    [data.parts],
  );
  const errorSlots = useMemo(
    () => new Set(data.issues.filter((i) => i.severity === "error").flatMap((i) => i.slots)),
    [data.issues],
  );
  const ghostLabels = useMemo(
    () =>
      Object.fromEntries(
        ALL.filter((slot) => !data.parts[slot as BuildSlot] && !OPTIONAL.has(slot)).map((slot) => [
          slot,
          builder(`slots.${slot}`),
        ]),
      ),
    [data.parts, builder],
  );

  return (
    <div className="flex flex-col gap-4">
      <div
        className="relative h-[58vh] max-h-[640px] min-h-[340px] overflow-hidden rounded-lg border bg-[#0b1018]"
        data-testid="scene"
      >
        {support === null ? (
          <SceneLoading />
        ) : support.webgl ? (
          <div role="img" aria-label={t("canvasLabel")} className="h-full w-full touch-none">
            <PcScene
              scene={scene}
              selected={selected}
              hovered={hovered}
              errorSlots={errorSlots}
              exploded={exploded}
              reducedMotion={support.reducedMotion}
              resetSignal={resetSignal}
              ghostLabels={ghostLabels}
              labelLayer={labelLayer}
              onSelect={setSelected}
              onHover={setHovered}
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <p>{t("noWebgl")}</p>
            <Link href={listHref} className="text-accent underline underline-offset-2">
              {t("useList")}
            </Link>
          </div>
        )}

        <div ref={labelLayer} aria-hidden="true" className="pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
          <p className="rounded-md bg-background/70 px-2 py-1 text-xs text-muted backdrop-blur">
            {t("hint")}
          </p>
          <div className="pointer-events-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              aria-pressed={exploded}
              onClick={() => setExploded((v) => !v)}
              className="bg-background/80 backdrop-blur"
            >
              {t("explode")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setResetSignal((n) => n + 1)}
              aria-label={t("reset")}
              className="bg-background/80 backdrop-blur"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* The same parts as buttons: works with a keyboard and screen reader,
          and mirrors what's selected in 3D. */}
      <nav aria-label={t("partsNav")}>
        <ul className="flex flex-wrap gap-2">
          {ALL.map((slot) => {
            const part = data.parts[slot as BuildSlot];
            const error = errorSlots.has(slot);
            return (
              <li key={slot}>
                <button
                  type="button"
                  aria-pressed={selected === slot}
                  onClick={() => setSelected(slot)}
                  onMouseEnter={() => setHovered(slot)}
                  onMouseLeave={() => setHovered(null)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
                    selected === slot
                      ? "border-accent bg-accent/15 text-foreground"
                      : "bg-surface text-muted hover:text-foreground",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-2 rounded-full",
                      error ? "bg-red-400" : part ? "bg-emerald-400" : "border border-muted",
                    )}
                  />
                  {builder(`slots.${slot}`)}
                  <span className="sr-only">
                    {error ? ` (${builder("severity.error")})` : part ? "" : ` (${t("emptySlot")})`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <Inspector
        key={selected}
        slot={selected}
        data={data}
        locale={locale}
        issues={data.issues.filter((i) => i.slots.includes(selected as BuildSlot))}
      />
    </div>
  );
}

function Inspector({
  slot,
  data,
  locale,
  issues,
}: {
  slot: Target;
  data: BuilderData;
  locale: string;
  issues: Issue[];
}) {
  const t = useTranslations("Builder3D");
  const builder = useTranslations("Builder");
  const catalog = useTranslations("Catalog");
  const part = data.parts[slot as BuildSlot];
  const label = builder(`slots.${slot}`);
  const [candidates, setCandidates] = useState<CandidateView[] | null>(null);
  const [pending, startTransition] = useTransition();
  const money = (cents: number) => formatMoney(cents, locale);
  const location = catalog(`locations.${data.location}`);

  const loadCandidates = () =>
    startTransition(async () => {
      setCandidates(await candidatesAction(slotToParam(slot as BuildSlot), locale));
    });
  const choose = (productId: string, quantity: number) =>
    startTransition(async () => {
      await choosePartAction(slotToParam(slot as BuildSlot), productId, quantity);
      setCandidates(null);
    });
  const remove = () =>
    startTransition(async () => {
      await removePartAction(slotToParam(slot as BuildSlot));
    });

  return (
    <section
      aria-labelledby="inspector-title"
      className="flex flex-col gap-4 rounded-lg border bg-surface p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="inspector-title" className="text-xs tracking-wide text-muted uppercase">
            {label}
            {OPTIONAL.has(slot) && !part && ` · ${builder("optional")}`}
          </h2>
          {part ? (
            <p className="mt-1 text-lg font-semibold">
              {part.quantity > 1 && `${part.quantity} × `}
              {part.brand} {part.name}
            </p>
          ) : (
            <p className="mt-1 text-muted">{t("emptyLead", { slot: label.toLowerCase() })}</p>
          )}
        </div>
        {part && (
          <p className="text-lg font-semibold tabular-nums">
            {money(part.unitPriceCents * part.quantity)}
          </p>
        )}
      </div>

      {part && (
        <div className="flex gap-4">
          {part.imageUrl && (
            <Image
              src={part.imageUrl}
              alt=""
              width={72}
              height={72}
              className="size-18 rounded-md object-cover"
            />
          )}
          <div className="flex flex-col gap-1 text-sm">
            {part.facts.length > 0 && <p className="text-muted">{part.facts.join(" · ")}</p>}
            <p
              className={
                part.available[data.location] >= part.quantity ? "text-muted" : "text-amber-300"
              }
            >
              {part.available[data.location] >= part.quantity
                ? builder("inStockHere", { location })
                : builder("notHere", { location })}
            </p>
            <Link href={`/p/${part.slug}`} className="text-accent underline underline-offset-2">
              {t("details")}
            </Link>
          </div>
        </div>
      )}

      {issues.length > 0 && <IssueRows issues={issues} />}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={loadCandidates} disabled={pending}>
          {part ? t("swap") : t("chooseSlot", { slot: label.toLowerCase() })}
        </Button>
        {part && (
          <Button size="sm" variant="ghost" onClick={remove} disabled={pending}>
            {builder("remove")}
          </Button>
        )}
      </div>

      {pending && !candidates && <p className="text-sm text-muted">{t("loadingParts")}</p>}

      {candidates && (
        <Candidates
          slot={slot as BuildSlot}
          candidates={candidates}
          currentId={part?.productId}
          currentQuantity={part?.quantity ?? 1}
          location={data.location}
          locale={locale}
          pending={pending}
          onChoose={choose}
          onClose={() => setCandidates(null)}
        />
      )}
    </section>
  );
}

function IssueRows({ issues }: { issues: Issue[] }) {
  const builder = useTranslations("Builder");
  const style = {
    error: { Icon: XCircle, className: "border-red-400/40 bg-red-400/10", icon: "text-red-300" },
    warning: {
      Icon: AlertTriangle,
      className: "border-amber-400/40 bg-amber-400/10",
      icon: "text-amber-300",
    },
    info: { Icon: Info, className: "border-border bg-background/40", icon: "text-muted" },
  } as const;
  return (
    <ul className="flex flex-col gap-2">
      {issues.map((issue, i) => {
        const { Icon, className, icon } = style[issue.severity];
        return (
          <li
            key={i}
            className={cn("flex items-start gap-2 rounded-lg border p-2.5 text-sm", className)}
          >
            <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", icon)} />
            <span>
              <span className="sr-only">{builder(`severity.${issue.severity}`)}: </span>
              {builder(`issues.${issue.rule}`, issue.params ?? {})}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Candidates({
  slot,
  candidates,
  currentId,
  currentQuantity,
  location,
  locale,
  pending,
  onChoose,
  onClose,
}: {
  slot: BuildSlot;
  candidates: CandidateView[];
  currentId: string | undefined;
  currentQuantity: number;
  location: BuilderData["location"];
  locale: string;
  pending: boolean;
  onChoose: (productId: string, quantity: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations("Builder3D");
  const builder = useTranslations("Builder");
  const catalog = useTranslations("Catalog");
  const [quantity, setQuantity] = useState(currentQuantity);
  const compatible = candidates.filter((c) => c.errors.length === 0);
  const others = candidates.filter((c) => c.errors.length > 0);
  const maxQuantity = SLOT_MAX_QUANTITY[slot];

  const row = (c: CandidateView) => {
    const here = c.available[location] > 0;
    const current = c.productId === currentId;
    return (
      <li key={c.productId} className="flex flex-wrap items-center gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {c.brand} {c.name}
          </p>
          {c.facts.length > 0 && <p className="text-xs text-muted">{c.facts.join(" · ")}</p>}
          <p className={cn("text-xs", here ? "text-muted" : "text-amber-300")}>
            {here
              ? builder("inStockHere", { location: catalog(`locations.${location}`) })
              : builder("notHere", { location: catalog(`locations.${location}`) })}
          </p>
          {c.errors.map((issue, i) => (
            <p key={i} className="text-xs text-red-300">
              {builder(`issues.${issue.rule}`, issue.params ?? {})}
            </p>
          ))}
        </div>
        <p className="font-semibold tabular-nums">{formatMoney(c.priceCents, locale)}</p>
        {current && maxQuantity === 1 ? (
          <span className="text-sm text-accent">{builder("current")}</span>
        ) : (
          <Button
            size="sm"
            variant={c.errors.length ? "outline" : "primary"}
            disabled={pending}
            onClick={() => onChoose(c.productId, quantity)}
            aria-label={`${builder("select")}: ${c.brand} ${c.name}`}
          >
            {builder("select")}
          </Button>
        )}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="text-sm font-medium">
          {builder("compatible", { count: compatible.length })}
        </p>
        <div className="flex items-center gap-2">
          {maxQuantity > 1 && (
            <label className="flex items-center gap-2 text-sm text-muted">
              {builder("quantity")}
              <select
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="h-8 rounded-lg border bg-background px-2 text-foreground"
              >
                {Array.from({ length: maxQuantity }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button size="sm" variant="ghost" onClick={onClose} aria-label={t("close")}>
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
      {compatible.length > 0 ? (
        <ul className="flex flex-col divide-y">{compatible.map(row)}</ul>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          {t("noneCompatible")}
        </p>
      )}
      {others.length > 0 && (
        <details className="rounded-lg border bg-background/40 px-3">
          <summary className="cursor-pointer py-2 text-sm">
            {builder("notCompatible", { count: others.length })}
          </summary>
          <ul className="flex flex-col divide-y opacity-80">{others.map(row)}</ul>
        </details>
      )}
    </div>
  );
}
