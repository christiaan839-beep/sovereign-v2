#!/usr/bin/env node
/**
 * md-to-pdf — convert a markdown doc to a print-ready PDF.
 *
 *   node scripts/md-to-pdf.mjs docs/resume-christiaan-de-wet.md out/resume.pdf
 *
 * Uses Playwright (already installed globally) to render the HTML
 * with system fonts and save as A4 PDF with print-grade margins.
 *
 * No external markdown library dependency — minimal markdown
 * parser inlined below covers headings, bold, italic, code, links,
 * blockquotes, ordered + unordered lists, and tables.
 */

import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";

// ── Minimal markdown → HTML ──────────────────────────────────────────────

function escape(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, (_, c) => `<code>${escape(c)}</code>`)
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_, t, u) => `<a href="${escape(u)}">${escape(t)}</a>`,
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function md2html(md) {
  const lines = md.split("\n");
  let out = "";
  let inList = false;
  let inOrdered = false;
  let inTable = false;
  let inBlockquote = false;
  let tableHeader = null;

  const closeList = () => {
    if (inList) {
      out += inOrdered ? "</ol>\n" : "</ul>\n";
      inList = false;
      inOrdered = false;
    }
  };
  const closeTable = () => {
    if (inTable) {
      out += "</tbody></table>\n";
      inTable = false;
      tableHeader = null;
    }
  };
  const closeBlockquote = () => {
    if (inBlockquote) {
      out += "</blockquote>\n";
      inBlockquote = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // Horizontal rule.
    if (/^---+$/.test(line)) {
      closeList();
      closeTable();
      closeBlockquote();
      out += "<hr />\n";
      continue;
    }

    // Headings.
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeList();
      closeTable();
      closeBlockquote();
      const level = h[1].length;
      out += `<h${level}>${inline(escape(h[2]))}</h${level}>\n`;
      continue;
    }

    // Blockquote.
    if (line.startsWith("> ")) {
      closeList();
      closeTable();
      if (!inBlockquote) {
        out += "<blockquote>\n";
        inBlockquote = true;
      }
      out += `<p>${inline(escape(line.slice(2)))}</p>\n`;
      continue;
    } else {
      closeBlockquote();
    }

    // Tables.
    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      if (!inTable) {
        // First row = header
        tableHeader = cells;
        out += '<table><thead><tr>';
        for (const c of cells) out += `<th>${inline(escape(c))}</th>`;
        out += "</tr></thead><tbody>\n";
        inTable = true;
        // Skip the separator row.
        if (i + 1 < lines.length && /^\|[\s|:\-]+\|$/.test(lines[i + 1])) {
          i++;
        }
        continue;
      }
      out += "<tr>";
      for (const c of cells) out += `<td>${inline(escape(c))}</td>`;
      out += "</tr>\n";
      continue;
    } else {
      closeTable();
    }

    // Lists.
    const ul = line.match(/^[-*+]\s+(.*)$/);
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ul || ol) {
      const ordered = !!ol;
      if (!inList || inOrdered !== ordered) {
        closeList();
        inList = true;
        inOrdered = ordered;
        out += ordered ? "<ol>\n" : "<ul>\n";
      }
      const item = (ul ? ul[1] : ol[1]);
      out += `<li>${inline(escape(item))}</li>\n`;
      continue;
    } else if (line === "") {
      closeList();
      continue;
    } else {
      closeList();
    }

    // Paragraph.
    if (line !== "") {
      out += `<p>${inline(escape(line))}</p>\n`;
    }
  }

  closeList();
  closeTable();
  closeBlockquote();
  return out;
}

// ── Print stylesheet ─────────────────────────────────────────────────────

const STYLE = `
<style>
  @page {
    size: A4;
    margin: 18mm 18mm 18mm 18mm;
  }
  html, body {
    font-family: 'Helvetica Neue', Helvetica, Arial, ui-sans-serif, system-ui, sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #111;
    background: #fff;
  }
  body {
    max-width: 100%;
  }
  h1 {
    font-size: 22pt;
    margin: 0 0 4pt 0;
    letter-spacing: -0.01em;
    font-weight: 800;
  }
  h2 {
    font-size: 13pt;
    margin: 18pt 0 6pt 0;
    color: #06766b;
    border-bottom: 1px solid #d4d4d4;
    padding-bottom: 4pt;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 700;
  }
  h3 {
    font-size: 11pt;
    margin: 12pt 0 4pt 0;
    color: #111;
    font-weight: 700;
  }
  p {
    margin: 0 0 6pt 0;
  }
  ul, ol {
    margin: 0 0 8pt 0;
    padding-left: 18pt;
  }
  li {
    margin: 0 0 2pt 0;
  }
  blockquote {
    margin: 8pt 0;
    padding: 6pt 12pt;
    border-left: 3pt solid #06b6d4;
    background: #f7fafc;
    color: #475569;
    font-style: italic;
  }
  blockquote p {
    margin: 0;
  }
  strong {
    font-weight: 700;
    color: #000;
  }
  a {
    color: #0e7490;
    text-decoration: none;
  }
  code {
    font-family: 'SF Mono', 'Cascadia Code', Consolas, ui-monospace, monospace;
    font-size: 9.5pt;
    background: #f1f5f9;
    padding: 1px 4px;
    border-radius: 3px;
    color: #0f172a;
  }
  hr {
    border: none;
    border-top: 1px solid #d4d4d4;
    margin: 12pt 0;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 6pt 0 10pt 0;
    font-size: 9.5pt;
  }
  th {
    text-align: left;
    background: #f1f5f9;
    padding: 5pt 7pt;
    border-bottom: 1px solid #cbd5e1;
    font-weight: 700;
  }
  td {
    padding: 4pt 7pt;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
  }
  /* Tighten first-page header */
  body > h1:first-child {
    margin-top: 0;
  }
</style>
`;

// ── Main ─────────────────────────────────────────────────────────────────

const [, , src, dst] = process.argv;
if (!src || !dst) {
  console.error("usage: node scripts/md-to-pdf.mjs <input.md> <output.pdf>");
  process.exit(1);
}

const md = readFileSync(resolve(src), "utf8");
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escape(src.split("/").pop().replace(/\.md$/, ""))}</title>
  ${STYLE}
</head>
<body>
${md2html(md)}
</body>
</html>`;

mkdirSync(dirname(resolve(dst)), { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.setContent(html, { waitUntil: "networkidle" });
await page.pdf({
  path: resolve(dst),
  format: "A4",
  printBackground: true,
  margin: { top: "18mm", right: "18mm", bottom: "18mm", left: "18mm" },
});
await browser.close();

console.log(`✓ Wrote ${dst}`);
