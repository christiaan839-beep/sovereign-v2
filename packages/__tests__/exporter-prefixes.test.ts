/**
 * An exporter may only claim evidence from a pack that exists.
 *
 * The compliance exporters map receipts to controls by prefix: a control
 * declares `evidencePackPrefixes`, and a receipt evidences it when
 * `receipt.pack` starts with one of them. Nothing tied those prefixes to the
 * pack registry, so the five framework exporters between them declared 138
 * prefixes of which 129 — `encryption`, `rbac`, `siem`, `waf`,
 * `physical-security`, `vendor-management`, `ethics`, `code-of-conduct` and
 * the rest — matched no pack that `packs.ts` can produce. They named an
 * imagined pack namespace.
 *
 * That is worse than useless: a mapping table nobody can reach reads, to
 * anyone opening the source, as coverage the tool does not have. It is also
 * how the catch-all prefixes came to be needed — with the real mappings
 * unreachable, only a blanket `soc2` / `hipaa` / `cra` prefix made a binder
 * look populated, and under that one receipt evidenced 33 of 33 SOC 2
 * criteria and 52 of 52 HIPAA specifications.
 *
 * These packages are what /api/_admin/compliance/[framework]/generate renders
 * for a signed-in user, so the check belongs here and not only upstream.
 *
 * A receipt's `pack` field carries a pack id from ALL_PACKS. Rule ids
 * (`hipaa-no-raw-ssn`) live one level down and are not what the field holds,
 * so prefixes are checked against pack ids only.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { ALL_PACKS } from "../verifiable-receipts/src/index.js";

const PACKAGES_DIR = new URL("../", import.meta.url).pathname;
const PACK_IDS = ALL_PACKS.map((p) => p.id);

/** Every package that renders a compliance document, read off the tree. */
function exporterPackages(): string[] {
  return readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("."))
    .filter((d) => {
      const src = join(PACKAGES_DIR, d.name, "src", "index.ts");
      return existsSync(src) && readFileSync(src, "utf8").includes("export function toMarkdown");
    })
    .map((d) => d.name)
    .sort();
}

/** Every prefix literal an exporter declares, in source order. */
function declaredPrefixes(pkg: string): string[] {
  const src = readFileSync(join(PACKAGES_DIR, pkg, "src", "index.ts"), "utf8");
  const out: string[] = [];
  for (const block of src.matchAll(/evidencePackPrefixes[?]?:\s*\[([\s\S]*?)\]/g)) {
    for (const lit of block[1]!.matchAll(/"([^"]+)"/g)) out.push(lit[1]!);
  }
  return out;
}

describe("evidence prefixes name packs that exist", () => {
  const withPrefixes = exporterPackages().filter(
    (p) => declaredPrefixes(p).length > 0,
  );

  it("at least one exporter still declares prefixes", () => {
    // Guards against the regex silently matching nothing and the suite
    // passing vacuously.
    expect(withPrefixes.length).toBeGreaterThan(0);
  });

  it.each(withPrefixes)("%s declares no unreachable prefix", (pkg) => {
    const unreachable = [...new Set(declaredPrefixes(pkg))].filter(
      (prefix) => !PACK_IDS.some((id) => id.startsWith(prefix)),
    );
    expect(
      unreachable,
      `${pkg} maps controls to packs that do not exist: ${unreachable.join(", ")}`,
    ).toEqual([]);
  });

  it("the registry is non-empty and the check can fail", () => {
    // Guards the guard. If ALL_PACKS were empty every prefix would be
    // unreachable and the suite above would fail loudly rather than pass.
    expect(PACK_IDS.length).toBeGreaterThan(20);
    expect(PACK_IDS.some((id) => id.startsWith("vendor-management"))).toBe(false);
    expect(PACK_IDS.some((id) => id.startsWith("owasp"))).toBe(true);
  });
});
