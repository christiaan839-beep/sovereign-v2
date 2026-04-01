/**
 * GET  /api/_integrations/templates — returns all webhook templates
 * POST /api/_integrations/templates — saves a user's webhook configuration for a template
 *
 * Body (POST): { templateId: string, webhookUrl: string }
 */

import { NextResponse } from "next/server";
import { guardRoute, errorResponse, sanitizeString, validateRequired } from "@/lib/api-guard";
import { createLogger } from "@/lib/logger";

const log = createLogger("integration:templates");

// ─── Webhook Template Definitions ────────────────────────────────

export interface WebhookTemplate {
  id: string;
  platform: "Zapier" | "Make" | "Generic";
  name: string;
  description: string;
  trigger: string;
  webhookUrl: string;
  payload: Record<string, string>;
}

const WEBHOOK_TEMPLATES: WebhookTemplate[] = [
  {
    id: "zapier-new-lead",
    platform: "Zapier",
    name: "New Lead \u2192 Zapier",
    description: "When a lead is found, trigger a Zapier webhook",
    trigger: "agent.execute:leads",
    webhookUrl: "{{ZAPIER_WEBHOOK_URL}}",
    payload: {
      leadName: "{{lead.name}}",
      email: "{{lead.email}}",
      score: "{{lead.score}}",
    },
  },
  {
    id: "make-content-ready",
    platform: "Make",
    name: "Content Ready \u2192 Make",
    description: "When content is generated, trigger a Make scenario",
    trigger: "agent.execute:content",
    webhookUrl: "{{MAKE_WEBHOOK_URL}}",
    payload: {
      title: "{{content.title}}",
      body: "{{content.body}}",
      type: "{{content.type}}",
    },
  },
  {
    id: "zapier-meeting-booked",
    platform: "Zapier",
    name: "Meeting Booked \u2192 Zapier",
    description: "When a voice agent books a meeting, notify via Zapier",
    trigger: "agent.execute:booking",
    webhookUrl: "{{ZAPIER_WEBHOOK_URL}}",
    payload: {
      name: "{{booking.name}}",
      date: "{{booking.date}}",
      qualified: "{{booking.qualified}}",
    },
  },
  {
    id: "make-seo-report",
    platform: "Make",
    name: "SEO Report \u2192 Make",
    description: "When an SEO audit completes, send results to a Make scenario",
    trigger: "agent.execute:seo",
    webhookUrl: "{{MAKE_WEBHOOK_URL}}",
    payload: {
      domain: "{{seo.domain}}",
      score: "{{seo.score}}",
      issues: "{{seo.issues}}",
      recommendations: "{{seo.recommendations}}",
    },
  },
  {
    id: "zapier-competitor-alert",
    platform: "Zapier",
    name: "Competitor Alert \u2192 Zapier",
    description: "When a competitor scan detects changes, alert via Zapier",
    trigger: "agent.execute:competitor",
    webhookUrl: "{{ZAPIER_WEBHOOK_URL}}",
    payload: {
      competitor: "{{competitor.name}}",
      change: "{{competitor.change}}",
      severity: "{{competitor.severity}}",
    },
  },
  {
    id: "make-email-sequence",
    platform: "Make",
    name: "Email Sequence \u2192 Make",
    description: "When an email sequence is generated, push it to Make for sending",
    trigger: "agent.execute:email-sequence",
    webhookUrl: "{{MAKE_WEBHOOK_URL}}",
    payload: {
      sequenceName: "{{sequence.name}}",
      emailCount: "{{sequence.count}}",
      firstSubject: "{{sequence.firstSubject}}",
    },
  },
  {
    id: "zapier-proposal-ready",
    platform: "Zapier",
    name: "Proposal Ready \u2192 Zapier",
    description: "When a proposal is generated, notify the sales team via Zapier",
    trigger: "agent.execute:proposal-generator",
    webhookUrl: "{{ZAPIER_WEBHOOK_URL}}",
    payload: {
      clientName: "{{proposal.clientName}}",
      value: "{{proposal.value}}",
      url: "{{proposal.url}}",
    },
  },
  {
    id: "generic-agent-complete",
    platform: "Generic",
    name: "Any Agent Complete \u2192 Webhook",
    description: "Fire a webhook whenever any agent finishes a task",
    trigger: "agent.execute:*",
    webhookUrl: "{{WEBHOOK_URL}}",
    payload: {
      agent: "{{agent.id}}",
      task: "{{task.description}}",
      output: "{{task.output}}",
      completedAt: "{{task.completedAt}}",
    },
  },
];

// ─── In-memory store for user webhook configs ─────────────────────
// In production this would live in the database (e.g. tenant_settings).

interface SavedWebhookConfig {
  templateId: string;
  webhookUrl: string;
  active: boolean;
  savedAt: string;
  userId: string;
}

const userConfigs = new Map<string, SavedWebhookConfig[]>();

// ─── Handlers ─────────────────────────────────────────────────────

export async function GET() {
  try {
    const auth = await guardRoute();
    if (!auth.authorized) return auth.response;

    // Return templates + any saved configs for this user
    const configs = userConfigs.get(auth.userId ?? "") ?? [];

    const templatesWithStatus = WEBHOOK_TEMPLATES.map((t) => {
      const saved = configs.find((c) => c.templateId === t.id);
      return {
        ...t,
        configured: !!saved,
        active: saved?.active ?? false,
        savedWebhookUrl: saved?.webhookUrl ?? null,
      };
    });

    return NextResponse.json({
      templates: templatesWithStatus,
      total: WEBHOOK_TEMPLATES.length,
      activeCount: configs.filter((c) => c.active).length,
    });
  } catch {
    return errorResponse("Failed to load webhook templates", 500, "TEMPLATE_ERROR");
  }
}

export async function POST(req: Request) {
  try {
    const auth = await guardRoute();
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const missing = validateRequired(body, ["templateId", "webhookUrl"]);
    if (missing) return errorResponse(missing, 400, "VALIDATION_ERROR");

    const templateId = sanitizeString(body.templateId, 100);
    const webhookUrl = sanitizeString(body.webhookUrl, 2000);

    // Validate template exists
    const template = WEBHOOK_TEMPLATES.find((t) => t.id === templateId);
    if (!template) {
      return errorResponse("Unknown template ID", 404, "NOT_FOUND");
    }

    // Validate URL
    try {
      new URL(webhookUrl);
    } catch {
      return errorResponse("Invalid webhook URL", 400, "VALIDATION_ERROR");
    }

    const userId = auth.userId ?? "anonymous";
    const existing = userConfigs.get(userId) ?? [];

    // Upsert config
    const idx = existing.findIndex((c) => c.templateId === templateId);
    const config: SavedWebhookConfig = {
      templateId,
      webhookUrl,
      active: true,
      savedAt: new Date().toISOString(),
      userId,
    };

    if (idx >= 0) {
      existing[idx] = config;
    } else {
      existing.push(config);
    }

    userConfigs.set(userId, existing);

    log.info("Webhook template configured", {
      templateId,
      userId,
      platform: template.platform,
    });

    return NextResponse.json({
      success: true,
      config: {
        templateId,
        platform: template.platform,
        name: template.name,
        webhookUrl,
        active: true,
      },
    });
  } catch {
    return errorResponse("Failed to save webhook configuration", 500, "TEMPLATE_SAVE_ERROR");
  }
}
