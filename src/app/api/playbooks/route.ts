import { NextResponse } from "next/server";
import { PLAYBOOKS } from "@/lib/playbooks";

/**
 * GET /api/playbooks
 *
 * Public catalog of available playbooks — used by the schedule form,
 * the marketplace, and external API consumers.
 *
 * Returns minimal fields for listing. Full playbook definition (steps,
 * guarantee checks, input schema) is only exposed when a user actually
 * runs or schedules it — reduces payload + limits enumeration noise.
 */
export async function GET() {
  const catalog = PLAYBOOKS.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
    // Input field schema so the schedule form can render dynamic inputs
    // (Playbook.fields carries the shape; keep this minimal + stable).
    fields: p.fields.map((f) => ({
      key: f.key,
      label: f.label,
      placeholder: f.placeholder,
      required: f.required !== false,
    })),
    estimatedTime: p.estimatedTime,
    agentCount: p.agentCount,
  }));
  return NextResponse.json(
    { playbooks: catalog, total: catalog.length },
    {
      headers: {
        // 5-minute edge cache — playbook list rarely changes
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    },
  );
}
