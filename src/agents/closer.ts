import { ai } from "@/lib/ai";
import { recall, remember } from "@/lib/memory";
import type { AgentResult } from "@/types";

interface ObjectionProfile {
  type: "price" | "timing" | "trust" | "competitor" | "authority" | "custom";
  detail: string;
}

const OBJECTION_FRAMEWORKS: Record<string, string> = {
  price: `Use the "Cost of Inaction" framework:
1. Calculate what they're LOSING by not having this (missed revenue, wasted ad spend, lost time)
2. Frame the price as an investment with a specific ROI multiplier
3. Offer a risk-reversal (30-day guarantee, pay-for-performance)`,
  
  timing: `Use the "Window of Opportunity" framework:
1. Show why NOW is critical (market conditions, competitor moves, seasonal trends)
2. Quantify the cost of waiting (every day without = $X lost)
3. Create urgency without pressure ("I want to make sure you don't miss this window")`,
  
  trust: `Use the "Proof Stack" framework:
1. Lead with a specific case study with real numbers
2. Offer a small pilot project or trial period
3. Provide social proof from similar companies/industries`,
  
  competitor: `Use the "Informed Choice" framework:
1. Acknowledge the competitor respectfully
2. Highlight 2-3 specific differentiators that matter to THIS prospect
3. Offer a side-by-side comparison they can verify themselves`,
  
  authority: `Use the "Champion Builder" framework:
1. Create a one-page ROI document they can present internally
2. Offer to join a call with their decision-maker
3. Provide a "board-ready" summary with projected outcomes`,
};

/** Multi-step high-ticket closing with objection handling */
export async function generateCloseSequence(
  leadName: string,
  company: string,
  objections: string = ""
): Promise<AgentResult> {
  const memories = await recall(`close deal ${company} sales objection handling`);
  const context = memories.map(m => m.entry.text).join("\n") || "No prior sales data.";

  // Detect objection types
  const detectedObjections = detectObjections(objections);
  const frameworks = detectedObjections
    .map(o => `\n--- OBJECTION: ${o.type.toUpperCase()} ---\n${o.detail}\nFRAMEWORK TO USE:\n${OBJECTION_FRAMEWORKS[o.type] || OBJECTION_FRAMEWORKS.trust}`)
    .join("\n");

  const output = await ai(
    `Generate a 5-step high-ticket closing sequence for:

LEAD: ${leadName}
COMPANY: ${company}
OBJECTIONS: ${objections || "None specified"}
INTELLIGENCE FROM MEMORY: ${context}

${frameworks ? `\nOBJECTION HANDLING FRAMEWORKS TO APPLY:\n${frameworks}` : ""}

For each step provide:
1. CHANNEL (email / DM / call / Loom video)
2. TIMING (e.g., "Day 1", "Day 3", "Day 7")
3. SUBJECT LINE or OPENING HOOK
4. FULL MESSAGE (ready to send, not a template)
5. PSYCHOLOGY PRINCIPLE used
6. OBJECTION this step addresses (if any)

The sequence should escalate from soft touch to direct close.
Step 1: Value-first warm touch
Step 2: Proof/case study
Step 3: Objection handler
Step 4: Urgency play
Step 5: Final close with risk reversal`,
    {
      model: "nim",
      system: `You are a senior high-ticket closer who has sold $50M+ in consulting services. You know:
- Pressure kills deals. Curiosity sells.
- Every objection is a buying signal.
- The best close doesn't feel like a close.
- Specificity beats generality (use real numbers, real timelines).
- The prospect should feel like they discovered the solution, not that you pushed it.`,
      maxTokens: 2500,
    }
  );

  // Store successful patterns in God-Brain
  await remember(`Close sequence for ${company}: ${output.slice(0, 200)}`);

  return { success: true, agent: "closer", output, timestamp: new Date().toISOString() };
}

/** Detect objection types from free-text */
function detectObjections(text: string): ObjectionProfile[] {
  if (!text.trim()) return [];
  const lower = text.toLowerCase();
  const detected: ObjectionProfile[] = [];

  if (lower.match(/price|cost|expensive|budget|afford|cheap/)) {
    detected.push({ type: "price", detail: text });
  }
  if (lower.match(/timing|busy|later|not now|next quarter|wait/)) {
    detected.push({ type: "timing", detail: text });
  }
  if (lower.match(/trust|skeptic|proof|guarantee|risk|scam/)) {
    detected.push({ type: "trust", detail: text });
  }
  if (lower.match(/competitor|alternative|already using|jasper|hubspot|gohighlevel/)) {
    detected.push({ type: "competitor", detail: text });
  }
  if (lower.match(/boss|manager|board|approve|decision|stakeholder/)) {
    detected.push({ type: "authority", detail: text });
  }

  if (detected.length === 0) {
    detected.push({ type: "custom", detail: text });
  }

  return detected;
}
