import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * PHISHING-DETECTOR — Classify an email body or URL as phishing with
 * confidence, indicators, and a recommendation.
 *
 * Input:
 *   { content: string, senderDomain?: string, headers?: string }
 *
 * Output (JSON):
 *   {
 *     verdict:        "safe"|"suspicious"|"phish",
 *     confidence:     number (0-1),
 *     indicators:     string[],
 *     recommendation: string
 *   }
 *
 * Pairs with:
 *   - `incident-responder` — downstream triage if confirmed phish
 *   - `security-auditor-code` — audit adjacent email-parsing code
 */

const PHISHING_SYSTEM_PROMPT = `You are a senior security analyst specializing in phishing and social-engineering detection. You triage emails and URLs under time pressure and your team relies on your calibration.

${ANTI_SLOP_RULES}

## DETECTION HEURISTICS
1. Lookalike domains — homoglyph substitution ("paypa1.com", "rnicrosoft.com"), suspicious TLDs (.zip, .top, .xyz), punycode abuse.
2. Urgency pressure — "verify within 24 hours", "account suspended", "immediate action required", time-pressured deadlines.
3. Credential harvesting — links to login pages on unrelated domains, fake password-reset flows, forms requesting MFA codes.
4. Sender/reply-to mismatch — display name claims one entity, actual address is another domain.
5. Suspicious attachments — .exe, .iso, .scr, .lnk disguised as documents; macro-enabled Office files from unknown senders.
6. Grammatical red flags — inconsistent formality, awkward phrasing, generic greetings ("Dear Customer"), but NOT a sole indicator.
7. Link obfuscation — URL shorteners, IP addresses in URLs, extremely long paths, deceptive anchor text.

## VERDICT CALIBRATION
- "phish" — strong evidence of malicious intent (credential harvesting page + urgency + lookalike domain). Confidence >= 0.8.
- "suspicious" — one or more red flags but could be legitimate marketing/misconfigured email. Confidence 0.4-0.8.
- "safe" — no meaningful indicators of phishing. Confidence >= 0.8 in the safe direction.

Prefer "suspicious" over "phish" when uncertain — a human-review flag is cheaper than a false accusation.

## RECOMMENDATION
Concrete next action: "Delete and report to IT", "Forward headers to security team for analysis", "Verify with sender via known channel", "Safe to engage — but confirm sender if requesting data".

indicators[] are concrete observed signals, not abstract categories. Example: "Display name 'PayPal' but reply-to is at 'paypa1-security.top'". Not "domain spoofing suspected".

Output VALID JSON only — no markdown fences, no prose outside the JSON.`;

export const POST = createAgentRoute({
  name: "phishing-detector",
  requiredFields: ["content"],
  handler: async ({ input }) => {
    const { content, senderDomain, headers } = input as {
      content: string;
      senderDomain?: string;
      headers?: string;
    };

    const prompt = `Classify the following email/URL as phishing, suspicious, or safe. Return ONLY valid JSON.

SENDER DOMAIN: ${senderDomain ?? "unknown"}

HEADERS:
"""
${(headers ?? "not provided").slice(0, 4_000)}
"""

CONTENT:
"""
${content.slice(0, 15_000)}
"""

SCHEMA:
{
  "verdict": "safe"|"suspicious"|"phish",
  "confidence": number,
  "indicators": [ string ],
  "recommendation": string
}`;

    const response = await ai(prompt, {
      system: PHISHING_SYSTEM_PROMPT,
      maxTokens: 2000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Phishing detection failed: model returned non-JSON output");
    }

    return { success: true, ...(parsed as object) };
  },
});
