import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MCP Server — Sovereign Matrix",
  description:
    "Install Sovereign as an MCP server in Claude Desktop, Claude Code, Cursor, or any MCP-compatible client. Four tools: verify_receipt, fetch_receipt, latest_public_receipt, recent_public_receipts. No auth, no API key.",
  openGraph: {
    title: "Sovereign MCP Server — verify AI receipts from inside any AI tool",
    description:
      "One-line install. Four tools. Verify Sovereign Matrix agent-run receipts directly from Claude Desktop, Claude Code, Cursor, or any MCP client.",
    url: "https://sovereignmatrix.agency/mcp",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovereign MCP Server",
    description:
      "Verify AI receipts from inside any MCP client. One-line install. No auth.",
  },
  alternates: { canonical: "https://sovereignmatrix.agency/mcp" },
};

export default function McpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
