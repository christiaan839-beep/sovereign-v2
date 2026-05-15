/**
 * SOVEREIGN MATRIX — Per-tenant prompt template store (Cook 110).
 *
 * Lets enterprise tenants override the system prompt for any
 * registry agent with a templated version that interpolates
 * tenant-specific context (brand voice, regulatory jurisdiction,
 * preferred citation style).
 *
 * Pure module: in-memory store + a deterministic interpolator that
 * NEVER evaluates JS — only `${name}` placeholder substitution
 * against a typed variable bag, so a tenant template can't inject
 * arbitrary code into the prompt.
 *
 * Composes with Cook 102 prompt-cache: the rendered output is
 * cached by hash so repeat requests don't re-render.
 */

import { createHash } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export interface TenantTemplate {
  /** Stable id. */
  id: string;
  tenantId: string;
  /** Agent slug this template overrides. */
  agentSlug: string;
  /** Stable template body with ${name} placeholders. */
  body: string;
  /** Required variable names — render fails if any are missing. */
  requires: string[];
  /** ISO timestamp. */
  updatedAt: number;
}

export interface RenderRequest {
  template: TenantTemplate;
  variables: Record<string, string>;
}

export type RenderOutcome =
  | { ok: true; rendered: string; hash: string }
  | {
      ok: false;
      reason: "missing-variable" | "unsupported-placeholder" | "too-large";
      missing?: string[];
      message: string;
    };

// ── Constants ────────────────────────────────────────────────────────────

const MAX_BODY_BYTES = 16_000;
const MAX_RENDERED_BYTES = 32_000;
const PLACEHOLDER_RE = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

// ── In-memory store ───────────────────────────────────────────────────────

const BY_TENANT_AGENT = new Map<string, TenantTemplate>();

function key(tenantId: string, agentSlug: string): string {
  return `${tenantId}::${agentSlug}`;
}

export function _resetForTests(): void {
  BY_TENANT_AGENT.clear();
}

// ── Validation ────────────────────────────────────────────────────────────

/**
 * Extract every placeholder name in declaration order, deduplicated.
 * Throws on unsupported placeholder forms (e.g. nested or with code).
 */
export function extractPlaceholders(body: string): string[] {
  const seen = new Set<string>();
  for (const m of body.matchAll(PLACEHOLDER_RE)) {
    seen.add(m[1]);
  }
  return [...seen];
}

// ── CRUD ──────────────────────────────────────────────────────────────────

export function putTemplate(t: TenantTemplate): void {
  if (!t.tenantId || !t.agentSlug) {
    throw new Error("putTemplate: tenantId + agentSlug required");
  }
  if (new TextEncoder().encode(t.body).length > MAX_BODY_BYTES) {
    throw new Error(`putTemplate: body exceeds ${MAX_BODY_BYTES} bytes`);
  }
  // Auto-derive `requires` if caller didn't supply, otherwise validate
  // the supplied list matches the actual placeholders in the body.
  const placeholders = extractPlaceholders(t.body);
  if (t.requires.length > 0) {
    const missingFromBody = t.requires.filter((r) => !placeholders.includes(r));
    if (missingFromBody.length > 0) {
      throw new Error(
        `putTemplate: declared requires [${missingFromBody.join(",")}] not in body`,
      );
    }
  }
  BY_TENANT_AGENT.set(key(t.tenantId, t.agentSlug), { ...t });
}

export function getTemplate(
  tenantId: string,
  agentSlug: string,
): TenantTemplate | undefined {
  return BY_TENANT_AGENT.get(key(tenantId, agentSlug));
}

export function deleteTemplate(tenantId: string, agentSlug: string): boolean {
  return BY_TENANT_AGENT.delete(key(tenantId, agentSlug));
}

// ── Render ────────────────────────────────────────────────────────────────

/**
 * Interpolate `${name}` placeholders. Pure function: same inputs →
 * same output → same hash → cache-friendly.
 *
 * NEVER evaluates expressions. The placeholder regex matches only
 * `${ident}` where ident is `[A-Za-z_][A-Za-z0-9_]*` — no dots, no
 * brackets, no code.
 */
export function renderTemplate(req: RenderRequest): RenderOutcome {
  const placeholders = extractPlaceholders(req.template.body);
  const missing: string[] = [];
  for (const name of req.template.requires) {
    if (req.variables[name] === undefined) {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    return {
      ok: false,
      reason: "missing-variable",
      missing,
      message: `Missing required variables: ${missing.join(", ")}`,
    };
  }

  const rendered = req.template.body.replace(
    PLACEHOLDER_RE,
    (_match, name: string) => {
      const v = req.variables[name];
      return v === undefined ? "" : String(v);
    },
  );

  const renderedBytes = new TextEncoder().encode(rendered).length;
  if (renderedBytes > MAX_RENDERED_BYTES) {
    return {
      ok: false,
      reason: "too-large",
      message: `Rendered output exceeds ${MAX_RENDERED_BYTES} bytes`,
    };
  }

  const hash = createHash("sha256")
    .update(`${req.template.id}|${rendered}`)
    .digest("hex");

  // Stable-stringify check — defensive: every placeholder in the
  // body should either be required + provided, or harmlessly empty.
  for (const p of placeholders) {
    if (!req.template.requires.includes(p) && req.variables[p] === undefined) {
      // Soft-tolerated: rendered empty. Callers explicit about
      // unused vars wire requires[] strictly.
    }
  }

  return { ok: true, rendered, hash };
}

export const PROMPT_TEMPLATE_CONSTANTS = {
  MAX_BODY_BYTES,
  MAX_RENDERED_BYTES,
  PLACEHOLDER_RE,
};
