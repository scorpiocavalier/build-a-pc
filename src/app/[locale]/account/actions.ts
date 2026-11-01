"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signOut } from "@/auth";
import { parseAddressForm, type AddressErrorKey } from "@/lib/account/address-input";
import { deleteAddress, saveAddress, setDefaultAddress } from "@/server/account/addresses";
import { removeFromWishlist, toggleWishlist } from "@/server/account/wishlist";
import {
  deleteSavedBuild,
  forgetMyBuild,
  getMyBuild,
  openSavedBuild,
  saveMyBuild,
} from "@/server/builder";
import { isAdminEmail } from "@/server/admin-allowlist";
import { audit } from "@/server/audit";
import { requireCustomer } from "@/server/customer";
import { SESSION_COOKIE } from "@/server/dev-session";
import { db } from "@/server/db";

// Every action re-checks the session; the pages only hide what guests can't use.

const localeOf = (formData: FormData) => (formData.get("locale") === "fr" ? "fr" : "en");
const str = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

// ─── Profile ────────────────────────────────────────────────────────────────

export type ProfileState = { saved?: boolean };

export async function saveProfileAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const locale = localeOf(formData);
  const customer = await requireCustomer(locale, `/${locale}/account`);
  const preferred = formData.get("preferredLocale") === "fr" ? "fr" : "en";
  await db.user.update({
    where: { id: customer.id },
    data: { name: str(formData, "name").slice(0, 120) || null, locale: preferred },
  });
  // Show the account in the language just chosen.
  if (preferred !== locale) redirect(`/${preferred}/account`);
  refresh();
  return { saved: true };
}

export async function signOutAction(formData: FormData) {
  const locale = localeOf(formData);
  // Don't leave a saved build editable by the next person on this browser.
  const build = await getMyBuild();
  if (build?.userId) await forgetMyBuild();
  await signOut({ redirectTo: `/${locale}` });
}

// ─── Addresses ──────────────────────────────────────────────────────────────

export type AddressState = {
  errors?: Partial<Record<string, AddressErrorKey>>;
  formError?: "limit" | "notFound";
  values?: Record<string, string>;
  saved?: number;
};

export async function saveAddressAction(
  _prev: AddressState,
  formData: FormData,
): Promise<AddressState> {
  const locale = localeOf(formData);
  const customer = await requireCustomer(locale, `/${locale}/account/addresses`);
  const raw: Record<string, string> = {};
  for (const [key, value] of formData)
    if (typeof value === "string" && !key.startsWith("$")) raw[key] = value;

  const parsed = parseAddressForm(raw);
  if (!parsed.ok) return { errors: parsed.errors, values: raw };
  const result = await saveAddress(customer.id, parsed.input, raw.id || undefined);
  if (!result.ok) return { formError: result.error, values: raw };
  if (raw.id) redirect(`/${locale}/account/addresses`);
  refresh();
  // A changing value resets the form for the next address.
  return { saved: Date.now() };
}

export async function deleteAddressAction(formData: FormData) {
  const locale = localeOf(formData);
  const customer = await requireCustomer(locale, `/${locale}/account/addresses`);
  await deleteAddress(customer.id, str(formData, "id"));
  refresh();
}

export async function defaultAddressAction(formData: FormData) {
  const locale = localeOf(formData);
  const customer = await requireCustomer(locale, `/${locale}/account/addresses`);
  await setDefaultAddress(customer.id, str(formData, "id"));
  refresh();
}

// ─── Saved builds ───────────────────────────────────────────────────────────

export type SaveBuildState = { saved?: boolean; error?: "name" | "empty" };

export async function saveBuildAction(
  _prev: SaveBuildState,
  formData: FormData,
): Promise<SaveBuildState> {
  const locale = localeOf(formData);
  const customer = await requireCustomer(locale, `/${locale}/build`);
  const name = str(formData, "name").slice(0, 80);
  if (!name) return { error: "name" };
  if (!(await saveMyBuild(customer.id, name))) return { error: "empty" };
  refresh();
  return { saved: true };
}

export async function openBuildAction(formData: FormData) {
  const locale = localeOf(formData);
  const customer = await requireCustomer(locale, `/${locale}/account/builds`);
  await openSavedBuild(customer.id, str(formData, "id"));
  redirect(`/${locale}/build`);
}

export async function deleteBuildAction(formData: FormData) {
  const locale = localeOf(formData);
  const customer = await requireCustomer(locale, `/${locale}/account/builds`);
  await deleteSavedBuild(customer.id, str(formData, "id"));
  refresh();
}

// ─── Wishlist ───────────────────────────────────────────────────────────────

export async function toggleWishlistAction(formData: FormData) {
  const locale = localeOf(formData);
  const back = str(formData, "back");
  const customer = await requireCustomer(locale, back.startsWith("/") ? back : `/${locale}`);
  await toggleWishlist(customer.id, str(formData, "productId"));
  refresh();
}

export async function removeWishlistAction(formData: FormData) {
  const locale = localeOf(formData);
  const customer = await requireCustomer(locale, `/${locale}/account/wishlist`);
  await removeFromWishlist(customer.id, str(formData, "productId"));
  refresh();
}

// ─── Your data ──────────────────────────────────────────────────────────────

export type DeleteAccountState = { error?: "confirm" | "staff" };

// Deletes the account and everything tied only to it (addresses, wishlist,
// saved builds, sessions). Orders stay for tax records, without the account.
export async function deleteAccountAction(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const locale = localeOf(formData);
  const customer = await requireCustomer(locale, `/${locale}/account`);
  if (formData.get("confirm") !== "on") return { error: "confirm" };
  if (isAdminEmail(customer.email)) return { error: "staff" };

  await db.$transaction(async (tx) => {
    // Builds the store features stay on /prebuilt; the rest go.
    await tx.build.deleteMany({ where: { userId: customer.id, featured: false } });
    await tx.order.updateMany({ where: { userId: customer.id }, data: { userId: null } });
    await tx.user.delete({ where: { id: customer.id } });
  });
  await audit({
    actorId: null,
    action: "customer.delete",
    entity: "customer",
    summary: "A customer deleted their account",
  });

  const jar = await cookies();
  for (const name of [SESSION_COOKIE, `__Secure-${SESSION_COOKIE}`, "atg_build"]) jar.delete(name);
  redirect(`/${locale}`);
}
