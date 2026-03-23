/**
 * SOVEREIGN MATRIX — Agent Route Factory
 *
 * Eliminates boilerplate across 100+ agent routes.
 * Every agent shares: auth → rate limit → validate → execute → log → respond.
 * This factory generates route handlers from a simple config.
 *
 * Usage:
 *   import { createAgentRoute } from "@/lib/agent-factory";
 *
 *   export const POST = createAgentRoute({
 *     name: "seo-dominator",
 *     requiredFields: ["url"],
 *     handler: async ({ input, email, env }) => {
 *       // Your agent logic here
 *       return { result: "..." };
 *     },
 *   });
 */

import { NextResponse } from "next/server";
import { guardRoute, sanitizeString, errorResponse } from "@/lib/api-guard";

export interface AgentConfig {
  /** Agent name for logging and telemetry */
  name: string;

  /** Fields required in the request body */
  requiredFields?: string[];

  /** Skip authentication (for public demo endpoints) */
  public?: boolean;

  /** Maximum request body size in characters (default: 50000) */
  maxInputSize?: number;

  /** The agent's core logic */
  handler: (ctx: AgentContext) => Promise<Record<string, unknown>>;
}

export interface AgentContext {
  /** Parsed and sanitized request body */
  input: Record<string, unknown>;
  /** Raw request object */
  request: Request;
  /** Authenticated user email (empty string if public route) */
  email: string;
  /** Authenticated user ID (empty string if public route) */
  userId: string;
}

export function createAgentRoute(config: AgentConfig) {
  return async function POST(req: Request) {
    const startTime = Date.now();

    try {
      // ─── Auth & Rate Limiting ───
      let email = "";
      let userId = "";

      if (!config.public) {
        const guard = await guardRoute();
        if (!guard.authorized) return guard.response;
        email = guard.email;
        userId = guard.userId;
      }

      // ─── Parse & Validate Body ───
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return errorResponse("Invalid JSON body", 400, "INVALID_BODY");
      }

      // Validate required fields
      if (config.requiredFields) {
        for (const field of config.requiredFields) {
          if (body[field] === undefined || body[field] === null || body[field] === "") {
            return errorResponse(`Missing required field: ${field}`, 400, "MISSING_FIELD");
          }
        }
      }

      // Sanitize string fields
      const sanitized: Record<string, unknown> = {};
      const maxSize = config.maxInputSize ?? 50000;
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === "string") {
          sanitized[key] = sanitizeString(value, maxSize);
        } else {
          sanitized[key] = value;
        }
      }

      // ─── Execute Agent Handler ───
      const result = await config.handler({
        input: sanitized,
        request: req,
        email,
        userId,
      });

      // ─── Return Response ───
      return NextResponse.json({
        ...result,
        _meta: {
          agent: config.name,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Agent:${config.name}] Error:`, message);
      return errorResponse(message, 500, "AGENT_ERROR");
    }
  };
}
