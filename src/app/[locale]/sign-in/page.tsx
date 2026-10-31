import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { emailSignInEnabled } from "@/auth";
import { Button } from "@/components/ui/button";
import { safeNextPath } from "@/lib/account/redirect";
import { getCustomer } from "@/server/customer";

import { googleSignInAction } from "./actions";
import { EmailSignInForm } from "./email-form";

type Props = PageProps<"/[locale]/sign-in">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: t("signInTitle"), robots: { index: false } };
}

export default async function SignInPage({ searchParams }: Props) {
  const t = await getTranslations("Account");
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("signInTitle")}</h1>
        <p className="mt-2 text-muted">{t("signInLead")}</p>
      </div>
      <Suspense
        fallback={<div aria-hidden="true" className="h-48 animate-pulse rounded-lg bg-surface" />}
      >
        <SignInOptions searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const AUTH_ERRORS = new Set(["Verification", "AccessDenied"]);

async function SignInOptions({ searchParams }: Pick<Props, "searchParams">) {
  const [params, locale, t, customer] = await Promise.all([
    searchParams,
    getLocale(),
    getTranslations("Account"),
    getCustomer(),
  ]);
  const next = safeNextPath(params.next, locale);
  if (customer) redirect(next);
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <>
      {error && (
        <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 p-3 text-sm">
          {t(`authErrors.${AUTH_ERRORS.has(error) ? error : "Default"}`)}
        </p>
      )}
      {!emailSignInEnabled && !process.env.AUTH_GOOGLE_ID && (
        <p className="rounded-lg border bg-surface p-4 text-sm text-muted">{t("unavailable")}</p>
      )}
      {emailSignInEnabled && <EmailSignInForm locale={locale} next={next} />}
      {process.env.AUTH_GOOGLE_ID && (
        <>
          {emailSignInEnabled && (
            <p className="flex items-center gap-3 text-xs text-muted before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
              {t("or")}
            </p>
          )}
          <form action={googleSignInAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="next" value={next} />
            <Button variant="outline" className="w-full">
              {t("google")}
            </Button>
          </form>
        </>
      )}
      <p className="text-xs text-muted">{t("guestNote")}</p>
    </>
  );
}
