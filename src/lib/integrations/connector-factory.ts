/**
 * SOVEREIGN MATRIX — Connector Factory
 *
 * Auto-generates integration connectors from OpenAPI/Swagger specs.
 * Input: a Swagger JSON URL → Output: a working connector with actions.
 *
 * This is how you scale from 15 to 1,000+ connectors without writing each by hand.
 *
 * Usage:
 *   const connector = await generateConnectorFromSpec("https://api.example.com/swagger.json");
 *   // connector = { name, actions: ["list-users", "create-user", ...], execute: fn }
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("connector-factory");

// ── Types ──

export interface GeneratedAction {
  id: string;
  label: string;
  description: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  parameters: Array<{ name: string; in: "query" | "path" | "body"; required: boolean; type: string }>;
}

export interface GeneratedConnector {
  name: string;
  baseUrl: string;
  description: string;
  actions: GeneratedAction[];
  authType: "bearer" | "api_key" | "basic";
  generatedAt: string;
}

// ── Main Function ──

/**
 * Generate a connector from an OpenAPI spec URL.
 */
export async function generateConnectorFromSpec(specUrl: string): Promise<GeneratedConnector> {
  // Fetch the OpenAPI spec
  const res = await fetch(specUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Failed to fetch spec: ${res.status}`);

  const spec = await res.json();

  // Extract key info
  const title = spec.info?.title || "Unknown API";
  const baseUrl = spec.servers?.[0]?.url || spec.host ? `https://${spec.host}${spec.basePath || ""}` : "";
  const description = spec.info?.description || "";

  // Extract paths and operations
  const paths = spec.paths || {};
  const actions: GeneratedAction[] = [];

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods as Record<string, unknown>)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;

      const op = operation as Record<string, unknown>;
      const actionId = `${method}-${path.replace(/[\/{}]/g, "-").replace(/^-|-$/g, "")}`.toLowerCase();

      const parameters: GeneratedAction["parameters"] = [];
      if (Array.isArray(op.parameters)) {
        for (const param of op.parameters) {
          const p = param as Record<string, unknown>;
          parameters.push({
            name: String(p.name || ""),
            in: (p.in as "query" | "path" | "body") || "query",
            required: Boolean(p.required),
            type: String((p.schema as Record<string, unknown>)?.type || p.type || "string"),
          });
        }
      }

      actions.push({
        id: actionId,
        label: String(op.summary || op.operationId || actionId),
        description: String(op.description || ""),
        method: method.toUpperCase() as GeneratedAction["method"],
        path,
        parameters,
      });
    }
  }

  // Determine auth type
  const securitySchemes = spec.components?.securitySchemes || spec.securityDefinitions || {};
  let authType: "bearer" | "api_key" | "basic" = "bearer";
  for (const scheme of Object.values(securitySchemes)) {
    const s = scheme as Record<string, unknown>;
    if (s.type === "apiKey") authType = "api_key";
    if (s.type === "http" && s.scheme === "basic") authType = "basic";
  }

  const connector: GeneratedConnector = {
    name: title.toLowerCase().replace(/\s+/g, "-"),
    baseUrl,
    description: description.slice(0, 200),
    actions: actions.slice(0, 20), // Cap at 20 actions
    authType,
    generatedAt: new Date().toISOString(),
  };

  log.info("Connector generated from spec", { name: connector.name, actions: connector.actions.length });
  return connector;
}

/**
 * Execute an action on a generated connector.
 */
export async function executeGeneratedAction(
  connector: GeneratedConnector,
  actionId: string,
  params: Record<string, unknown>,
  authToken: string
): Promise<{ data: unknown; statusCode: number }> {
  const action = connector.actions.find(a => a.id === actionId);
  if (!action) throw new Error(`Action "${actionId}" not found in ${connector.name}`);

  // Build URL with path params
  let url = `${connector.baseUrl}${action.path}`;
  const queryParams = new URLSearchParams();
  let bodyData: Record<string, unknown> | undefined;

  for (const param of action.parameters) {
    const value = params[param.name];
    if (value === undefined && param.required) {
      throw new Error(`Missing required parameter: ${param.name}`);
    }
    if (value === undefined) continue;

    if (param.in === "path") {
      url = url.replace(`{${param.name}}`, encodeURIComponent(String(value)));
    } else if (param.in === "query") {
      queryParams.set(param.name, String(value));
    } else if (param.in === "body") {
      bodyData = { ...bodyData, [param.name]: value };
    }
  }

  const queryString = queryParams.toString();
  if (queryString) url += `?${queryString}`;

  // Build headers
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (connector.authType === "bearer") headers.Authorization = `Bearer ${authToken}`;
  else if (connector.authType === "api_key") headers["X-Api-Key"] = authToken;
  else if (connector.authType === "basic") headers.Authorization = `Basic ${authToken}`;

  const res = await fetch(url, {
    method: action.method,
    headers,
    body: action.method !== "GET" && bodyData ? JSON.stringify(bodyData) : undefined,
    signal: AbortSignal.timeout(15000),
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("json") ? await res.json() : await res.text();

  return { data, statusCode: res.status };
}
