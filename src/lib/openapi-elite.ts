/**
 * SOVEREIGN MATRIX — Elite-tier OpenAPI 3.1 path additions (Wave 22).
 *
 * Extends the public OpenAPI spec (src/app/api/openapi.json) with the
 * 13 surfaces shipped in Waves 7 through 21:
 *
 *   /auditor/replay/{id}        Wave 7  forensic receipt reconstruction
 *   /auditor/anchor             Wave 9  Bitcoin-anchored audit-log head
 *   /built/ledger               Wave 14 shipped-work ledger
 *   /status/metrics             Wave 15 real production latency
 *   /agent-tokens               Wave 16 JIT identity issue/list
 *   /agent-tokens/{id}/status   Wave 16 token lifecycle
 *   /agent-tokens/{id}/revoke   Wave 16 admin one-click revoke
 *   /webauthn/register          Wave 8  hardware-key registration
 *   /webauthn/authenticate      Wave 8  step-up MFA assertion
 *   /dsar/verify/{id}           Wave 13 POPIA/GDPR signed export verifier
 *   /commerce/intent            Wave 18 agentic-commerce issue
 *   /commerce/verify            Wave 18 agentic-commerce verify
 *   /clinical/scribe            Wave 19 ambient SOAP note + signed receipt
 *   /guardian/run               Wave 17 signed verdict envelope
 *   /events                     Wave 21 SSE event stream
 *
 * Pure function: returns a `{ paths, components }` slice the host
 * route merges into the canonical schema. Keeps the route file thin
 * and gives us a single edit point when we add more public surfaces.
 */

export interface OpenApiSlice {
  paths: Record<string, unknown>;
  componentSchemas: Record<string, unknown>;
}

/**
 * Build the elite-tier slice. The host route deep-merges this into
 * the existing OpenAPI document so existing consumers (Postman /
 * Cursor / openapi.tools) see ONE combined contract.
 */
export function eliteOpenApiSlice(): OpenApiSlice {
  return {
    paths: {
      "/api/auditor/replay/{id}": {
        get: {
          tags: ["Auditor"],
          summary: "Replay a receipt — forensic reconstruction",
          description:
            "Re-derives the canonical projection for a stored agent_runs row, recomputes its SHA-256, and checks the stored signature against the recomputed bytes. Returns an attestation an auditor can paste into a workpaper. Set Accept: text/plain for the multi-line workpaper format.",
          operationId: "replayReceipt",
          parameters: [
            { $ref: "#/components/parameters/ReceiptIdPath" },
            {
              name: "Accept",
              in: "header",
              required: false,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Replay result",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ReplayResult" },
                },
              },
            },
            "400": { description: "Invalid receipt id" },
            "404": { description: "Receipt not found" },
          },
        },
      },
      "/api/auditor/anchor": {
        get: {
          tags: ["Auditor"],
          summary: "Latest Bitcoin-anchored audit-log chain head",
          description:
            "Returns the most recent audit_log_anchors row by default; pass ?id=<uuid> or ?head=<sha256> to target a specific anchor.",
          operationId: "getAuditAnchor",
          parameters: [
            { name: "id", in: "query", schema: { type: "string" } },
            { name: "head", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Audit anchor",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AuditAnchor" },
                },
              },
            },
            "404": { description: "No anchor found" },
          },
        },
      },
      "/api/built/ledger": {
        get: {
          tags: ["Trust"],
          summary: "Cryptographically-signed shipped-work ledger",
          description:
            "Append-only log of every shipped milestone, each signed with the same primitive every receipt uses. Returns the rolling SHA-256 digest plus per-entry attestations.",
          operationId: "getBuiltLedger",
          responses: {
            "200": {
              description: "Signed ledger",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/BuiltLedger" },
                },
              },
            },
          },
        },
      },
      "/api/status/metrics": {
        get: {
          tags: ["Observability"],
          summary: "Real production latency + success rate",
          description:
            "Live p50 / p95 / p99 / max latency and success rate from agent_runs across rolling 24h / 7d / 30d windows.",
          operationId: "getStatusMetrics",
          responses: {
            "200": {
              description: "Status metrics",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/StatusMetrics" },
                },
              },
            },
          },
        },
      },
      "/api/agent-tokens": {
        get: {
          tags: ["Identity"],
          summary: "List currently-active JIT agent tokens",
          operationId: "listAgentTokens",
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer" } },
            { name: "agent", in: "query", schema: { type: "string" } },
            { name: "tenant", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Token list",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AgentTokenList" },
                },
              },
            },
          },
        },
        post: {
          tags: ["Identity"],
          summary: "Issue a JIT agent token (admin)",
          operationId: "issueAgentToken",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/IssueTokenRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Issued token",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/IssuedToken" },
                },
              },
            },
            "400": { description: "Invalid request body" },
            "404": { description: "Not admin (deliberately vague)" },
          },
        },
      },
      "/api/agent-tokens/{id}/status": {
        get: {
          tags: ["Identity"],
          summary: "Token lifecycle status — public verifier",
          operationId: "getAgentTokenStatus",
          parameters: [{ $ref: "#/components/parameters/TokenIdPath" }],
          responses: {
            "200": {
              description: "Status",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/TokenStatus" },
                },
              },
            },
            "404": { description: "Token not found" },
          },
        },
      },
      "/api/agent-tokens/{id}/revoke": {
        post: {
          tags: ["Identity"],
          summary: "Revoke a JIT agent token (admin)",
          operationId: "revokeAgentToken",
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/TokenIdPath" }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RevokeRequest" },
              },
            },
          },
          responses: {
            "200": { description: "Revoked" },
            "404": { description: "Not found / not admin" },
          },
        },
      },
      "/api/webauthn/register": {
        post: {
          tags: ["Security"],
          summary: "Hardware-key registration ceremony",
          operationId: "webauthnRegister",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "Options or success envelope" },
            "503": { description: "WebAuthn not configured" },
          },
        },
      },
      "/api/webauthn/authenticate": {
        post: {
          tags: ["Security"],
          summary: "Step-up MFA assertion",
          operationId: "webauthnAuthenticate",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "Options or assertion envelope" },
            "503": { description: "WebAuthn not configured" },
          },
        },
      },
      "/api/dsar/verify/{id}": {
        post: {
          tags: ["Compliance"],
          summary: "Verify a signed DSAR export — POPIA/GDPR Art. 15",
          operationId: "verifyDsar",
          parameters: [{ $ref: "#/components/parameters/ReceiptIdPath" }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["payload"],
                  properties: { payload: {} },
                },
              },
            },
          },
          responses: {
            "200": { description: "Verify result" },
            "404": { description: "Unknown receipt id" },
          },
        },
      },
      "/api/commerce/intent": {
        post: {
          tags: ["Commerce"],
          summary: "Issue a signed Agentic-Commerce envelope",
          description:
            "Every AI-initiated purchase emits an ACP envelope bound to a Wave-16 JIT token. The envelope is independently verifiable; the JIT token must be active.",
          operationId: "issueAcpEnvelope",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AcpIntentRequest" },
              },
            },
          },
          responses: {
            "201": { description: "Signed ACP envelope" },
            "400": { description: "Invalid intent or consent" },
            "403": { description: "JIT token not active" },
          },
        },
      },
      "/api/commerce/verify": {
        post: {
          tags: ["Commerce"],
          summary: "Verify a signed ACP envelope",
          operationId: "verifyAcpEnvelope",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["envelope"],
                  properties: { envelope: {} },
                },
              },
            },
          },
          responses: { "200": { description: "Tagged-union verify result" } },
        },
      },
      "/api/clinical/scribe": {
        post: {
          tags: ["Healthcare"],
          summary: "Ambient SOAP-note scribe with signed receipt",
          description:
            "Takes a clinician-patient transcript and returns a structured SOAP note plus a cryptographic receipt + critical alerts. requiresClinicianApproval=true blocks auto-export.",
          operationId: "clinicalScribe",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ScribeRequest" },
              },
            },
          },
          responses: {
            "201": { description: "Scribe receipt" },
            "400": { description: "Invalid input" },
            "403": { description: "Agent token not active" },
          },
        },
      },
      "/api/guardian/run": {
        post: {
          tags: ["Guardian"],
          summary: "Run a Guardian rule set and get a signed verdict envelope",
          operationId: "runGuardian",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GuardianRunRequest" },
              },
            },
          },
          responses: { "200": { description: "Signed verdict envelope" } },
        },
      },
      "/api/events": {
        get: {
          tags: ["Realtime"],
          summary: "Server-Sent Events stream — live agent activity",
          description:
            "text/event-stream of every signed action scoped to the caller's tenant. Admin can request scope=* for fleet-wide. 30s heartbeat (`:ping`).",
          operationId: "subscribeEvents",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "scope",
              in: "query",
              schema: { type: "string", enum: ["tenant", "*"] },
            },
          ],
          responses: {
            "200": {
              description: "SSE stream",
              content: {
                "text/event-stream": { schema: { type: "string" } },
              },
            },
            "401": { description: "Unauthenticated" },
            "403": { description: "scope=* requires admin" },
          },
        },
      },
    },
    componentSchemas: {
      ReplayResult: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["ok", "tampered", "not-found", "unsigned", "no-key"],
          },
          storedSignature: { type: "string", nullable: true },
          canonical: { type: "string", nullable: true },
          canonicalHash: { type: "string", nullable: true },
          signatureVerified: { type: "boolean" },
          replayAttestation: { type: "string" },
          replayedAt: { type: "string", format: "date-time" },
        },
      },
      AuditAnchor: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          chainHead: { type: "string", description: "SHA-256 hex" },
          rowCount: { type: "integer" },
          ok: { type: "boolean" },
          proofs: { type: "array", items: { type: "object" } },
          attestedAt: { type: "string", format: "date-time" },
        },
      },
      BuiltLedger: {
        type: "object",
        properties: {
          digest: { type: "string" },
          count: { type: "integer" },
          entries: { type: "array", items: { type: "object" } },
        },
      },
      StatusMetrics: {
        type: "object",
        properties: {
          generatedAt: { type: "string", format: "date-time" },
          overall: { type: "string", enum: ["ok", "degraded", "fail"] },
          windows: { type: "array", items: { type: "object" } },
        },
      },
      AgentTokenList: {
        type: "object",
        properties: {
          generatedAt: { type: "string", format: "date-time" },
          count: { type: "integer" },
          tokens: { type: "array", items: { type: "object" } },
        },
      },
      IssueTokenRequest: {
        type: "object",
        required: ["agentSlug", "scopes"],
        properties: {
          agentSlug: { type: "string" },
          scopes: { type: "array", items: { type: "string" } },
          ttlSeconds: { type: "integer", minimum: 60, maximum: 3600 },
          tenantId: { type: "string", format: "uuid" },
        },
      },
      IssuedToken: {
        type: "object",
        properties: {
          token: { type: "string" },
          tokenId: { type: "string", format: "uuid" },
          claims: { type: "object" },
          expiresAt: { type: "string", format: "date-time" },
        },
      },
      TokenStatus: {
        type: "object",
        properties: {
          exists: { type: "boolean" },
          agentSlug: { type: "string" },
          active: { type: "boolean" },
          expiresAt: { type: "string", format: "date-time" },
          revokedAt: { type: "string", format: "date-time", nullable: true },
          revokeReason: { type: "string", nullable: true },
        },
      },
      RevokeRequest: {
        type: "object",
        required: ["reason"],
        properties: {
          reason: { type: "string", minLength: 3, maxLength: 200 },
        },
      },
      AcpIntentRequest: {
        type: "object",
        required: ["acp", "consent", "agentTokenId"],
        properties: {
          acp: { type: "object" },
          consent: { type: "object" },
          agentTokenId: { type: "string", format: "uuid" },
        },
      },
      ScribeRequest: {
        type: "object",
        required: [
          "transcript",
          "patientPseudonym",
          "encounterId",
          "agentTokenId",
        ],
        properties: {
          transcript: { type: "string", maxLength: 50000 },
          patientPseudonym: {
            type: "string",
            pattern: "^[a-zA-Z0-9_-]+$",
            description: "Hashed pseudonym — never raw PII",
          },
          encounterId: { type: "string" },
          agentTokenId: { type: "string", format: "uuid" },
        },
      },
      GuardianRunRequest: {
        type: "object",
        required: ["ctx", "rules"],
        properties: {
          ctx: { type: "object" },
          rules: { type: "array", items: { type: "object" } },
        },
      },
    },
  };
}

/**
 * Helper for the postman.json generator — translates the slice into
 * the Postman 2.1 collection item shape.
 */
export function elitePostmanItems(origin: string): unknown[] {
  const slice = eliteOpenApiSlice();
  const items: unknown[] = [];
  for (const [path, ops] of Object.entries(slice.paths)) {
    for (const [method, def] of Object.entries(
      ops as Record<string, { summary?: string; tags?: string[] }>,
    )) {
      const tag = (def.tags && def.tags[0]) ?? "Public";
      items.push({
        name: `${tag} · ${def.summary ?? path}`,
        request: {
          method: method.toUpperCase(),
          header: [{ key: "Accept", value: "application/json" }],
          url: {
            raw: `${origin}${path}`,
            host: [origin.replace(/^https?:\/\//, "")],
            path: path.split("/").filter(Boolean),
          },
        },
      });
    }
  }
  return items;
}
