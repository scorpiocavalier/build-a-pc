import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { Issue } from "@/lib/builder/compat";
import { cn } from "@/lib/utils";

const STYLE = {
  error: { Icon: XCircle, className: "border-red-400/40 bg-red-400/10", icon: "text-red-300" },
  warning: {
    Icon: AlertTriangle,
    className: "border-amber-400/40 bg-amber-400/10",
    icon: "text-amber-300",
  },
  info: { Icon: Info, className: "border-border bg-surface", icon: "text-muted" },
} as const;

export async function IssueList({ issues }: { issues: Issue[] }) {
  const t = await getTranslations("Builder");

  if (issues.length === 0) {
    return (
      <p className="flex items-start gap-2 text-sm text-emerald-300">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {t("noIssues")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {issues.map((issue, i) => {
        const { Icon, className, icon } = STYLE[issue.severity];
        return (
          <li
            key={i}
            className={cn("flex items-start gap-2 rounded-lg border p-2.5 text-sm", className)}
          >
            <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", icon)} />
            <span>
              <span className="sr-only">{t(`severity.${issue.severity}`)}: </span>
              {t(`issues.${issue.rule}`, issue.params ?? {})}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
