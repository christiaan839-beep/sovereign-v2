import { createAgentRoute } from "@/lib/agent-factory";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * NEMOCLAW SELF-SETUP — Guide users through local NemoClaw installation.
 *
 * Returns platform-specific setup instructions and validates
 * whether the user's local NemoClaw daemon is reachable.
 *
 * GET: Returns setup instructions + checks local daemon status
 * POST: Validates connection to user's NemoClaw instance
 */

export async function GET() {
  // Check if local NemoClaw daemon is running
  let localStatus = "offline";
  try {
    const res = await fetch("http://127.0.0.1:18789/health", {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) localStatus = "online";
  } catch {
    // Not running locally
  }

  return NextResponse.json({
    localDaemonStatus: localStatus,
    setup: {
      description: "NemoClaw is NVIDIA's open-source local agent executor. It runs AI agents directly on your hardware with full privacy — no data leaves your machine.",
      requirements: {
        os: ["macOS 13+", "Ubuntu 22.04+", "Windows 11 with WSL2"],
        gpu: "NVIDIA RTX 3060+ (8GB VRAM minimum) or Apple Silicon M1+",
        ram: "16GB minimum, 32GB recommended",
        disk: "20GB free space for models",
      },
      quickInstall: {
        linux_mac: "curl -fsSL https://www.nvidia.com/nemoclaw.sh | bash",
        windows_wsl: "wsl --install && curl -fsSL https://www.nvidia.com/nemoclaw.sh | bash",
        docker: "docker run -d --gpus all -p 18789:18789 nvidia/nemoclaw:latest",
      },
      postInstall: [
        "NemoClaw starts automatically on port 18789",
        "Open Sovereign Matrix dashboard > Edge Terminal",
        "The platform auto-detects your local NemoClaw instance",
        "All agent executions will use your local GPU when available",
      ],
      models: {
        default: "Nemotron 3 Nano 30B (runs on 8GB VRAM)",
        recommended: "Nemotron 3 Super 120B (needs 24GB VRAM)",
        full: "Nemotron Ultra 253B (needs 80GB VRAM or multi-GPU)",
      },
      privacy: "All inference runs locally. No data is sent to any cloud service. Your API keys, documents, and conversations stay on your hardware.",
      platformIntegration: {
        endpoint: "http://127.0.0.1:18789/api/execute",
        healthCheck: "http://127.0.0.1:18789/health",
        dashboardPage: "/dashboard/nemo-claw",
      },
    },
  });
}

async function _postHandler(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { host = "127.0.0.1", port = 18789 } = await request.json();

    // Validate connection to user's NemoClaw
    const healthUrl = `http://${host}:${port}/health`;
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(3000) });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({
        connected: true,
        host,
        port,
        version: data.version || "unknown",
        models: data.models || [],
        gpu: data.gpu || "detected",
        message: "NemoClaw is running and connected to Sovereign Matrix.",
      });
    }

    return NextResponse.json({
      connected: false,
      host,
      port,
      message: `NemoClaw responded with status ${res.status}. Check if the daemon is running correctly.`,
    });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      message: `Cannot reach NemoClaw. Make sure it's running: curl -fsSL https://www.nvidia.com/nemoclaw.sh | bash`,
      error: error instanceof Error ? error.message : "Connection failed",
    });
  }
}


// Factory wrapper for POST (adds safety pipeline)
export const POST = createAgentRoute({
  name: "nemoclaw-setup",
  handler: async ({ input, email, userId, request }) => {
    // Delegate to existing handler
    const fakeReq = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const res = await _postHandler(fakeReq);
    return res instanceof Response ? await res.json() : res;
  },
});
