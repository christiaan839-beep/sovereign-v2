import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateConnectorFromSpec } from "@/lib/integrations/connector-factory";
import { createLogger } from "@/lib/logger";

const log = createLogger("connector-import");

/**
 * CONNECTOR IMPORT — Auto-generate connectors from OpenAPI specs.
 *
 * POST { specUrl: "https://api.example.com/swagger.json" }
 *   → Fetches spec, parses endpoints, generates working connector
 *
 * POST { specUrl: "popular", name: "github" }
 *   → Uses pre-indexed popular API spec URLs
 *
 * This is how we go from 16 → 100+ connectors without writing each by hand.
 * One API call = one new integration.
 */

// Pre-indexed popular API spec URLs (saves users from finding the spec URL)
const POPULAR_SPECS: Record<string, string> = {
  github: "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json",
  stripe: "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json",
  shopify: "https://raw.githubusercontent.com/allengrant/shopify_openapi/master/shopify_openapi.json",
  twitter: "https://api.twitter.com/2/openapi.json",
  discord: "https://raw.githubusercontent.com/discord/discord-api-spec/main/specs/openapi.json",
  notion: "https://raw.githubusercontent.com/makenotion/notion-sdk-js/main/openapi.json",
  linear: "https://raw.githubusercontent.com/niccolocase/linear-openapi/main/openapi.yaml",
  asana: "https://raw.githubusercontent.com/Asana/openapi/main/defs/asana_oas.yaml",
  jira: "https://dac-static.atlassian.com/cloud/jira/platform/swagger-v3.v3.json",
  zendesk: "https://developer.zendesk.com/api-reference/openapi/support/support.json",
  intercom: "https://raw.githubusercontent.com/intercom/Intercom-OpenAPI/main/descriptions/2.10/api.intercom.io.json",
  twilio: "https://raw.githubusercontent.com/twilio/twilio-oai/main/spec/json/twilio_api_v2010.json",
  sendgrid: "https://raw.githubusercontent.com/sendgrid/sendgrid-oai/main/oai_stoplight.json",
  mailchimp: "https://api.mailchimp.com/schema/3.0/Swagger.json",
  freshdesk: "https://api.freshdesk.com/openapi/v2/swagger.json",
};

export async function GET() {
  return NextResponse.json({
    available: Object.keys(POPULAR_SPECS),
    usage: "POST { specUrl: 'https://...' } or POST { specUrl: 'popular', name: 'github' }",
    count: Object.keys(POPULAR_SPECS).length,
  });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  try {
    const { specUrl, name } = await req.json();

    // Resolve URL
    let url = specUrl;
    if (specUrl === "popular" && name) {
      url = POPULAR_SPECS[name.toLowerCase()];
      if (!url) {
        return NextResponse.json({
          error: `Unknown API: ${name}. Available: ${Object.keys(POPULAR_SPECS).join(", ")}`,
        }, { status: 400 });
      }
    }

    if (!url || !url.startsWith("http")) {
      return NextResponse.json({ error: "Valid specUrl required" }, { status: 400 });
    }

    const connector = await generateConnectorFromSpec(url);

    log.info("Connector imported", { name: connector.name, actions: connector.actions.length, source: url });

    return NextResponse.json({
      success: true,
      connector: {
        name: connector.name,
        description: connector.description,
        baseUrl: connector.baseUrl,
        authType: connector.authType,
        actionsCount: connector.actions.length,
        actions: connector.actions.map(a => ({
          id: a.id,
          label: a.label,
          method: a.method,
          path: a.path,
        })),
      },
      message: `Connector "${connector.name}" generated with ${connector.actions.length} actions`,
    });
  } catch (err) {
    log.error("Connector import failed", { error: String(err) });
    return NextResponse.json({ error: `Import failed: ${(err as Error).message}` }, { status: 500 });
  }
}
