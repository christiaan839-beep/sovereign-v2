import { NextRequest, NextResponse } from "next/server";

/**
 * MEGA CATCH-ALL — Handles all API routes not covered by specific catch-alls.
 * Routes like /api/email, /api/health, /api/settings, /api/nim, etc.
 * are loaded dynamically from src/app/api/_misc/
 */

async function loadHandler(path: string) {
  // Strip known prefixes — e.g., "agents/leads" → try "_agents/leads"
  const strippedPath = path
    .replace(/^agents\//, "")
    .replace(/^payments\//, "")
    .replace(/^integrations\//, "");

  // Try all underscore-prefixed directories
  const prefixes = ["_agents", "_misc", "_settings", "_email", "_content", "_payments", "_billing", "_webhooks", "_cron", "_integrations"];

  // First try with the full path
  for (const prefix of prefixes) {
    try {
      return require(`@/app/api/${prefix}/${path}/route`);
    } catch {
      try {
        return require(`@/app/api/${prefix}/${path}`);
      } catch {
        continue;
      }
    }
  }

  // Then try with the stripped path (handles "agents/leads" → "_agents/leads")
  if (strippedPath !== path) {
    for (const prefix of prefixes) {
      try {
        return require(`@/app/api/${prefix}/${strippedPath}/route`);
      } catch {
        try {
          return require(`@/app/api/${prefix}/${strippedPath}`);
        } catch {
          continue;
        }
      }
    }
  }

  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ catchall: string[] }> }) {
  const { catchall } = await params;
  const path = catchall.join("/");
  const mod = await loadHandler(path);
  if (!mod?.GET) return NextResponse.json({ error: `Route /api/${path} not found (GET)` }, { status: 404 });
  return mod.GET(req);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ catchall: string[] }> }) {
  const { catchall } = await params;
  const path = catchall.join("/");
  const mod = await loadHandler(path);
  if (!mod?.POST) return NextResponse.json({ error: `Route /api/${path} not found (POST)` }, { status: 404 });
  return mod.POST(req);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ catchall: string[] }> }) {
  const { catchall } = await params;
  const path = catchall.join("/");
  const mod = await loadHandler(path);
  if (!mod?.PUT) return NextResponse.json({ error: `Route /api/${path} not found (PUT)` }, { status: 404 });
  return mod.PUT(req);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ catchall: string[] }> }) {
  const { catchall } = await params;
  const path = catchall.join("/");
  const mod = await loadHandler(path);
  if (!mod?.DELETE) return NextResponse.json({ error: `Route /api/${path} not found (DELETE)` }, { status: 404 });
  return mod.DELETE(req);
}
