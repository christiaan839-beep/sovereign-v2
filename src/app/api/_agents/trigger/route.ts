import { NextResponse } from "next/server";
import { getPlaybook } from "@/lib/playbooks";
import { createLogger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/base-url";
import crypto from "crypto";

/**
 * SOVEREIGN MATRIX — Webhook Trigger Engine
 *
 * Receives webhooks from external services (Zapier, Make, n8n, custom webhooks)
 * and automatically triggers playbook executions or direct agent runs.
 *
 * Auth: API key via `api_key` field (checked against WEBHOOK_API_KEY env var).
 * No Clerk auth — designed for machine-to-machine webhook calls.
 *
 * Two modes:
 *   1. Playbook mode: { trigger_type, playbook_id, inputs, api_key, auto_execute }
 *   2. Agent mode:    { agent, prompt, api_key }
 */

const log = createLogger("trigger-engine");

// ─── Types ──────────────────────────────────────────────────────────────────

interface TriggerAuditEntry {
  id: string;
  timestamp: string;
  mode: "playbook" | "agent";
  trigger_type?: string;
  playbook_id?: string;
  agent?: string;
  status: "success" | "failed" | "rejected";
  duration_ms: number;
  error?: string;
  ip?: string;
}

// In-memory audit trail (rotates at 500 entries)
const auditTrail: TriggerAuditEntry[] = [];
const MAX_AUDIT_ENTRIES = 500;

function recordAudit(entry: TriggerAuditEntry) {
  auditTrail.push(entry);
  if (auditTrail.length > MAX_AUDIT_ENTRIES) {
    auditTrail.splice(0, auditTrail.length - MAX_AUDIT_ENTRIES);
  }
  log.info("Trigger executed", {
    id: entry.id,
    mode: entry.mode,
    status: entry.status,
    duration_ms: entry.duration_ms,
    ...(entry.playbook_id ? { playbook_id: entry.playbook_id } : {}),
    ...(entry.agent ? { agent: entry.agent } : {}),
  });
}

function generateId(): string {
  return `trig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Authentication ─────────────────────────────────────────────────────────

function authenticateApiKey(apiKey: unknown): boolean {
  const expected = process.env.WEBHOOK_API_KEY;
  if (!expected) {
    log.warn("WEBHOOK_API_KEY env var is not set — all webhook requests will be rejected");
    return false;
  }
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    return false;
  }
  // Constant-time comparison to prevent timing attacks
  const bufApiKey = Buffer.from(apiKey, "utf8");
  const bufExpected = Buffer.from(expected, "utf8");
  if (bufApiKey.length !== bufExpected.length) return false;
  return crypto.timingSafeEqual(bufApiKey, bufExpected);
}

// ─── POST Handler ───────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const startTime = Date.now();
  const trigId = generateId();
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", trigger_id: trigId },
      { status: 400 }
    );
  }

  // ─── Auth ───
  if (!authenticateApiKey(body.api_key)) {
    recordAudit({
      id: trigId,
      timestamp: new Date().toISOString(),
      mode: body.playbook_id ? "playbook" : "agent",
      status: "rejected",
      duration_ms: Date.now() - startTime,
      error: "Invalid or missing api_key",
      ip,
    });
    return NextResponse.json(
      { error: "Unauthorized — invalid or missing api_key", trigger_id: trigId },
      { status: 401 }
    );
  }

  // ─── Route to the correct mode ───
  if (body.playbook_id) {
    return handlePlaybookTrigger(body, trigId, startTime, ip);
  } else if (body.agent) {
    return handleAgentTrigger(body, trigId, startTime, ip);
  } else {
    recordAudit({
      id: trigId,
      timestamp: new Date().toISOString(),
      mode: "playbook",
      status: "failed",
      duration_ms: Date.now() - startTime,
      error: "Missing playbook_id or agent field",
      ip,
    });
    return NextResponse.json(
      {
        error: "Request must include either 'playbook_id' (playbook mode) or 'agent' (direct agent mode)",
        trigger_id: trigId,
      },
      { status: 400 }
    );
  }
}

// ─── Playbook Mode ──────────────────────────────────────────────────────────

async function handlePlaybookTrigger(
  body: Record<string, unknown>,
  trigId: string,
  startTime: number,
  ip: string
): Promise<NextResponse> {
  const playbookId = body.playbook_id as string;
  const triggerType = (body.trigger_type as string) || "webhook";
  const inputs = (body.inputs as Record<string, string>) || {};
  const autoExecute = body.auto_execute !== false; // Default true for webhooks

  // Validate playbook exists
  const playbook = getPlaybook(playbookId);
  if (!playbook) {
    recordAudit({
      id: trigId,
      timestamp: new Date().toISOString(),
      mode: "playbook",
      trigger_type: triggerType,
      playbook_id: playbookId,
      status: "failed",
      duration_ms: Date.now() - startTime,
      error: `Playbook "${playbookId}" not found`,
      ip,
    });
    return NextResponse.json(
      { error: `Playbook "${playbookId}" not found`, trigger_id: trigId },
      { status: 404 }
    );
  }

  // Validate required fields
  const missingFields: string[] = [];
  for (const field of playbook.fields) {
    if (field.required && (!inputs[field.key] || !inputs[field.key].trim())) {
      missingFields.push(field.key);
    }
  }
  if (missingFields.length > 0) {
    recordAudit({
      id: trigId,
      timestamp: new Date().toISOString(),
      mode: "playbook",
      trigger_type: triggerType,
      playbook_id: playbookId,
      status: "failed",
      duration_ms: Date.now() - startTime,
      error: `Missing required fields: ${missingFields.join(", ")}`,
      ip,
    });
    return NextResponse.json(
      {
        error: "Missing required playbook fields",
        missing_fields: missingFields,
        required_fields: playbook.fields.filter((f) => f.required).map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
        })),
        trigger_id: trigId,
      },
      { status: 400 }
    );
  }

  // Call the coordinator to execute the playbook
  try {
    const baseUrl = getBaseUrl();
    const coordinatorRes = await fetch(`${baseUrl}/api/agents/coordinator`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playbook_id: playbookId,
        inputs,
        auto_execute: autoExecute,
        confirmed: true,
      }),
      signal: AbortSignal.timeout(120_000), // 2 min timeout for multi-step playbooks
    });

    const data = await coordinatorRes.json();
    const duration_ms = Date.now() - startTime;

    if (!coordinatorRes.ok) {
      recordAudit({
        id: trigId,
        timestamp: new Date().toISOString(),
        mode: "playbook",
        trigger_type: triggerType,
        playbook_id: playbookId,
        status: "failed",
        duration_ms,
        error: data.error || `Coordinator returned HTTP ${coordinatorRes.status}`,
        ip,
      });
      return NextResponse.json(
        {
          error: data.error || "Coordinator execution failed",
          trigger_id: trigId,
          trigger_type: triggerType,
          playbook_id: playbookId,
          duration_ms,
        },
        { status: coordinatorRes.status }
      );
    }

    recordAudit({
      id: trigId,
      timestamp: new Date().toISOString(),
      mode: "playbook",
      trigger_type: triggerType,
      playbook_id: playbookId,
      status: "success",
      duration_ms,
      ip,
    });

    return NextResponse.json({
      trigger_id: trigId,
      trigger_type: triggerType,
      mode: "playbook",
      playbook_id: playbookId,
      playbook_name: playbook.name,
      auto_execute: autoExecute,
      duration_ms,
      ...data,
    });
  } catch (err) {
    const duration_ms = Date.now() - startTime;
    const errMsg = err instanceof Error ? err.message : "Unknown error";

    recordAudit({
      id: trigId,
      timestamp: new Date().toISOString(),
      mode: "playbook",
      trigger_type: triggerType,
      playbook_id: playbookId,
      status: "failed",
      duration_ms,
      error: errMsg,
      ip,
    });

    log.error("Playbook trigger failed", { trigger_id: trigId, playbook_id: playbookId, error: errMsg });

    return NextResponse.json(
      {
        error: "Trigger execution failed",
        message: errMsg,
        trigger_id: trigId,
        trigger_type: triggerType,
        playbook_id: playbookId,
        duration_ms,
      },
      { status: 500 }
    );
  }
}

// ─── Agent Mode ─────────────────────────────────────────────────────────────

async function handleAgentTrigger(
  body: Record<string, unknown>,
  trigId: string,
  startTime: number,
  ip: string
): Promise<NextResponse> {
  const agent = body.agent as string;
  const prompt = body.prompt as string;

  if (!agent || typeof agent !== "string") {
    recordAudit({
      id: trigId,
      timestamp: new Date().toISOString(),
      mode: "agent",
      status: "failed",
      duration_ms: Date.now() - startTime,
      error: "Missing agent field",
      ip,
    });
    return NextResponse.json(
      { error: "Missing 'agent' field", trigger_id: trigId },
      { status: 400 }
    );
  }

  if (!prompt || typeof prompt !== "string") {
    recordAudit({
      id: trigId,
      timestamp: new Date().toISOString(),
      mode: "agent",
      agent,
      status: "failed",
      duration_ms: Date.now() - startTime,
      error: "Missing prompt field",
      ip,
    });
    return NextResponse.json(
      { error: "Missing 'prompt' field for agent mode", trigger_id: trigId },
      { status: 400 }
    );
  }

  try {
    const baseUrl = getBaseUrl();

    // Build the request body — pass all fields except api_key and agent
    const agentBody: Record<string, unknown> = { prompt, confirmed: true };
    for (const [key, value] of Object.entries(body)) {
      if (!["api_key", "agent", "prompt", "confirmed"].includes(key)) {
        agentBody[key] = value;
      }
    }

    const agentRes = await fetch(`${baseUrl}/api/agents/${agent}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(agentBody),
      signal: AbortSignal.timeout(60_000),
    });

    const data = await agentRes.json();
    const duration_ms = Date.now() - startTime;

    if (!agentRes.ok) {
      recordAudit({
        id: trigId,
        timestamp: new Date().toISOString(),
        mode: "agent",
        agent,
        status: "failed",
        duration_ms,
        error: data.error || `Agent returned HTTP ${agentRes.status}`,
        ip,
      });
      return NextResponse.json(
        {
          error: data.error || "Agent execution failed",
          trigger_id: trigId,
          agent,
          duration_ms,
        },
        { status: agentRes.status }
      );
    }

    recordAudit({
      id: trigId,
      timestamp: new Date().toISOString(),
      mode: "agent",
      agent,
      status: "success",
      duration_ms,
      ip,
    });

    return NextResponse.json({
      trigger_id: trigId,
      mode: "agent",
      agent,
      duration_ms,
      ...data,
    });
  } catch (err) {
    const duration_ms = Date.now() - startTime;
    const errMsg = err instanceof Error ? err.message : "Unknown error";

    recordAudit({
      id: trigId,
      timestamp: new Date().toISOString(),
      mode: "agent",
      agent,
      status: "failed",
      duration_ms,
      error: errMsg,
      ip,
    });

    log.error("Agent trigger failed", { trigger_id: trigId, agent, error: errMsg });

    return NextResponse.json(
      {
        error: "Agent trigger failed",
        message: errMsg,
        trigger_id: trigId,
        agent,
        duration_ms,
      },
      { status: 500 }
    );
  }
}

// ─── GET Handler — API Documentation ────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    name: "Sovereign Matrix — Webhook Trigger Engine",
    version: "1.0.0",
    description:
      "Receives webhooks from external services (Zapier, Make, n8n, custom webhooks) and triggers playbook executions or direct agent runs.",
    authentication: {
      method: "API Key",
      field: "api_key",
      env_var: "WEBHOOK_API_KEY",
      note: "Include your API key in the request body. No Clerk auth required.",
    },
    endpoints: {
      "POST /api/agents/trigger": {
        description: "Execute a trigger",
        modes: {
          playbook: {
            description: "Run a pre-configured multi-agent playbook",
            body: {
              trigger_type: {
                type: "string",
                enum: ["webhook", "cron", "event"],
                default: "webhook",
                description: "Source of the trigger",
              },
              playbook_id: {
                type: "string",
                required: true,
                description: "ID of the playbook to execute",
              },
              inputs: {
                type: "object",
                required: true,
                description: "Key-value pairs matching the playbook's required fields",
              },
              api_key: {
                type: "string",
                required: true,
                description: "Your webhook API key",
              },
              auto_execute: {
                type: "boolean",
                default: true,
                description: "Set to false to get a plan preview without executing",
              },
            },
            example: {
              trigger_type: "webhook",
              playbook_id: "lead-blitz",
              inputs: { niche: "fintech", location: "London", product: "AI CRM" },
              api_key: "your-api-key",
              auto_execute: true,
            },
          },
          agent: {
            description: "Run any single agent directly",
            body: {
              agent: {
                type: "string",
                required: true,
                description: "Agent name (e.g. smart-router, leads, blog-gen)",
              },
              prompt: {
                type: "string",
                required: true,
                description: "The prompt or task for the agent",
              },
              api_key: {
                type: "string",
                required: true,
                description: "Your webhook API key",
              },
            },
            example: {
              agent: "smart-router",
              prompt: "Analyze this company: acme.com",
              api_key: "your-api-key",
            },
          },
        },
      },
      "GET /api/agents/trigger": {
        description: "Returns this documentation",
      },
    },
    available_playbooks: [
      "lead-blitz",
      "competitor-takedown",
      "content-machine",
      "proposal-blaster",
      "seo-domination",
      "brand-forensics",
      "funnel-autopsy",
      "ghost-fleet",
      "meeting-prep",
      "weekly-report",
      "contract-review",
      "ad-campaign",
      "onboard-client",
    ],
    available_agents: [
      "leads", "blog-gen", "seo-dominator", "site-assassin", "competitor-scan",
      "email-sequence", "smart-router", "vision", "translate", "embed",
      "omni-search", "deep-think", "proposal-generator", "case-study",
      "brand-voice", "brand-audit", "ad-report", "funnel-xray",
      "organic-content", "content", "doc-intel", "contract-analyzer", "client-report",
    ],
    audit: {
      description: "Every trigger execution is logged with ID, timestamp, mode, status, duration, and source IP.",
      retention: `Last ${MAX_AUDIT_ENTRIES} entries kept in memory`,
    },
    integrations: {
      zapier: "Use a Webhook action pointed at POST /api/agents/trigger",
      make: "Use an HTTP module pointed at POST /api/agents/trigger",
      n8n: "Use an HTTP Request node pointed at POST /api/agents/trigger",
      custom: "Any HTTP client can POST JSON to this endpoint",
    },
  });
}
