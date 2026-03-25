import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  try { const mod = require(`@/app/api/_webhooks/${path.join("/")}/route`); return mod.POST ? mod.POST(req) : NextResponse.json({ error: "Not found" }, { status: 404 }); }
  catch { return NextResponse.json({ error: `Webhook "${path.join("/")}" not found` }, { status: 404 }); }
}
