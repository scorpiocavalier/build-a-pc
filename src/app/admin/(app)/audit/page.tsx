import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { listAudit } from "@/server/audit";
import { requireAdmin } from "@/server/require-admin";

export const metadata = { title: "Audit log" };
export const instant = false;

const ENTITIES = ["order", "return", "product", "inventory", "settings", "build", "import"];

// Where each kind of record is managed.
function hrefFor(entity: string, id: string | null): string | null {
  if (!id) return null;
  if (entity === "order") return `/admin/orders/${id}`;
  if (entity === "product") return `/admin/products/${id}`;
  return null;
}

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin();
  const params = await searchParams;
  const entity =
    typeof params.entity === "string" && ENTITIES.includes(params.entity) ? params.entity : "";
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const entries = await listAudit({ entity: entity || undefined, q: q || undefined });
  const date = new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="mt-1 text-muted">
          Every change made in the admin, newest first (latest 200 matching entries).
        </p>
      </div>
      <form className="flex flex-wrap items-end gap-2" role="search">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Text, record id or staff email"
          aria-label="Search the log"
          className="w-64"
        />
        <Select name="entity" defaultValue={entity} aria-label="Area" className="w-40">
          <option value="">Everything</option>
          {ENTITIES.map((e) => (
            <option key={e} value={e}>
              {e[0].toUpperCase() + e.slice(1)}
            </option>
          ))}
        </Select>
        <Button variant="outline">Filter</Button>
      </form>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Who</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">What changed</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((entry) => {
              const href = hrefFor(entry.entity, entry.entityId);
              return (
                <tr key={entry.id}>
                  <td className="px-3 py-2 whitespace-nowrap text-muted">
                    {date.format(entry.createdAt)}
                  </td>
                  <td className="px-3 py-2">{entry.actor?.email ?? "System"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{entry.action}</td>
                  <td className="px-3 py-2">
                    {href ? (
                      <Link href={href} className="hover:text-accent">
                        {entry.summary}
                      </Link>
                    ) : (
                      entry.summary
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {entries.length === 0 && <p className="p-6 text-center text-muted">Nothing logged yet.</p>}
      </div>
    </div>
  );
}
