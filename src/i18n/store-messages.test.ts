import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { mergeMessages } from "./messages";

type Messages = { [key: string]: string | Messages };
const root = path.resolve(__dirname, "../../messages");
const read = (file: string) => JSON.parse(readFileSync(path.join(root, file), "utf8")) as Messages;

function keys(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "object" ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

describe("store message overrides", () => {
  const files = readdirSync(path.join(root, "stores"));

  it("exist for each store and language", () => {
    expect(files.sort()).toEqual(["MTL.en.json", "MTL.fr.json", "TOR.en.json", "TOR.fr.json"]);
  });

  it.each(files)("%s only overrides keys the shared messages have", (file) => {
    const locale = file.split(".")[1];
    const base = new Set(keys(read(`${locale}.json`)));
    expect(keys(read(`stores/${file}`)).filter((k) => !base.has(k))).toEqual([]);
  });

  it("override the same keys in every file", () => {
    const sets = files.map((f) => keys(read(`stores/${f}`)).sort());
    for (const set of sets) expect(set).toEqual(sets[0]);
  });

  it("merge nested keys without dropping their siblings", () => {
    const merged = mergeMessages({ a: { b: "1", c: "2" }, d: "3" }, { a: { b: "x" } });
    expect(merged).toEqual({ a: { b: "x", c: "2" }, d: "3" });
  });
});
