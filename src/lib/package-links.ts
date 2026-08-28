/**
 * Where a package link should actually point.
 *
 * Every one of these packages is Apache-2.0 and lives in this
 * repository, but none of them is on the npm registry yet. Linking to
 * `npmjs.com/package/...` before a publish produces a 404 — on the
 * pages whose whole job is to make the toolkit look real. So the link
 * target is derived here rather than hard-coded at each call site.
 *
 * When a package is published, add its name to {@link PUBLISHED} and
 * every link to it becomes an npm link. One edit, no hunting.
 *
 * @packageDocumentation
 */

/**
 * Packages that exist on the npm registry.
 *
 * Verified empty as of 2026-08-28: `registry.npmjs.org` returns 404 for
 * every `@sovereign-matrix/*` and `@sovereignmatrix/*` name. Add a name
 * here only after `npm view <name>` succeeds.
 */
export const PUBLISHED: ReadonlySet<string> = new Set<string>([]);

const REPO = "https://github.com/christiaan839-beep/sovereign-v2";

/**
 * Packages whose source directory is not just the unscoped name.
 * Empty today; kept so a future rename has one place to record itself.
 */
const DIRECTORY_ALIASES: Readonly<Record<string, string>> = {};

/** True when the package is on npm and an npm link would resolve. */
export function isPublished(pkg: string): boolean {
  return PUBLISHED.has(pkg);
}

/**
 * A link for `pkg` that resolves today.
 *
 * npm once the package is published; the source directory in this
 * repository until then.
 */
export function packageUrl(pkg: string): string {
  if (isPublished(pkg)) {
    return `https://www.npmjs.com/package/${pkg}`;
  }
  const unscoped = pkg.includes("/") ? pkg.slice(pkg.indexOf("/") + 1) : pkg;
  const dir = DIRECTORY_ALIASES[pkg] ?? unscoped;
  return `${REPO}/tree/main/packages/${dir}`;
}

/**
 * What to call the link in the UI.
 *
 * "View on npm" over a GitHub link is a small lie that costs trust on
 * exactly the pages where trust is the product.
 */
export function packageLinkLabel(pkg: string): string {
  return isPublished(pkg) ? "View on npm" : "View source";
}
