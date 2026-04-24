/**
 * Physics Reasoner — physical-world reasoning agent.
 *
 * Uses NVIDIA Cosmos Reason1 (7B), a specialized model trained for
 * reasoning about physical systems: mechanics, kinematics, materials,
 * robotics-style motion planning. Closes the registered-but-unused
 * gap — `nvidia/cosmos-reason1-7b` has lived in NIM_MODELS with no
 * agent calling it.
 *
 * Intended use cases:
 *   - Robotics engineers debugging motion-planning logic
 *   - Physics students checking their work on a problem set
 *   - Simulation engineers sanity-checking a dynamics model
 *   - Industrial engineers reasoning about material-handling flows
 *
 * This is a niche capability — but nobody else in the agent-marketplace
 * space has a first-class physics-reasoning primitive. Shipping it
 * widens the platform's addressable surface beyond general-purpose
 * business agents.
 *
 * Backed by createAgentRoute — full auth + rate-limit + audit + quality
 * pipeline + circuit-breaker, same as every other factory-built agent.
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat, NIM_MODELS } from "@/lib/nvidia";

const SYSTEM_PROMPT = `You are a physics-reasoning assistant powered by NVIDIA Cosmos Reason1.
You help users think through problems in mechanics, kinematics, thermodynamics,
materials, and robotics-style motion planning.

Rules you MUST follow:
  1. Show your reasoning step-by-step. Physics problems require a visible chain
     of assumptions → equations → values → conclusion. Do not jump to the answer.
  2. State your assumptions EXPLICITLY at the top. "Assume Earth gravity (9.81 m/s²)",
     "Assume frictionless", "Assume rigid body". If the user's input is under-specified,
     ask one clarifying question before you commit to assumptions.
  3. Use SI units throughout. Convert if necessary. Always show the unit.
  4. When you cite a formula, name it ("Newton's second law: F = ma") rather than
     just writing the equation.
  5. If a question is outside physics (e.g. general reasoning, essay writing),
     politely decline: "This agent is specialized for physical-world reasoning.
     For general questions, try another Sovereign Marketplace agent."
  6. When the user asks about a specific scenario (e.g. "a ball rolling down an
     incline"), draw the free-body diagram in ASCII if the geometry is simple enough.`;

export const POST = createAgentRoute({
  name: "physics-reasoner",
  requiredFields: ["problem"],
  handler: async ({ input }) => {
    const { problem } = input as { problem: string };

    const output = await nimChat(
      NIM_MODELS.physicalReasoning,
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: problem.slice(0, 4000) },
      ],
      {
        maxTokens: 2000,
        temperature: 0.1, // low temp — physics reasoning should be deterministic
      },
    );

    return {
      success: true,
      reasoning: output,
      model: NIM_MODELS.physicalReasoning,
      domain: "physics",
    };
  },
});
