/**
 * /docs/specs — the spec pages actually render.
 *
 * Why this exists: six pages linked to /docs/specs/* while the route did
 * not exist, so all of those links 404'd — including five on /trust,
 * directly beneath "Hand a procurement team the links — they don't have
 * to take our word for any of it." The links were the proof.
 *
 * A typecheck would not have caught that, and neither would a link
 * checker that only runs against a deployed site. This renders every
 * spec page to HTML in-process and asserts the specification text is
 * really in the output, so the route cannot silently stop serving.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import SpecPage, { generateStaticParams } from "@/app/docs/specs/[slug]/page";
import SpecsIndexPage from "@/app/docs/specs/page";

const SPECS_DIR = join(process.cwd(), "docs", "specs");
const files = readdirSync(SPECS_DIR).filter((f) => f.endsWith(".md"));

/** Server components are async and return an element; render that. */
async function render(node: Promise<React.ReactElement> | React.ReactElement) {
  return renderToStaticMarkup((await node) as React.ReactElement);
}

describe("/docs/specs", () => {
  it("publishes every spec file on disk, and nothing else", () => {
    const params = generateStaticParams();
    const onDisk = files.map((f) => f.replace(/\.md$/, "")).sort();
    expect(params.map((p) => p.slug).sort()).toEqual(onDisk);
    expect(params.length).toBe(files.length);
  });

  it("serves the five slugs /trust links to", async () => {
    // These are the exact hrefs on the trust page. If any stops
    // resolving, that page goes back to promising proof it cannot show.
    const linkedFromTrust = [
      "vaos-2.0",
      "vaos-3.0",
      "vaos-trs-1.0",
      "vaos-rsa-1.0",
      "vapt-1.0",
    ];
    const published = generateStaticParams().map((p) => p.slug);
    for (const slug of linkedFromTrust) {
      expect(published, `/docs/specs/${slug} is linked from /trust`).toContain(slug);
    }
  });

  it("renders each spec's real text, not a shell", async () => {
    for (const file of files) {
      const slug = file.replace(/\.md$/, "");
      const html = await render(SpecPage({ params: Promise.resolve({ slug }) }));

      // The source filename is shown, so a reader can find the file.
      expect(html, slug).toContain(`docs/specs/${slug}.md`);

      // And the document's own first heading is present — proof the
      // markdown was read and rendered rather than an empty page served.
      const raw = readFileSync(join(SPECS_DIR, file), "utf8");
      const body = raw.startsWith("---")
        ? raw.replace(/^---\n[\s\S]*?\n---\n/, "")
        : raw;
      const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
      if (heading) {
        // Compare on letters/digits only: the renderer escapes entities
        // and the headings contain em dashes.
        const norm = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLowerCase();
        expect(norm(html), `${slug} heading`).toContain(norm(heading));
      }
      expect(html.length, `${slug} looks too short to be the real document`).toBeGreaterThan(2000);
    }
  });

  it("404s an unknown slug instead of erroring", async () => {
    await expect(
      render(SpecPage({ params: Promise.resolve({ slug: "no-such-spec" }) })),
    ).rejects.toThrow();
  });

  it("refuses path traversal", async () => {
    for (const slug of ["../../package.json", "..%2F..%2Fpackage.json", "../LICENSE", "/etc/passwd"]) {
      await expect(
        render(SpecPage({ params: Promise.resolve({ slug }) })),
        slug,
      ).rejects.toThrow();
    }
  });

  it("the index lists every published spec", async () => {
    const html = await render(SpecsIndexPage());
    for (const file of files) {
      const slug = file.replace(/\.md$/, "");
      expect(html, slug).toContain(`/docs/specs/${slug}`);
    }
    // The count it prints must be the count it lists — a hand-written
    // number here is exactly the kind of claim this sweep is removing.
    expect(html).toContain(`${files.length} documents`);
  });
});
