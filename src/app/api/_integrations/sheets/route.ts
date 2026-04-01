/**
 * POST /api/_integrations/sheets
 *
 * Appends rows to a Google Sheet using the Google Sheets API v4.
 * Requires GOOGLE_SERVICE_ACCOUNT_KEY env var (JSON string of the service account credentials).
 *
 * Body: { spreadsheetId: string, range: string, values: string[][] }
 */

import { NextResponse } from "next/server";
import { guardRoute, errorResponse, sanitizeString, validateRequired } from "@/lib/api-guard";
import { createLogger } from "@/lib/logger";

const log = createLogger("integration:sheets");

interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/** Build a JWT and exchange it for an access token using the Google OAuth2 token endpoint. */
async function getAccessToken(serviceAccountKey: {
  client_email: string;
  private_key: string;
  token_uri: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccountKey.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: serviceAccountKey.token_uri,
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");

  const unsignedToken = `${encode(header)}.${encode(payload)}`;

  // Import the PEM private key and sign the JWT
  const pemKey = serviceAccountKey.private_key;
  const binaryDer = pemToDer(pemKey);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );
  const sig = Buffer.from(signature).toString("base64url");
  const jwt = `${unsignedToken}.${sig}`;

  const tokenRes = await fetch(serviceAccountKey.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => "");
    throw new Error(`Google token exchange failed: ${tokenRes.status} ${errText}`);
  }

  const tokenData = (await tokenRes.json()) as GoogleTokenResponse;
  return tokenData.access_token;
}

/** Convert a PEM-encoded key to a DER ArrayBuffer. */
function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function POST(req: Request) {
  try {
    const auth = await guardRoute();
    if (!auth.authorized) return auth.response;

    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!keyJson) {
      log.warn("Google service account key not configured");
      return errorResponse(
        "Google Sheets not configured. Add GOOGLE_SERVICE_ACCOUNT_KEY to env vars.",
        503,
        "SHEETS_NOT_CONFIGURED"
      );
    }

    let serviceAccountKey: { client_email: string; private_key: string; token_uri: string };
    try {
      serviceAccountKey = JSON.parse(keyJson);
    } catch {
      return errorResponse("Invalid GOOGLE_SERVICE_ACCOUNT_KEY JSON", 500, "SHEETS_CONFIG_ERROR");
    }

    const body = await req.json();
    const missing = validateRequired(body, ["spreadsheetId", "range", "values"]);
    if (missing) return errorResponse(missing, 400, "VALIDATION_ERROR");

    const spreadsheetId = sanitizeString(body.spreadsheetId, 200);
    const range = sanitizeString(body.range, 200);
    const values: string[][] = body.values;

    if (!Array.isArray(values) || !values.every(Array.isArray)) {
      return errorResponse("values must be a 2D array of strings", 400, "VALIDATION_ERROR");
    }

    log.info("Appending rows to Google Sheet", {
      spreadsheetId,
      range,
      rowCount: values.length,
      userId: auth.userId,
    });

    const accessToken = await getAccessToken(serviceAccountKey);

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      log.error("Google Sheets API error", { status: res.status, error: errBody });
      return errorResponse(`Google Sheets API error: ${res.status}`, 502, "SHEETS_API_ERROR");
    }

    const result = await res.json();
    log.info("Google Sheets rows appended", { updatedRange: result.updates?.updatedRange });

    return NextResponse.json({
      success: true,
      updatedRange: result.updates?.updatedRange,
      updatedRows: result.updates?.updatedRows,
    });
  } catch (err) {
    log.error("Google Sheets integration error", { error: String(err) });
    return errorResponse("Failed to append to Google Sheet", 500, "SHEETS_ERROR");
  }
}
