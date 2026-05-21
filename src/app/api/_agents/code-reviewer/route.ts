import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat } from "@/lib/nvidia";

/**
 * NEMOCLAW CODE REVIEWER — Paste code and get a security audit,
 * performance review, and refactor suggestions.
 * Uses Devstral 2 123B (NVIDIA's coding specialist).
 */

export const POST = createAgentRoute({
  name: "code-reviewer",
  // Wave-111.1 batch 5: memory hooks. Recurring patterns in a
  // user's reviews (same language, same focus area) compound — the
  // reviewer surfaces patterns it flagged in prior reviews so the
  // author sees they're a repeat-issue, not a one-off.
  memory: {
    search: {
      query: (input) =>
        `code-review language:${input.language ?? "auto"} focus:${input.focus ?? "full"}`,
      limit: 3,
    },
    store: {
      extract: (result, input) => {
        const r = result as { review?: string };
        if (!r.review) return null;
        // Store the first 500 chars — typically the lead issue +
        // verdict, which is the signal worth surfacing next time.
        return `${input.language ?? "auto"}/${input.focus ?? "full"}: ${r.review.slice(0, 500)}`;
      },
      metadata: (input) => ({
        language: String(input.language ?? "auto"),
        focus: String(input.focus ?? "full"),
        kind: "code-review",
      }),
    },
  },
  handler: async ({ input, email, userId, pastContextAsPrompt }) => {
    const {
      code = "",
      language = "auto-detect",
      focus = "full",
    } = input as { code?: string; language?: string; focus?: string };

    if (!code) {
      return { error: "code is required." };
    }

    const start = Date.now();

    const focusPrompts: Record<string, string> = {
      full: "Perform a COMPLETE code review covering security, performance, maintainability, and best practices.",
      security:
        "Focus ONLY on security vulnerabilities: injection risks, auth bypasses, data exposure, OWASP Top 10.",
      performance:
        "Focus ONLY on performance: time complexity, memory leaks, N+1 queries, unnecessary re-renders, caching opportunities.",
      refactor:
        "Focus ONLY on code quality: DRY violations, function length, naming conventions, TypeScript best practices, design patterns.",
    };

    const review = await nimChat(
      "nvidia/devstral-2-123b-instruct-2512",
      [
        {
          role: "system",
          // Opus 4.7 prompt pattern (Wave 89). Was: 1-line. Opus 4.7 with
          // that prompt would often produce hedged review comments ("you
          // may want to consider…") and forget to cite line numbers in
          // half the issues. Explicit step_by_step + output_requirements
          // forces line-cite + concrete fix on every issue.
          content: `<role>
You are a principal engineer at a top-tier security-focused engineering
org performing pre-merge code review. The PR author is waiting; your job
is to ship a review they can act on Monday morning.
</role>

<step_by_step>
(1) Read the entire diff before commenting on any single hunk — review
    context, not snippets.
(2) Identify the SINGLE most consequential issue. Lead with it.
(3) For each issue, cite the file:line, classify it (correctness /
    security / performance / style / refactor), and provide a concrete
    fixed code snippet that compiles.
(4) Identify 1-3 risks the diff introduces that the author may not have
    considered (e.g. callers in other files, hidden state, race).
(5) End with a single "Approve / Request changes / Reject" verdict +
    one-sentence reason.
</step_by_step>

<output_requirements>
- Output MUST be valid JSON parseable by JSON.parse(). No markdown fence.
- Every issue MUST cite "file:line" or "file:lineStart-lineEnd".
- Every issue MUST have a concrete "fix" code snippet — never just
  "consider X".
- Refuse hedging. Don't write "you may want to" — write "do X".
- If the code is genuinely good, say "Approve" decisively. False praise is
  worse than false criticism.
</output_requirements>`,
        },
        {
          role: "user",
          content: `Review this ${language} code.\n\nFOCUS: ${focusPrompts[focus] || focusPrompts.full}${(() => {
            const past = pastContextAsPrompt();
            return past
              ? `\n\nPRIOR REVIEWS on similar code (historical FACTS — surface repeat patterns / author's recurring issues):\n${past}\n`
              : "";
          })()}\n\n\`\`\`${language}\n${code.substring(0, 50000)}\n\`\`\`\n\nOutput JSON:
{
  "overall_grade": "A|B|C|D|F",
  "security_score": 0-100,
  "performance_score": 0-100,
  "maintainability_score": 0-100,
  "issues": [{"severity": "CRITICAL|HIGH|MEDIUM|LOW", "line": "line number or range", "issue": "description", "fix": "code snippet fix"}],
  "positive_patterns": ["things done well"],
  "refactored_code": "the improved version of the code (or 'N/A' if no changes needed)",
  "estimated_tech_debt_hours": 0
}

Output ONLY valid JSON.`,
        },
      ],
      { maxTokens: 4000, temperature: 0.2 },
    );

    let parsed;
    try {
      parsed = JSON.parse(
        review
          .replace(/```json?\n?/g, "")
          .replace(/```/g, "")
          .trim(),
      );
    } catch {
      parsed = { raw: review };
    }

    return {
      success: true,
      agent: "nemoclaw-code-reviewer",
      language,
      focus,
      code_stats: {
        lines: code.split("\n").length,
        characters: code.length,
      },
      review: parsed,
      duration_ms: Date.now() - start,
    };
  },
});
