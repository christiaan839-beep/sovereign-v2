import { createAgentRoute } from "@/lib/agent-factory";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getBaseUrl } from "@/lib/base-url";

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
    const messages = MESSAGE_BUS.filter(
      (m) => m.to === agentId && !m.processed,
    );
    return NextResponse.json({ messages, pending: messages.length });
  }

  return NextResponse.json({
    status: "Agent Communication Bus — Active",
    total_messages: MESSAGE_BUS.length,
    pending: MESSAGE_BUS.filter((m) => !m.processed).length,
    recent: MESSAGE_BUS.slice(-20).reverse(),
  });
}

async function _postHandler(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    const {
      from,
      to,
      type = "task",
      payload,
      autoExecute = false,
    } = await request.json();

    if (!from || !to) {
      return NextResponse.json(
        { error: "from and to agent IDs are required." },
        { status: 400 },
      );
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
        "abm-artillery": "/api/_agents/abm-artillery",
        "pii-redactor": "/api/_agents/pii-redactor",
        translate: "/api/_agents/translate",
        "page-builder": "/api/_agents/page-builder",
        "image-gen": "/api/_agents/image-gen",
        "blog-gen": "/api/_agents/blog-gen",
        "case-study": "/api/_agents/case-study",
        "doc-intel": "/api/_agents/doc-intel",
        swarm: "/api/_agents/swarm",
      };

      const endpoint = agentEndpoints[to];
      if (endpoint) {
        const baseUrl = getBaseUrl();
        const res = await outboundFetchAsResponse(`${baseUrl}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }, { ruleId: "agents.comms.route.1", allowedHosts: [new URL(baseUrl).hostname] });
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
    return NextResponse.json(
      { error: "Bus error", details: String(error) },
      { status: 500 },
    );
  }
}

// Factory wrapper for POST (adds safety pipeline)
import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

export const POST = createAgentRoute({
  name: "comms",
  handler: async ({ input, email, userId, request }) => {
    // Delegate to existing handler
    const fakeReq = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const res = await _postHandler(fakeReq);
    return res instanceof Response ? await res.json() : res;
  },
});
