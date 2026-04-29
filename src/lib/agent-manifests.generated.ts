/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 *
 * Produced by scripts/analyze-agent-manifests.mjs. Each entry derives
 * from static analysis of src/app/api/_agents/<slug>/route.ts.
 * Manual overrides go in src/lib/agent-manifest-overrides.ts.
 *
 * Generated at: 2026-04-29T09:31:17.022Z
 * Agent count: 223
 */

import type { AgentManifest } from "./agent-manifest";

export const AGENT_MANIFESTS: Record<string, AgentManifest> = {
  "1099-reader": {
    "slug": "1099-reader",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "a2e-chain-planner": {
    "slug": "a2e-chain-planner",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "abandoned-cart-winback": {
    "slug": "abandoned-cart-winback",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "abm-artillery": {
    "slug": "abm-artillery",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "3 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "ad-report": {
    "slug": "ad-report",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "ads": {
    "slug": "ads",
    "tier": 2,
    "tierReason": "Tier 2: writes data — user should confirm before execute",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "db_write",
        "detail": "1 occurrence"
      },
      {
        "kind": "db_read",
        "detail": "1 occurrence"
      },
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.85
  },
  "agent-builder": {
    "slug": "agent-builder",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "agent-marketplace-lister": {
    "slug": "agent-marketplace-lister",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "agent-performance": {
    "slug": "agent-performance",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "agent-pricer": {
    "slug": "agent-pricer",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "agent-reviewer": {
    "slug": "agent-reviewer",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "agent-upgrader": {
    "slug": "agent-upgrader",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "agentic-chain": {
    "slug": "agentic-chain",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "agentic-planner": {
    "slug": "agentic-planner",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "agri-intel": {
    "slug": "agri-intel",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "research_ai"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "ai-gateway": {
    "slug": "ai-gateway",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "alt-text-generator": {
    "slug": "alt-text-generator",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "analytics": {
    "slug": "analytics",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "anomaly-detector": {
    "slug": "anomaly-detector",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "api-design-reviewer": {
    "slug": "api-design-reviewer",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "asr": {
    "slug": "asr",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "audit": {
    "slug": "audit",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "auto-heal": {
    "slug": "auto-heal",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "auto-onboard": {
    "slug": "auto-onboard",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "bank-reconciler": {
    "slug": "bank-reconciler",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "benchmark": {
    "slug": "benchmark",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "bill-of-lading-reader": {
    "slug": "bill-of-lading-reader",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "billing": {
    "slug": "billing",
    "tier": 2,
    "tierReason": "Tier 2: writes data — user should confirm before execute",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "db_write",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "blog-gen": {
    "slug": "blog-gen",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "research_ai"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "public",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      },
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.85
  },
  "blueprint-parser": {
    "slug": "blueprint-parser",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "book-outliner": {
    "slug": "book-outliner",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "booking": {
    "slug": "booking",
    "tier": 2,
    "tierReason": "Tier 2: writes data — user should confirm before execute",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "db_write",
        "detail": "1 occurrence"
      },
      {
        "kind": "db_read",
        "detail": "1 occurrence"
      },
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.85
  },
  "brand-audit": {
    "slug": "brand-audit",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "brand-voice": {
    "slug": "brand-voice",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "business-card-reader": {
    "slug": "business-card-reader",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "flag",
      "handlesByDesign": true
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "calendar": {
    "slug": "calendar",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "case-study": {
    "slug": "case-study",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "cash-flow-forecaster": {
    "slug": "cash-flow-forecaster",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "chain-reactor": {
    "slug": "chain-reactor",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "churn-predictor": {
    "slug": "churn-predictor",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "citation-verifier": {
    "slug": "citation-verifier",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "claude-capabilities": {
    "slug": "claude-capabilities",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "claude-think": {
    "slug": "claude-think",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "claw-queue": {
    "slug": "claw-queue",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "client-report": {
    "slug": "client-report",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "closer": {
    "slug": "closer",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "code-agent": {
    "slug": "code-agent",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "code-reviewer": {
    "slug": "code-reviewer",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "code-sandbox": {
    "slug": "code-sandbox",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "coi-verifier": {
    "slug": "coi-verifier",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "flag",
      "handlesByDesign": true
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "collab-room": {
    "slug": "collab-room",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "4 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "comms": {
    "slug": "comms",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "competitive-radar": {
    "slug": "competitive-radar",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "competitor": {
    "slug": "competitor",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "competitor-price-monitor": {
    "slug": "competitor-price-monitor",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "competitor-scan": {
    "slug": "competitor-scan",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "compliance-monitor": {
    "slug": "compliance-monitor",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "research_ai"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "computer-use": {
    "slug": "computer-use",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "anthropic",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "confidential",
    "signals": [
      {
        "kind": "db_read",
        "detail": "1 occurrence"
      },
      {
        "kind": "uses_byok",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.85
  },
  "consensus": {
    "slug": "consensus",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "content": {
    "slug": "content",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "content-safety": {
    "slug": "content-safety",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "contract-analyzer": {
    "slug": "contract-analyzer",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "confidential",
    "signals": [
      {
        "kind": "model_call",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "contract-parser": {
    "slug": "contract-parser",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "confidential",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "coordinator": {
    "slug": "coordinator",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "cosmos-video": {
    "slug": "cosmos-video",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "cost-optimizer": {
    "slug": "cost-optimizer",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "creative-director": {
    "slug": "creative-director",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "crop-health-scout": {
    "slug": "crop-health-scout",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "daily-briefing": {
    "slug": "daily-briefing",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "dashboard-stats": {
    "slug": "dashboard-stats",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "db_read",
        "detail": "5 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "data-cleaner": {
    "slug": "data-cleaner",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "deep-search": {
    "slug": "deep-search",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "deep-think": {
    "slug": "deep-think",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      },
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "deepseek-r1": {
    "slug": "deepseek-r1",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "dependency-auditor": {
    "slug": "dependency-auditor",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "design": {
    "slug": "design",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "digital-human": {
    "slug": "digital-human",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "3 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "dispute-resolver": {
    "slug": "dispute-resolver",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "doc-analyst": {
    "slug": "doc-analyst",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "doc-intel": {
    "slug": "doc-intel",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "documentation-writer": {
    "slug": "documentation-writer",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "email-onboard": {
    "slug": "email-onboard",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      },
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "email-sequence": {
    "slug": "email-sequence",
    "tier": 2,
    "tierReason": "Tier 2: writes data — user should confirm before execute",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "db_write",
        "detail": "2 occurrences"
      },
      {
        "kind": "db_read",
        "detail": "2 occurrences"
      },
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.85
  },
  "embed": {
    "slug": "embed",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "error-log": {
    "slug": "error-log",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "expense-categorizer": {
    "slug": "expense-categorizer",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "feedback": {
    "slug": "feedback",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "filmmaker": {
    "slug": "filmmaker",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "firecrawl": {
    "slug": "firecrawl",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [
      {
        "name": "firecrawl",
        "origin": "firecrawl.dev"
      }
    ],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "confidential",
    "signals": [
      {
        "kind": "db_read",
        "detail": "1 occurrence"
      },
      {
        "kind": "uses_byok",
        "detail": "1 occurrence"
      },
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.85
  },
  "florence-ocr": {
    "slug": "florence-ocr",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "flux-image": {
    "slug": "flux-image",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "flywheel": {
    "slug": "flywheel",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "fnol-intake": {
    "slug": "fnol-intake",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "funnel-xray": {
    "slug": "funnel-xray",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "ghost-fleet": {
    "slug": "ghost-fleet",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "glasswing-sandbox-escape-detector": {
    "slug": "glasswing-sandbox-escape-detector",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "gliner-pii": {
    "slug": "gliner-pii",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "god-brain": {
    "slug": "god-brain",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      },
      {
        "kind": "external_fetch",
        "detail": "5 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "grant-finder-writer": {
    "slug": "grant-finder-writer",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "grounded-search": {
    "slug": "grounded-search",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "2 occurrences"
      },
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "healthcare-docs": {
    "slug": "healthcare-docs",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "hs-code-classifier": {
    "slug": "hs-code-classifier",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "icd10-coder": {
    "slug": "icd10-coder",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "id-verifier": {
    "slug": "id-verifier",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "image-gen": {
    "slug": "image-gen",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "imagen": {
    "slug": "imagen",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "inbox-triage": {
    "slug": "inbox-triage",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "incident-responder": {
    "slug": "incident-responder",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "invoice-extractor": {
    "slug": "invoice-extractor",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "invoice-ocr": {
    "slug": "invoice-ocr",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "leads": {
    "slug": "leads",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "research_ai"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "listing-writer": {
    "slug": "listing-writer",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "literature-review": {
    "slug": "literature-review",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "market-analysis": {
    "slug": "market-analysis",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "3 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "marketing-attribution": {
    "slug": "marketing-attribution",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "marketplace": {
    "slug": "marketplace",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "meeting-notes": {
    "slug": "meeting-notes",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "meeting-scheduler": {
    "slug": "meeting-scheduler",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "meeting-transcriber": {
    "slug": "meeting-transcriber",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "memory": {
    "slug": "memory",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "3 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "menu-digitizer": {
    "slug": "menu-digitizer",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "meta-prompt": {
    "slug": "meta-prompt",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "migration-planner": {
    "slug": "migration-planner",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "multilingual-voice": {
    "slug": "multilingual-voice",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "music-gen": {
    "slug": "music-gen",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      },
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "nda-triage": {
    "slug": "nda-triage",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "nemoclaw": {
    "slug": "nemoclaw",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "nemoclaw-setup": {
    "slug": "nemoclaw-setup",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "nemotron-omni": {
    "slug": "nemotron-omni",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "nemotron3-super": {
    "slug": "nemotron3-super",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "nexus": {
    "slug": "nexus",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "google",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.7
  },
  "ocr": {
    "slug": "ocr",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "offer-letter-gen": {
    "slug": "offer-letter-gen",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "omni-search": {
    "slug": "omni-search",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "orchestrate": {
    "slug": "orchestrate",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "orchestrator": {
    "slug": "orchestrator",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "research_ai"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "5 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "organic-content": {
    "slug": "organic-content",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "3 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "outbound": {
    "slug": "outbound",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "page-builder": {
    "slug": "page-builder",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "page-builder-stream": {
    "slug": "page-builder-stream",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "3 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "paper-summarizer": {
    "slug": "paper-summarizer",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "permit-form-filler": {
    "slug": "permit-form-filler",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "phishing-detector": {
    "slug": "phishing-detector",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "physics-reasoner": {
    "slug": "physics-reasoner",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "pii-guard": {
    "slug": "pii-guard",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "pii-redactor": {
    "slug": "pii-redactor",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "pipeline": {
    "slug": "pipeline",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "plain-language-rewriter": {
    "slug": "plain-language-rewriter",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "playbook-builder": {
    "slug": "playbook-builder",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "podcast-editor": {
    "slug": "podcast-editor",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "predictive-deploy": {
    "slug": "predictive-deploy",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "prior-auth": {
    "slug": "prior-auth",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "prior-auth-drafter": {
    "slug": "prior-auth-drafter",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "product-description-writer": {
    "slug": "product-description-writer",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "programmatic-seo": {
    "slug": "programmatic-seo",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "public",
    "signals": [
      {
        "kind": "model_call",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "prompt-ab-tester": {
    "slug": "prompt-ab-tester",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "proposal-generator": {
    "slug": "proposal-generator",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "rag-pipeline": {
    "slug": "rag-pipeline",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "3 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "reasoning-chain": {
    "slug": "reasoning-chain",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "ai"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      },
      {
        "kind": "external_fetch",
        "detail": "4 occurrences"
      }
    ],
    "classifierConfidence": 0.85
  },
  "receipt-scanner": {
    "slug": "receipt-scanner",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "refactor-suggester": {
    "slug": "refactor-suggester",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "reference-check-generator": {
    "slug": "reference-check-generator",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "replays": {
    "slug": "replays",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "reputation": {
    "slug": "reputation",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "3 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "rerank": {
    "slug": "rerank",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "resume-normalizer": {
    "slug": "resume-normalizer",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "flag",
      "handlesByDesign": true
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "resume-screener": {
    "slug": "resume-screener",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "revenue-recognition": {
    "slug": "revenue-recognition",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "review-analyzer": {
    "slug": "review-analyzer",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "rfp-responder": {
    "slug": "rfp-responder",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "safety-incident-reporter": {
    "slug": "safety-incident-reporter",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "scheduled-report": {
    "slug": "scheduled-report",
    "tier": 3,
    "tierReason": "Tier 3: email send require admin approval",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "email_send",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "scheduler": {
    "slug": "scheduler",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "screenplay-assistant": {
    "slug": "screenplay-assistant",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "security-auditor-code": {
    "slug": "security-auditor-code",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "seo": {
    "slug": "seo",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "public",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "seo-dominator": {
    "slug": "seo-dominator",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "research_ai"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "public",
    "signals": [
      {
        "kind": "model_call",
        "detail": "3 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "shopify-optimizer": {
    "slug": "shopify-optimizer",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "site-assassin": {
    "slug": "site-assassin",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "research_ai"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "3 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "sku-normalizer": {
    "slug": "sku-normalizer",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "slack-notify": {
    "slug": "slack-notify",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "smart-router": {
    "slug": "smart-router",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "anthropic",
        "inferenceFn": "import"
      },
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      },
      {
        "provider": "cerebras",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.85
  },
  "social-router": {
    "slug": "social-router",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "soil-report-extractor": {
    "slug": "soil-report-extractor",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "sql-generator": {
    "slug": "sql-generator",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "super-agent": {
    "slug": "super-agent",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "supply-chain": {
    "slug": "supply-chain",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "research_ai"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "support-bot": {
    "slug": "support-bot",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "swarm": {
    "slug": "swarm",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "task-prioritizer": {
    "slug": "task-prioritizer",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "tax-prep-assistant": {
    "slug": "tax-prep-assistant",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "telegram-router": {
    "slug": "telegram-router",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "tenant-screener": {
    "slug": "tenant-screener",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "test-generator": {
    "slug": "test-generator",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "threat-hunt": {
    "slug": "threat-hunt",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "research_ai"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "translate": {
    "slug": "translate",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "trigger": {
    "slug": "trigger",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "trust-ledger-query": {
    "slug": "trust-ledger-query",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "trust-level-auditor": {
    "slug": "trust-level-auditor",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "url-context": {
    "slug": "url-context",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "valuation-comparable-finder": {
    "slug": "valuation-comparable-finder",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "vertex-search": {
    "slug": "vertex-search",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "verticals": {
    "slug": "verticals",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "video-gen": {
    "slug": "video-gen",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "confidential",
    "signals": [
      {
        "kind": "db_read",
        "detail": "1 occurrence"
      },
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      },
      {
        "kind": "uses_byok",
        "detail": "1 occurrence"
      },
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.85
  },
  "vision": {
    "slug": "vision",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "vision-analyze": {
    "slug": "vision-analyze",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.7
  },
  "visual-reason": {
    "slug": "visual-reason",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "voice": {
    "slug": "voice",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "voice-assistant": {
    "slug": "voice-assistant",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      },
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.85
  },
  "voice-chat": {
    "slug": "voice-chat",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "voice-clone": {
    "slug": "voice-clone",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.7
  },
  "voice-closer": {
    "slug": "voice-closer",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "voice-synth": {
    "slug": "voice-synth",
    "tier": 3,
    "tierReason": "Tier 3: voice calls require admin approval",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "import"
      }
    ],
    "tools": [
      {
        "name": "elevenlabs",
        "origin": "elevenlabs.io"
      }
    ],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "voice_call",
        "detail": "15 occurrences"
      },
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.85
  },
  "voicechat": {
    "slug": "voicechat",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [
      {
        "provider": "nvidia-nim",
        "inferenceFn": "nimChat"
      }
    ],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "2 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "vulnerability-scanner": {
    "slug": "vulnerability-scanner",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "w2-reader": {
    "slug": "w2-reader",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "war-room": {
    "slug": "war-room",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "webhook-gateway": {
    "slug": "webhook-gateway",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "weekly-report": {
    "slug": "weekly-report",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      },
      {
        "kind": "external_fetch",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
  "whitelabel": {
    "slug": "whitelabel",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "workflow-engine": {
    "slug": "workflow-engine",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [],
    "classifierConfidence": 0.45
  },
  "workflows": {
    "slug": "workflows",
    "tier": 2,
    "tierReason": "Tier 2: network egress to a non-platform host",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "external_fetch",
        "detail": "4 occurrences"
      }
    ],
    "classifierConfidence": 0.7
  },
  "youtube-summarizer": {
    "slug": "youtube-summarizer",
    "tier": 1,
    "tierReason": "Tier 1: read-only / inference-only / no side effects",
    "models": [],
    "tools": [],
    "pii": {
      "guardMode": "default-mask",
      "handlesByDesign": false
    },
    "outputClass": "tenant-private",
    "signals": [
      {
        "kind": "model_call",
        "detail": "1 occurrence"
      }
    ],
    "classifierConfidence": 0.7
  },
};

/** Total manifests in this build (used by weekly-health.mjs). */
export const AGENT_MANIFEST_COUNT = 223;
