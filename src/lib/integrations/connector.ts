/**
 * SOVEREIGN MATRIX — Integration Connector Executor
 *
 * Generic framework for executing integration actions against external APIs.
 * Each connector implements a standard interface: authenticate, execute, transform.
 *
 * Usage:
 *   const result = await executeConnector("hubspot", "list-contacts", { limit: 10 });
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("connector");

// ── Types ──

export interface ConnectorAuth {
  type: "api_key" | "oauth2" | "bearer";
  token: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface ConnectorRequest {
  /** Integration ID (e.g., "hubspot", "slack") */
  integrationId: string;
  /** Action ID (e.g., "list-contacts", "send-message") */
  actionId: string;
  /** Action-specific parameters */
  params: Record<string, unknown>;
  /** Auth credentials (resolved from user settings) */
  auth: ConnectorAuth;
}

export interface ConnectorResponse {
  success: boolean;
  data: unknown;
  error?: string;
  /** HTTP status from the external API */
  statusCode?: number;
  /** Time taken to execute in ms */
  durationMs: number;
}

// ── Connector Implementations ──

type ConnectorHandler = (
  actionId: string,
  params: Record<string, unknown>,
  auth: ConnectorAuth
) => Promise<{ data: unknown; statusCode: number }>;

const CONNECTORS: Record<string, ConnectorHandler> = {
  hubspot: hubspotConnector,
  slack: slackConnector,
  "google-sheets": googleSheetsConnector,
  gmail: gmailConnector,
  webhook: webhookConnector,
  airtable: airtableConnector,
  notion: notionConnector,
  sendgrid: sendgridConnector,
  mailchimp: mailchimpConnector,
  calendly: calendlyConnector,
  pipedrive: pipedriveConnector,
  salesforce: salesforceConnector,
  stripe: stripeConnector,
  twilio: twilioConnector,
  "google-calendar": googleCalendarConnector,
};

// ── Public API ──

/**
 * Execute a connector action against an external service.
 */
export async function executeConnector(req: ConnectorRequest): Promise<ConnectorResponse> {
  const start = Date.now();
  const handler = CONNECTORS[req.integrationId];

  if (!handler) {
    return {
      success: false,
      data: null,
      error: `Connector "${req.integrationId}" is not implemented. Available: ${Object.keys(CONNECTORS).join(", ")}`,
      durationMs: Date.now() - start,
    };
  }

  try {
    const { data, statusCode } = await handler(req.actionId, req.params, req.auth);
    const success = statusCode >= 200 && statusCode < 300;

    if (!success) {
      log.warn("Connector action failed", {
        integration: req.integrationId,
        action: req.actionId,
        statusCode,
      });
    }

    return { success, data, statusCode, durationMs: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown connector error";
    log.error("Connector execution error", {
      integration: req.integrationId,
      action: req.actionId,
      error: message,
    });
    return {
      success: false,
      data: null,
      error: message,
      durationMs: Date.now() - start,
    };
  }
}

/** List all available (implemented) connectors */
export function getAvailableConnectors(): string[] {
  return Object.keys(CONNECTORS);
}

// ── HubSpot Connector ──

async function hubspotConnector(
  actionId: string,
  params: Record<string, unknown>,
  auth: ConnectorAuth
): Promise<{ data: unknown; statusCode: number }> {
  const baseUrl = "https://api.hubapi.com";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${auth.token}`,
  };

  switch (actionId) {
    case "list-contacts": {
      const limit = (params.limit as number) || 10;
      const res = await fetch(`${baseUrl}/crm/v3/objects/contacts?limit=${limit}`, { headers });
      return { data: await res.json(), statusCode: res.status };
    }
    case "create-contact": {
      const res = await fetch(`${baseUrl}/crm/v3/objects/contacts`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          properties: {
            email: params.email,
            firstname: params.firstName,
            lastname: params.lastName,
            company: params.company,
            phone: params.phone,
          },
        }),
      });
      return { data: await res.json(), statusCode: res.status };
    }
    case "list-deals": {
      const limit = (params.limit as number) || 10;
      const res = await fetch(`${baseUrl}/crm/v3/objects/deals?limit=${limit}`, { headers });
      return { data: await res.json(), statusCode: res.status };
    }
    case "create-deal": {
      const res = await fetch(`${baseUrl}/crm/v3/objects/deals`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          properties: {
            dealname: params.name,
            amount: params.amount,
            pipeline: params.pipeline || "default",
            dealstage: params.stage || "appointmentscheduled",
          },
        }),
      });
      return { data: await res.json(), statusCode: res.status };
    }
    default:
      return { data: { error: `Unknown HubSpot action: ${actionId}` }, statusCode: 400 };
  }
}

// ── Slack Connector ──

async function slackConnector(
  actionId: string,
  params: Record<string, unknown>,
  auth: ConnectorAuth
): Promise<{ data: unknown; statusCode: number }> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${auth.token}`,
  };

  switch (actionId) {
    case "send-message": {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers,
        body: JSON.stringify({
          channel: params.channel,
          text: params.text,
          blocks: params.blocks,
        }),
      });
      return { data: await res.json(), statusCode: res.status };
    }
    case "list-channels": {
      const res = await fetch("https://slack.com/api/conversations.list?types=public_channel&limit=100", { headers });
      return { data: await res.json(), statusCode: res.status };
    }
    default:
      return { data: { error: `Unknown Slack action: ${actionId}` }, statusCode: 400 };
  }
}

// ── Google Sheets Connector ──

async function googleSheetsConnector(
  actionId: string,
  params: Record<string, unknown>,
  auth: ConnectorAuth
): Promise<{ data: unknown; statusCode: number }> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${auth.token}`,
  };

  switch (actionId) {
    case "read-range": {
      const { spreadsheetId, range } = params as { spreadsheetId: string; range: string };
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
        { headers }
      );
      return { data: await res.json(), statusCode: res.status };
    }
    case "append-row": {
      const { spreadsheetId, range, values } = params as {
        spreadsheetId: string;
        range: string;
        values: unknown[][];
      };
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ values }),
        }
      );
      return { data: await res.json(), statusCode: res.status };
    }
    default:
      return { data: { error: `Unknown Sheets action: ${actionId}` }, statusCode: 400 };
  }
}

// ── Gmail Connector ──

async function gmailConnector(
  actionId: string,
  params: Record<string, unknown>,
  auth: ConnectorAuth
): Promise<{ data: unknown; statusCode: number }> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${auth.token}`,
  };

  switch (actionId) {
    case "send-email": {
      const { to, subject, body } = params as { to: string; subject: string; body: string };
      // Gmail API requires base64url-encoded RFC 2822 message
      const message = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${body}`;
      const encoded = Buffer.from(message).toString("base64url");
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers,
        body: JSON.stringify({ raw: encoded }),
      });
      return { data: await res.json(), statusCode: res.status };
    }
    case "list-messages": {
      const query = (params.query as string) || "";
      const maxResults = (params.maxResults as number) || 10;
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
        { headers }
      );
      return { data: await res.json(), statusCode: res.status };
    }
    default:
      return { data: { error: `Unknown Gmail action: ${actionId}` }, statusCode: 400 };
  }
}

// ── Generic Webhook Connector ──

async function webhookConnector(
  actionId: string,
  params: Record<string, unknown>,
  auth: ConnectorAuth
): Promise<{ data: unknown; statusCode: number }> {
  if (actionId !== "fire") {
    return { data: { error: "Webhook connector only supports 'fire' action" }, statusCode: 400 };
  }

  const url = params.url as string;
  if (!url) {
    return { data: { error: "url is required" }, statusCode: 400 };
  }

  // SSRF protection — block private IPs
  const urlObj = new URL(url);
  const blockedHosts = ["localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254"];
  if (blockedHosts.includes(urlObj.hostname) || urlObj.hostname.startsWith("10.") || urlObj.hostname.startsWith("192.168.")) {
    return { data: { error: "Blocked: private/internal URLs not allowed" }, statusCode: 403 };
  }

  const method = (params.method as string)?.toUpperCase() || "POST";
  const body = params.body ? JSON.stringify(params.body) : undefined;
  const customHeaders = (params.headers as Record<string, string>) || {};

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...customHeaders,
      ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
    },
    body: method !== "GET" ? body : undefined,
    signal: AbortSignal.timeout(10_000), // 10s timeout
  });

  let data: unknown;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { data, statusCode: res.status };
}

// ── Airtable Connector ──

async function airtableConnector(actionId: string, params: Record<string, unknown>, auth: ConnectorAuth) {
  const baseId = params.baseId as string;
  const table = params.table as string;
  const headers = { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" };

  switch (actionId) {
    case "list-records": {
      const res = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?maxRecords=${params.limit || 100}`, { headers });
      return { data: await res.json(), statusCode: res.status };
    }
    case "create-record": {
      const res = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`, {
        method: "POST", headers, body: JSON.stringify({ fields: params.fields }),
      });
      return { data: await res.json(), statusCode: res.status };
    }
    default: return { data: { error: `Unknown action: ${actionId}` }, statusCode: 400 };
  }
}

// ── Notion Connector ──

async function notionConnector(actionId: string, params: Record<string, unknown>, auth: ConnectorAuth) {
  const headers = { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json", "Notion-Version": "2022-06-28" };

  switch (actionId) {
    case "search": {
      const res = await fetch("https://api.notion.com/v1/search", {
        method: "POST", headers, body: JSON.stringify({ query: params.query, page_size: params.limit || 10 }),
      });
      return { data: await res.json(), statusCode: res.status };
    }
    case "create-page": {
      const res = await fetch("https://api.notion.com/v1/pages", {
        method: "POST", headers, body: JSON.stringify({ parent: params.parent, properties: params.properties }),
      });
      return { data: await res.json(), statusCode: res.status };
    }
    default: return { data: { error: `Unknown action: ${actionId}` }, statusCode: 400 };
  }
}

// ── SendGrid Connector ──

async function sendgridConnector(actionId: string, params: Record<string, unknown>, auth: ConnectorAuth) {
  const headers = { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" };

  switch (actionId) {
    case "send-email": {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST", headers,
        body: JSON.stringify({
          personalizations: [{ to: [{ email: params.to }] }],
          from: { email: params.from || "noreply@sovereignmatrix.agency" },
          subject: params.subject,
          content: [{ type: "text/html", value: params.body }],
        }),
      });
      return { data: res.status === 202 ? { sent: true } : await res.json(), statusCode: res.status };
    }
    default: return { data: { error: `Unknown action: ${actionId}` }, statusCode: 400 };
  }
}

// ── Mailchimp Connector ──

async function mailchimpConnector(actionId: string, params: Record<string, unknown>, auth: ConnectorAuth) {
  const dc = auth.token.split("-").pop() || "us1";
  const headers = { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" };

  switch (actionId) {
    case "list-audiences": {
      const res = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists?count=${params.limit || 10}`, { headers });
      return { data: await res.json(), statusCode: res.status };
    }
    case "add-subscriber": {
      const res = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${params.listId}/members`, {
        method: "POST", headers,
        body: JSON.stringify({ email_address: params.email, status: "subscribed", merge_fields: params.fields || {} }),
      });
      return { data: await res.json(), statusCode: res.status };
    }
    default: return { data: { error: `Unknown action: ${actionId}` }, statusCode: 400 };
  }
}

// ── Calendly Connector ──

async function calendlyConnector(actionId: string, params: Record<string, unknown>, auth: ConnectorAuth) {
  const headers = { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" };

  switch (actionId) {
    case "list-events": {
      const res = await fetch(`https://api.calendly.com/scheduled_events?user=${params.user}&count=${params.limit || 10}`, { headers });
      return { data: await res.json(), statusCode: res.status };
    }
    case "get-availability": {
      const res = await fetch(`https://api.calendly.com/user_availability_schedules?user=${params.user}`, { headers });
      return { data: await res.json(), statusCode: res.status };
    }
    default: return { data: { error: `Unknown action: ${actionId}` }, statusCode: 400 };
  }
}

// ── Pipedrive Connector ──

async function pipedriveConnector(actionId: string, params: Record<string, unknown>, auth: ConnectorAuth) {
  const base = `https://api.pipedrive.com/v1`;
  const q = `api_token=${auth.token}`;

  switch (actionId) {
    case "list-deals": {
      const res = await fetch(`${base}/deals?${q}&limit=${params.limit || 10}`);
      return { data: await res.json(), statusCode: res.status };
    }
    case "create-deal": {
      const res = await fetch(`${base}/deals?${q}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: params.title, value: params.value, person_id: params.personId }),
      });
      return { data: await res.json(), statusCode: res.status };
    }
    case "list-persons": {
      const res = await fetch(`${base}/persons?${q}&limit=${params.limit || 10}`);
      return { data: await res.json(), statusCode: res.status };
    }
    default: return { data: { error: `Unknown action: ${actionId}` }, statusCode: 400 };
  }
}

// ── Salesforce Connector ──

async function salesforceConnector(actionId: string, params: Record<string, unknown>, auth: ConnectorAuth) {
  const instance = (params.instance as string) || "login";
  const headers = { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" };

  switch (actionId) {
    case "query": {
      const soql = encodeURIComponent(params.soql as string);
      const res = await fetch(`https://${instance}.salesforce.com/services/data/v59.0/query?q=${soql}`, { headers });
      return { data: await res.json(), statusCode: res.status };
    }
    case "create-lead": {
      const res = await fetch(`https://${instance}.salesforce.com/services/data/v59.0/sobjects/Lead`, {
        method: "POST", headers,
        body: JSON.stringify({ FirstName: params.firstName, LastName: params.lastName, Company: params.company, Email: params.email }),
      });
      return { data: await res.json(), statusCode: res.status };
    }
    default: return { data: { error: `Unknown action: ${actionId}` }, statusCode: 400 };
  }
}

// ── Stripe Connector ──

async function stripeConnector(actionId: string, params: Record<string, unknown>, auth: ConnectorAuth) {
  const headers = { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/x-www-form-urlencoded" };

  switch (actionId) {
    case "list-customers": {
      const res = await fetch(`https://api.stripe.com/v1/customers?limit=${params.limit || 10}`, { headers });
      return { data: await res.json(), statusCode: res.status };
    }
    case "list-subscriptions": {
      const res = await fetch(`https://api.stripe.com/v1/subscriptions?limit=${params.limit || 10}`, { headers });
      return { data: await res.json(), statusCode: res.status };
    }
    default: return { data: { error: `Unknown action: ${actionId}` }, statusCode: 400 };
  }
}

// ── Twilio Connector ──

async function twilioConnector(actionId: string, params: Record<string, unknown>, auth: ConnectorAuth) {
  const accountSid = (params.accountSid as string) || process.env.TWILIO_ACCOUNT_SID || "";
  const authHeader = "Basic " + Buffer.from(`${accountSid}:${auth.token}`).toString("base64");

  switch (actionId) {
    case "send-sms": {
      const body = new URLSearchParams({ To: params.to as string, From: params.from as string, Body: params.body as string });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST", headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      return { data: await res.json(), statusCode: res.status };
    }
    default: return { data: { error: `Unknown action: ${actionId}` }, statusCode: 400 };
  }
}

// ── Google Calendar Connector ──

async function googleCalendarConnector(actionId: string, params: Record<string, unknown>, auth: ConnectorAuth) {
  const headers = { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" };
  const calendarId = (params.calendarId as string) || "primary";

  switch (actionId) {
    case "list-events": {
      const timeMin = (params.timeMin as string) || new Date().toISOString();
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=${params.limit || 10}&singleEvents=true&orderBy=startTime`,
        { headers }
      );
      return { data: await res.json(), statusCode: res.status };
    }
    case "create-event": {
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
        method: "POST", headers,
        body: JSON.stringify({ summary: params.summary, start: params.start, end: params.end, description: params.description }),
      });
      return { data: await res.json(), statusCode: res.status };
    }
    default: return { data: { error: `Unknown action: ${actionId}` }, statusCode: 400 };
  }
}
