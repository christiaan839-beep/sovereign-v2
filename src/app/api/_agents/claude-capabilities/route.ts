import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getCapabilities, getModelInfo, getUsageReport } from "@/lib/claude-ecosystem";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const capabilities = getCapabilities();
  const models = getModelInfo();
  const usage = getUsageReport();

  return NextResponse.json({
    platform: "Sovereign Matrix",
    version: "2.0",
    capabilities,
    models,
    usage,
  });
}
