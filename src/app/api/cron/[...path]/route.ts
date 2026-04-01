import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  try { const mod = await import(/* webpackIgnore: true */ `@/app/api/_cron/${path.join("/")}/route`); return mod.GET ? mod.GET(req) : NextResponse.json({ error: "Not found" }, { status: 404 }); }
  catch { return NextResponse.json({ error: `Cron "${path.join("/")}" not found` }, { status: 404 }); }
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  try { const mod = await import(/* webpackIgnore: true */ `@/app/api/_cron/${path.join("/")}/route`); return mod.POST ? mod.POST(req) : NextResponse.json({ error: "Not found" }, { status: 404 }); }
  catch { return NextResponse.json({ error: "Not found" }, { status: 404 }); }
}
