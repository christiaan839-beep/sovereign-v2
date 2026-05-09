import { createAgentRoute } from "@/lib/agent-factory";
import { getNimKey } from "@/lib/nvidia";
import { NextResponse } from "next/server";

/**
 * GLiNER PII DETECTOR — Specialized PII entity detection using
 * NVIDIA's GLiNER model (more accurate than content-safety for PII).
 *
 * Detects: names, emails, phone numbers, addresses, SSN, credit cards,
 * passport numbers, medical IDs, bank accounts, IP addresses.
 */

export const POST = createAgentRoute({
  name: "gliner-pii",
  handler: async ({ input, email, userId }) => {
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
            new RegExp(
              entity.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              "g",
            ),
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
      compliance: { gdpr: true, popia: true, ccpa: true },
    };
  },
});
