import { NextResponse } from "next/server";
import { generateCode } from "@/agents/coder";
import { generateCloseSequence } from "@/agents/closer";
import { generateNurtureSequence } from "@/agents/nurture";
import { prospectLeads } from "@/agents/prospector";
import { executeGhostCycle } from "@/agents/ghost-mode";
import { analyzeCompetitor } from "@/agents/war-room";
import { requireAuth } from "@/lib/auth-guard";

/** Dynamic agent router — single endpoint for all agents */
export async function POST(req: Request) {
  const auth = await requireAuth(); if (auth.error) return auth.error;
  const body = await req.json();
  const { agent } = body;

  try {
    switch (agent) {
      case "coder":
        return NextResponse.json(await generateCode(body.objective, body.language));
      case "closer":
        return NextResponse.json(await generateCloseSequence(body.leadName, body.company, body.objections));
      case "nurture":
        return NextResponse.json(await generateNurtureSequence(body.lead));
      case "prospector":
        return NextResponse.json(await prospectLeads(body.industry, body.idealClient));
      case "ghost":
        return NextResponse.json({ success: true, actions: await executeGhostCycle() });
      case "war-room":
        return NextResponse.json(await analyzeCompetitor(body.companyName));
      default:
        return NextResponse.json({ error: `Unknown agent: ${agent}` }, { status: 400 });
    }
  } catch (error) {
    console.error(`[Agent ${agent}]:`, error);
    return NextResponse.json({ error: "Agent execution failed." }, { status: 500 });
  }
}
