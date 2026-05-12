import { ogCard, ogSize } from "@/lib/og-card";

export const runtime = "nodejs";
export const alt = "MCP server for Claude, Cursor, Continue — Sovereign Matrix";
export const size = ogSize();
export const contentType = "image/png";

export default function OGImage() {
  return ogCard({
    eyebrow: "MCP · Distribution",
    title: "Sovereign, inside every Claude install.",
    subtitle:
      "Public MCP server: verify, run, query receipts directly from Claude Desktop, Cursor, and Continue.",
    footer: "MCP",
    accent: "cyan",
  });
}
