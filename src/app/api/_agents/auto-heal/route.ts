import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat } from "@/lib/nvidia";
import { getBaseUrl } from "@/lib/base-url";

/**
 * NEMOCLAW AUTO-HEAL — Self-healing backbone.
 * Now BYOK-aware via nimChat().
 */

interface HealRecord {
  id: string;
  agent: string;
  original_error: string;
  diagnosis: string;
  healing_action: string;
  healed: boolean;
  timestamp: string;
}

const HEAL_LOG: HealRecord[] = [];

export const POST = createAgentRoute({
  name: "auto-heal",
  requiredFields: ["action"],
  // Wave-111.1 batch 5: memory hooks. Past heal records for the
  // same agent + similar error_message strongly inform diagnosis +
  // healing action. High-value: a proven remediation pattern from
  // last week is the best starting point for today's identical
  // failure.
  memory: {
    search: {
      query: (input) => {
        if (input.action !== "heal") return "";
        return `auto-heal agent:${input.agent ?? ""} error:${String(input.error_message ?? "").slice(0, 200)}`;
      },
      limit: 3,
    },
    store: {
      extract: (result, input) => {
        if (input.action !== "heal") return null;
        const r = result as {
          diagnosis?: {
            root_cause?: string;
            healing_actions?: string[];
            severity?: string;
          };
          healed?: boolean;
        };
        const d = r.diagnosis;
        if (!d?.root_cause) return null;
        const actions = (d.healing_actions ?? []).slice(0, 2).join("; ");
        return `${input.agent} | ${String(input.error_message ?? "").slice(0, 120)} → ${d.severity ?? "?"} | cause: ${d.root_cause.slice(0, 200)} | actions: ${actions} | healed: ${r.healed ?? false}`;
      },
      metadata: (input) => ({
        agent: String(input.agent ?? ""),
        kind: "auto-heal-record",
      }),
    },
  },
  handler: async ({ input, pastContextAsPrompt }) => {
    const { action, agent, error_message, original_payload } = input as Record<
      string,
      unknown
    >;

    if (action === "heal") {
      if (!agent || !error_message) {
        throw new Error("agent and error_message required.");
      }

      // Step 1: Diagnose the failure using Nemotron (BYOK-aware)
      const rawDiagnosis = await nimChat(
        "mistralai/mistral-nemotron",
        [
          {
            role: "system",
            content: `You are an AI agent diagnostician. Analyze the error below and output a JSON object with:
{"root_cause": "brief description", "healing_actions": ["action1", "action2"], "recommended_model": "model_id or null", "recommended_temperature": 0.7, "recommended_max_tokens": 1024, "severity": "low|medium|high|critical"}
Only output valid JSON, nothing else.`,
          },
          {
            role: "user",
            content: `Agent: ${agent}\nError: ${error_message}\nOriginal payload: ${JSON.stringify(original_payload || {}).substring(0, 500)}${(() => {
              const past = pastContextAsPrompt();
              return past
                ? `\n\nPRIOR HEAL RECORDS for similar failures on this agent (historical FACTS — prefer proven remediation patterns):\n${past}`
                : "";
            })()}`,
          },
        ],
        { maxTokens: 300, temperature: 0.2 },
      );

      let diagnosis;
      try {
        diagnosis = JSON.parse(
          rawDiagnosis
            .replace(/```json?\n?/g, "")
            .replace(/```/g, "")
            .trim(),
        );
      } catch {
        diagnosis = {
          root_cause: "Unable to parse diagnosis",
          healing_actions: ["Retry with default parameters"],
          recommended_model: null,
          recommended_temperature: 0.7,
          recommended_max_tokens: 1024,
          severity: "medium",
        };
      }

      // Step 2: Attempt self-heal by retrying with adjusted parameters
      const baseUrl = getBaseUrl();
      let healed = false;
      let healResult = null;

      if (original_payload) {
        try {
          const adjustedPayload = {
            ...(original_payload as Record<string, unknown>),
          };
          if (diagnosis.recommended_temperature) {
            adjustedPayload.temperature = diagnosis.recommended_temperature;
          }

          const retryRes = await fetch(`${baseUrl}/api/agents/${agent}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(adjustedPayload),
          });

          healResult = await retryRes.json();
          healed = retryRes.ok && healResult?.success;
        } catch {
          healed = false;
        }
      }

      // Step 3: Log the healing event
      const record: HealRecord = {
        id: `heal-${Date.now()}`,
        agent: agent as string,
        original_error: (error_message as string).substring(0, 200),
        diagnosis: diagnosis.root_cause,
        healing_action: diagnosis.healing_actions?.[0] || "Retry",
        healed,
        timestamp: new Date().toISOString(),
      };
      HEAL_LOG.push(record);
      if (HEAL_LOG.length > 200) HEAL_LOG.splice(0, HEAL_LOG.length - 200);

      return {
        success: true,
        healed,
        diagnosis: {
          root_cause: diagnosis.root_cause,
          severity: diagnosis.severity,
          healing_actions: diagnosis.healing_actions,
          recommended_model: diagnosis.recommended_model,
        },
        heal_result: healed
          ? { preview: JSON.stringify(healResult).substring(0, 300) }
          : null,
        record,
      };
    }

    if (action === "status") {
      return {
        status: "NemoClaw Auto-Heal — Active",
        total_heals: HEAL_LOG.length,
        success_rate:
          HEAL_LOG.length > 0
            ? `${Math.round((HEAL_LOG.filter((h) => h.healed).length / HEAL_LOG.length) * 100)}%`
            : "N/A",
        recent: HEAL_LOG.slice(-10).reverse(),
      };
    }

    throw new Error("action must be 'heal' or 'status'.");
  },
});
