import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const slug = path.join("/");
  try { const mod = require(`@/app/api/_payments/${slug}/route`); return mod.POST ? mod.POST(req) : NextResponse.json({ error: "Not found" }, { status: 404 }); }
  catch { return NextResponse.json({ error: `Payment route "${slug}" not found` }, { status: 404 }); }
}
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  try { const mod = require(`@/app/api/_payments/${path.join("/")}/route`); return mod.GET ? mod.GET(req) : NextResponse.json({ error: "Not found" }, { status: 404 }); }
  catch { return NextResponse.json({ error: "Not found" }, { status: 404 }); }
}
