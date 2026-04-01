import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  try { const mod = await import(/* webpackIgnore: true */ `@/app/api/_billing/${path.join("/")}/route`); return mod.POST ? mod.POST(req) : NextResponse.json({ error: "Not found" }, { status: 404 }); }
  catch { return NextResponse.json({ error: "Not found" }, { status: 404 }); }
}
