import { NextResponse } from "next/server";

/**
 * AGENT-TO-AGENT COMMUNICATION BUS — Allows deployed agents to 
 * pass messages and results to other agents autonomously.
 * 
 * This is the nervous system that connects NemoClaw agents into a true swarm.
 */

interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: "task" | "result" | "alert" | "handoff";
  payload: Record<string, unknown>;
  timestamp: string;
  processed: boolean;
}

const MESSAGE_BUS: AgentMessage[] = [];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const agentId = url.searchParams.get("agent");

  if (agentId) {
    const messages = MESSAGE_BUS.filter(m => m.to === agentId && !m.processed);
    return NextResponse.json({ messages, pending: messages.length });
  }

  return NextResponse.json({
    status: "Agent Communication Bus — Active",
    total_messages: MESSAGE_BUS.length,
    pending: MESSAGE_BUS.filter(m => !m.processed).length,
    recent: MESSAGE_BUS.slice(-20).reverse(),
  });
}

export async function POST(request: Request) {
  try {
    const { from, to, type = "task", payload, autoExecute = false } = await request.json();

    if (!from || !to) {
      return NextResponse.json({ error: "from and to agent IDs are required." }, { status: 400 });
    }

    const message: AgentMessage = {
      id: `msg-${Date.now()}`,
      from,
      to,
      type,
      payload: payload || {},
      timestamp: new Date().toISOString(),
      processed: false,
    };

    MESSAGE_BUS.push(message);

    // Auto-execute: if enabled, immediately route the message to the target agent
    let executionResult = null;
    if (autoExecute) {
      const agentEndpoints: Record<string, string> = {
        "abm-artillery": "/api/agents/abm-artillery",
        "pii-redactor": "/api/agents/pii-redactor",
        "translate": "/api/agents/translate",
        "page-builder": "/api/agents/page-builder",
        "image-gen": "/api/agents/image-gen",
        "blog-gen": "/api/agents/blog-gen",
        "case-study": "/api/agents/case-study",
        "doc-intel": "/api/agents/doc-intel",
        "swarm": "/api/agents/swarm",
      };

      const endpoint = agentEndpoints[to];
      if (endpoint) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
        const res = await fetch(`${baseUrl}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        executionResult = await res.json();
        message.processed = true;
      }
    }

    // Keep bus size manageable
    if (MESSAGE_BUS.length > 5000) {
      MESSAGE_BUS.splice(0, MESSAGE_BUS.length - 5000);
    }

    return NextResponse.json({
      success: true,
      message,
      autoExecuted: autoExecute && executionResult !== null,
      executionResult,
    });
  } catch (error) {
    return NextResponse.json({ error: "Bus error", details: String(error) }, { status: 500 });
  }
}
