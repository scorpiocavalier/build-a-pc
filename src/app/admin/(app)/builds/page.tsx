import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import type { LocalizedText } from "@/lib/localized";
import { formatMoney } from "@/lib/money";
import { listFeaturedBuilds } from "@/server/builder";
import { requireAdmin } from "@/server/require-admin";

import { SettingsForm } from "../settings/settings-forms";

import { featureBuildAction, unfeatureAction, updateFeaturedAction } from "./actions";

export const metadata = { title: "Prebuilt PCs" };
// Internal pages always wait for fresh data; instant navigation isn't a goal.
export const instant = false;

function DetailFields({
  prefix,
  title,
  description,
  position,
}: {
  prefix: string;
  title?: LocalizedText | null;
  description?: LocalizedText | null;
  position?: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Name (English)" htmlFor={`${prefix}-title_en`}>
        <Input id={`${prefix}-title_en`} name="title_en" defaultValue={title?.en} />
      </Field>
      <Field label="Name (French)" htmlFor={`${prefix}-title_fr`}>
        <Input id={`${prefix}-title_fr`} name="title_fr" defaultValue={title?.fr} lang="fr" />
      </Field>
      <Field label="Description (English)" htmlFor={`${prefix}-description_en`}>
        <Textarea
          id={`${prefix}-description_en`}
          name="description_en"
          defaultValue={description?.en}
        />
      </Field>
      <Field label="Description (French)" htmlFor={`${prefix}-description_fr`}>
        <Textarea
          id={`${prefix}-description_fr`}
          name="description_fr"
          defaultValue={description?.fr}
          lang="fr"
        />
      </Field>
      <Field
        label="Order on the page"
        htmlFor={`${prefix}-position`}
        hint="Lower numbers come first."
      >
        <Input
          id={`${prefix}-position`}
          name="position"
          defaultValue={position ?? 0}
          inputMode="numeric"
        />
      </Field>
    </div>
  );
}

export default async function AdminBuildsPage() {
  await requireAdmin();
  const builds = await listFeaturedBuilds();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Prebuilt PCs</h1>
        <p className="mt-1 max-w-3xl text-muted">
          These builds appear on the store&apos;s Prebuilt PCs page. To add one, put it together in
          the PC builder on the store, copy its share link, and paste it below.
        </p>
      </div>

      <section className="rounded-lg border bg-surface/60 p-5">
        <h2 className="mb-4 font-semibold">Feature a build</h2>
        <SettingsForm action={featureBuildAction} label="Add to Prebuilt PCs" keepValues>
          <Field
            label="Share link"
            htmlFor="share"
            hint="Looks like https://astralgaming.ca/en/build/s/abc123"
          >
            <Input id="share" name="share" />
          </Field>
          <DetailFields prefix="new" />
        </SettingsForm>
      </section>

      {builds.map((build) => (
        <section key={build.id} className="flex flex-col gap-4 rounded-lg border bg-surface/60 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">{build.title?.en ?? "Untitled"}</h2>
              <p className="text-sm text-muted">
                {Object.keys(build.items).length} parts · {formatMoney(build.partsCents, "en")} in
                parts ·{" "}
                {build.issues.some((i) => i.severity === "error") || build.missing.length
                  ? "has compatibility problems"
                  : "compatible"}{" "}
                ·{" "}
                <a
                  href={`/en/build/s/${build.shareId}`}
                  target="_blank"
                  className="text-accent hover:underline"
                >
                  view ↗
                </a>
              </p>
            </div>
            <form action={unfeatureAction.bind(null, build.id)}>
              <Button variant="outline" size="sm">
                Remove from Prebuilt PCs
              </Button>
            </form>
          </div>
          <SettingsForm action={updateFeaturedAction.bind(null, build.id)}>
            <DetailFields
              prefix={build.id}
              title={build.title}
              description={build.description}
              position={build.position}
            />
          </SettingsForm>
        </section>
      ))}
    </div>
  );
}
