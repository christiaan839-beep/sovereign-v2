import { NextRequest, NextResponse } from "next/server";

/**
 * MEGA CATCH-ALL — Handles all API routes not covered by specific catch-alls.
 * Routes like /api/email, /api/health, /api/settings, /api/nim, etc.
 * are loaded dynamically from src/app/api/_misc/
 */

async function loadHandler(path: string) {
  try {
    return require(`@/app/api/_misc/${path}/route`);
  } catch {
    // Try without trailing segment for base routes
    try {
      return require(`@/app/api/_misc/${path}`);
    } catch {
      return null;
    }
  }
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
