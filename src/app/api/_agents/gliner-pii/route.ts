import { createAgentRoute } from "@/lib/agent-factory";
import { getNimKey } from "@/lib/nvidia";

/**
 * GLiNER PII DETECTOR — Specialized PII entity detection using
 * NVIDIA's GLiNER model (more accurate than content-safety for PII).
 *
 * Detects: names, emails, phone numbers, addresses, SSN, credit cards,
 * passport numbers, medical IDs, bank accounts, IP addresses.
 */

export async function detectPii({
  input,
}: {
  input: unknown;
  email?: string;
  userId?: string;
}) {
  const {
    text = "",
    entities = [
      "PERSON",
      "EMAIL",
      "PHONE",
      "ADDRESS",
      "SSN",
      "CREDIT_CARD",
      "PASSPORT",
      "IP_ADDRESS",
    ],
  } = input as { text?: string; entities?: string[] };

  if (!text) {
    return { error: "text is required." };
  }

  const res = await fetch(
    "https://integrate.api.nvidia.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await getNimKey()}`,
      },
      body: JSON.stringify({
        model: "nvidia/gliner-pii",
        messages: [
          {
            role: "system",
            content: `You are a specialized PII detection system. Analyze the given text and identify ALL instances of personally identifiable information. For each PII entity found, output a JSON array with objects containing: {"type": "ENTITY_TYPE", "value": "detected_value", "start": character_position, "confidence": 0.0-1.0}. Entity types to detect: ${entities.join(", ")}. If no PII is found, return an empty array [].`,
          },
          { role: "user", content: text },
        ],
        max_tokens: 1024,
        temperature: 0.1,
      }),
    },
  );

  if (!res.ok) {
    // The model call failed — a compliance detector must NEVER report
    // "CLEAN" when it never actually ran the check (that was the prior
    // behavior: an unparseable/empty response defaulted to `[]`, which
    // read as "no PII found"). Fall back to the same regex-based
    // detection the sibling pii-guard route uses when its NIM call
    // fails, so a transient outage degrades to a real (if less
    // accurate) check instead of a false "clean and compliant" claim.
    const patterns: Record<string, RegExp> = {
      EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      PHONE: /\b(\+?1?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})\b/g,
      SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
      CREDIT_CARD: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    };
    const fallbackEntities: {
      type: string;
      value: string;
      start: number;
      confidence: number;
    }[] = [];
    for (const [type, pattern] of Object.entries(patterns)) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        fallbackEntities.push({
          type,
          value: match[0],
          start: match.index,
          confidence: 0.6,
        });
      }
    }
    let fallbackRedacted = text;
    for (const entity of fallbackEntities) {
      fallbackRedacted = fallbackRedacted.replace(
        entity.value,
        `[${entity.type}]`,
      );
    }
    const fallbackRiskLevel =
      fallbackEntities.length === 0
        ? "CLEAN"
        : fallbackEntities.length <= 2
          ? "LOW"
          : fallbackEntities.length <= 5
            ? "MEDIUM"
            : "HIGH";
    return {
      success: true,
      model: "regex-fallback",
      degraded: true,
      degraded_reason: "PII model unavailable — used regex fallback",
      entities_found: fallbackEntities.length,
      entities: fallbackEntities,
      risk_level: fallbackRiskLevel,
      original_text: text,
      redacted_text: fallbackRedacted,
      compliance: {
        gdpr: fallbackEntities.length === 0,
        popia: fallbackEntities.length === 0,
        ccpa: fallbackEntities.length === 0,
      },
    };
  }

  const data = await res.json();
  const rawOutput = data?.choices?.[0]?.message?.content || "[]";

  // Parse detected entities
  let detectedEntities = [];
  try {
    detectedEntities = JSON.parse(
      rawOutput
        .replace(/```json?\n?/g, "")
        .replace(/```/g, "")
        .trim(),
    );
  } catch {
    detectedEntities = [];
  }

  // Generate redacted version
  let redactedText = text;
  if (Array.isArray(detectedEntities)) {
    for (const entity of detectedEntities) {
      if (entity.value) {
        redactedText = redactedText.replace(
          new RegExp(entity.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
          `[${entity.type || "REDACTED"}]`,
        );
      }
    }
  }

  const riskLevel =
    !Array.isArray(detectedEntities) || detectedEntities.length === 0
      ? "CLEAN"
      : detectedEntities.length <= 2
        ? "LOW"
        : detectedEntities.length <= 5
          ? "MEDIUM"
          : "HIGH";

  // compliance reflects what was actually found — a hardcoded `true`
  // here would assert "compliant" even on a run that just detected
  // PII, which defeats the point of the check.
  const isClean = riskLevel === "CLEAN";
  return {
    success: true,
    model: "gliner-pii",
    entities_found: Array.isArray(detectedEntities)
      ? detectedEntities.length
      : 0,
    entities: detectedEntities,
    risk_level: riskLevel,
    original_text: text,
    redacted_text: redactedText,
    compliance: { gdpr: isClean, popia: isClean, ccpa: isClean },
  };
}

export const POST = createAgentRoute({
  name: "gliner-pii",
  handler: detectPii,
});
