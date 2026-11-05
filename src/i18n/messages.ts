import { SINGLE_STORE, DEFAULT_LOCATION } from "@/lib/store-config";

// Messages for a locale: the shared files, plus, on a one-store deployment,
// that store's overrides for the few sentences that name both cities
// (messages/stores/<STORE>.<locale>.json). The overrides only replace keys
// the shared files already have; a unit test keeps them in step.

type Messages = { [key: string]: string | Messages };

export function mergeMessages(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = base[key];
    out[key] =
      typeof value === "object" && typeof current === "object"
        ? mergeMessages(current, value)
        : value;
  }
  return out;
}

export async function loadMessages(locale: string): Promise<Messages> {
  const base = (await import(`../../messages/${locale}.json`)).default as Messages;
  if (!SINGLE_STORE) return base;
  const override = (await import(`../../messages/stores/${DEFAULT_LOCATION}.${locale}.json`))
    .default as Messages;
  return mergeMessages(base, override);
}
