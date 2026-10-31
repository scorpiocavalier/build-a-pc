import "server-only";

import { createTranslator } from "next-intl";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

import { renderEmail } from "./render";
import type { Email } from "./send";

// The magic-link email. We don't know which language the visitor reads, so
// it's written in both, English first.
export function buildSignInEmail(to: string, url: string): Email {
  const parts = (["en", "fr"] as const).map((locale) => {
    const t = createTranslator({ locale, messages: locale === "fr" ? fr : en });
    return renderEmail(t("Email.signIn.subject"), [
      { kind: "p", text: t("Email.signIn.intro") },
      { kind: "link", text: t("Email.signIn.button"), href: url },
      { kind: "p", text: t("Email.signIn.ignore") },
    ]);
  });
  return {
    to,
    subject: "Sign in to Astral Tech Gaming / Connexion à Astral Tech Gaming",
    html: parts
      .map((p) => p.html)
      .join('<hr style="margin:32px 0;border:0;border-top:1px solid #e5e7eb">'),
    text: parts.map((p) => p.text).join("\n\n———\n\n"),
  };
}
