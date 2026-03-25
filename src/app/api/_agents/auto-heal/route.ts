import { NextResponse } from "next/server";
import { nimChat } from "@/lib/nvidia";

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

export async function POST(request: Request) {
  try {
    const { action, agent, error_message, original_payload } = await request.json();

    if (action === "heal") {
      if (!agent || !error_message) {
        return NextResponse.json({ error: "agent and error_message required." }, { status: 400 });
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
            content: `Agent: ${agent}\nError: ${error_message}\nOriginal payload: ${JSON.stringify(original_payload || {}).substring(0, 500)}`,
          },
        ],
        { maxTokens: 300, temperature: 0.2 }
      );

      let diagnosis;
      try {
        diagnosis = JSON.parse(rawDiagnosis.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
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
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
      let healed = false;
      let healResult = null;

      if (original_payload) {
        try {
          const adjustedPayload = { ...original_payload };
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
        agent,
        original_error: error_message.substring(0, 200),
        diagnosis: diagnosis.root_cause,
        healing_action: diagnosis.healing_actions?.[0] || "Retry",
        healed,
        timestamp: new Date().toISOString(),
      };
      HEAL_LOG.push(record);
      if (HEAL_LOG.length > 200) HEAL_LOG.splice(0, HEAL_LOG.length - 200);

      return NextResponse.json({
        success: true,
        healed,
        diagnosis: {
          root_cause: diagnosis.root_cause,
          severity: diagnosis.severity,
          healing_actions: diagnosis.healing_actions,
          recommended_model: diagnosis.recommended_model,
        },
        heal_result: healed ? { preview: JSON.stringify(healResult).substring(0, 300) } : null,
        record,
      });
    }

    if (action === "status") {
      return NextResponse.json({
        status: "NemoClaw Auto-Heal — Active",
        total_heals: HEAL_LOG.length,
        success_rate: HEAL_LOG.length > 0
          ? `${Math.round((HEAL_LOG.filter(h => h.healed).length / HEAL_LOG.length) * 100)}%`
          : "N/A",
        recent: HEAL_LOG.slice(-10).reverse(),
      });
    }

    return NextResponse.json({ error: "action must be 'heal' or 'status'." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Auto-heal error", details: String(error) }, { status: 500 });
  }
}
