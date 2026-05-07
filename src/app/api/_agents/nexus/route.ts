import { createAgentRoute } from "@/lib/agent-factory";

/**
 * Nexus — meta-orchestrator. Stub: dispatches the prompt through the
 * unified router with no extra logic. Listed in
 * `src/app/api/agents/registry.ts` so the dynamic dispatcher resolves.
 * The richer composition logic (multi-agent fan-out + result merge) is
 * future work tracked alongside `swarm-protocol.ts`.
 */
export const POST = createAgentRoute({
  name: "nexus",
  handler: async ({ input }) => {
    const { prompt } = (input ?? {}) as { prompt?: string };
    if (!prompt) return { error: "`prompt` is required." };
    const { ai } = await import("@/lib/ai");
    const result = await ai(prompt, { model: "nim" });
    return { ok: true, result };
  },
});
