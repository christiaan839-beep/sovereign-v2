import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  try { const mod = await import(/* webpackIgnore: true */ `@/app/api/_health/${path.join("/")}/route`); return mod.GET ? mod.GET(req) : NextResponse.json({ error: "Not found" }, { status: 404 }); }
  catch { return NextResponse.json({ error: `Health check "${path.join("/")}" not found` }, { status: 404 }); }
}
