"use server";

import { AuthError } from "next-auth";
import { z } from "zod";

import { signIn } from "@/auth";
import { safeNextPath } from "@/lib/account/redirect";

export type EmailSignInState = { sent?: string; error?: "email" | "staff" | "failed" };

export async function emailSignInAction(
  _prev: EmailSignInState,
  formData: FormData,
): Promise<EmailSignInState> {
  const locale = formData.get("locale") === "fr" ? "fr" : "en";
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!z.email().safeParse(email).success) return { error: "email" };

  let url: string;
  try {
    url = await signIn("resend", {
      email,
      redirect: false,
      redirectTo: safeNextPath(formData.get("next"), locale),
    });
  } catch (error) {
    // Staff emails are refused by the signIn callback (they must use Google).
    if (error instanceof AuthError) {
      return { error: error.type === "AccessDenied" ? "staff" : "failed" };
    }
    throw error;
  }
  // Auth.js reports refusals through the URL it would redirect to.
  if (url.includes("error=AccessDenied")) return { error: "staff" };
  if (url.includes("error=")) return { error: "failed" };
  return { sent: email };
}

export async function googleSignInAction(formData: FormData) {
  const locale = formData.get("locale") === "fr" ? "fr" : "en";
  await signIn("google", { redirectTo: safeNextPath(formData.get("next"), locale) });
}
