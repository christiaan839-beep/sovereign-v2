import { createAgentRoute } from "@/lib/agent-factory";

/**
 * PII GUARDRAILS — Uses GLiNER PII detection to scrub sensitive data.
 * Wraps any AI output to detect and redact PII before it reaches the user.
 * Based on NVIDIA's NeMo Guardrails Blueprint.
 */
export const POST = createAgentRoute({
  name: "pii-guard",
  handler: async ({ input, email, userId }) => {
    const { text = "", action = "detect" } = input as {
      text?: string;
      action?: string;
    };
    if (!text) return { error: "Missing `text`." };

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) return { error: "NVIDIA_NIM_API_KEY not configured." };

    // Use GLiNER PII detection model
    const res = await fetch(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${nimKey}`,
        },
        body: JSON.stringify({
          model: "nvidia/gliner-pii",
          messages: [
            {
              role: "system",
              content:
                'Detect all PII (Personally Identifiable Information) in the text. Return JSON: {"pii_found": [{"type": "email|phone|ssn|name|address|credit_card", "value": "the PII", "position": start_char_index}], "clean_text": "text with PII replaced by [REDACTED]"}',
            },
            { role: "user", content: text },
          ],
          max_tokens: 1000,
          temperature: 0.1,
        }),
      },
    );

    if (!res.ok) {
      // Fallback: use regex-based PII detection
      const patterns = {
        email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        phone: /\b(\+?1?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})\b/g,
        ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
        credit_card: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      };

      const piiFound: { type: string; value: string; position: number }[] = [];
      let cleanText = text;

      for (const [type, pattern] of Object.entries(patterns)) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          piiFound.push({ type, value: match[0], position: match.index });
          cleanText = cleanText.replace(
            match[0],
            `[REDACTED_${type.toUpperCase()}]`,
          );
        }
      }

      return {
        pii_found: piiFound,
        clean_text: action === "redact" ? cleanText : text,
        pii_count: piiFound.length,
        model: "regex-fallback",
      };
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";

    try {
      const match = raw.match(/\{[\s\S]*\}/);
      const parsed = match
        ? JSON.parse(match[0])
        : { pii_found: [], clean_text: text };
      return {
        ...parsed,
        pii_count: parsed.pii_found?.length || 0,
        model: "gliner-pii",
      };
    } catch {
      return {
        pii_found: [],
        clean_text: text,
        pii_count: 0,
        model: "gliner-pii",
        raw: raw.slice(0, 200),
      };
    }
  },
});
