import { NextRequest, NextResponse } from "next/server";

/**
 * MEGA CATCH-ALL — Handles all API routes not covered by specific catch-alls.
 * Routes like /api/email, /api/health, /api/settings, /api/nim, etc.
 * are loaded dynamically from src/app/api/_misc/
 */

type RouteModule = {
  GET?: (req: NextRequest) => Promise<Response>;
  POST?: (req: NextRequest) => Promise<Response>;
  PUT?: (req: NextRequest) => Promise<Response>;
  DELETE?: (req: NextRequest) => Promise<Response>;
};

async function tryImport(specifier: string): Promise<RouteModule | null> {
  try {
    return await import(/* webpackIgnore: true */ specifier);
  } catch {
    return null;
  }
}

async function loadHandler(path: string): Promise<RouteModule | null> {
  // Strip known prefixes — e.g., "agents/leads" → try "_agents/leads"
  const strippedPath = path
    .replace(/^agents\//, "")
    .replace(/^payments\//, "")
    .replace(/^integrations\//, "");

  const prefixes = ["_agents", "_misc", "_settings", "_email", "_content", "_payments", "_billing", "_webhooks", "_cron", "_integrations"];
  const pathsToTry = [...new Set([path, strippedPath])];

  for (const tryPath of pathsToTry) {
    for (const prefix of prefixes) {
      const mod = await tryImport(`@/app/api/${prefix}/${tryPath}/route`);
      if (mod) return mod;
      const mod2 = await tryImport(`@/app/api/${prefix}/${tryPath}`);
      if (mod2) return mod2;
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
