/**
 * SOVEREIGN MATRIX — Webhook trigger registry (Cook 47 / Tier 2 #9)
 *
 * Inbound automation: agents respond to Stripe events, Slack messages,
 * GitHub PRs, HubSpot deals, etc. Each trigger is a typed mapping
 * from `(source, eventType)` to an agent slug, with optional payload
 * shaping and conditional dispatch.
 *
 * Three contracts:
 *
 *   1. TYPED SOURCES — every registered trigger declares its source
 *      (stripe, slack, github, hubspot, generic) so a route that
 *      receives `(source, payload)` dispatches deterministically.
 *
 *   2. SIGNATURE VERIFICATION HOOK — each source supplies its own
 *      `verify(raw, headers, secret)` function. The registry runs
 *      verification BEFORE any agent fires. No signature, no fire.
 *
 *   3. CONDITIONAL DISPATCH — every trigger has a `condition`
 *      predicate that gates the agent run. The lead-blitz agent only
 *      fires on `event.type === "checkout.session.completed"` AND
 *      `amount > 100_000`, not every Stripe ping.
 *
 * Pure module. Caller wires the agent runner + signature verifiers.
 */

// ── Public types ──────────────────────────────────────────────────────────

export type TriggerSource =
  | "stripe"
  | "slack"
  | "github"
  | "hubspot"
  | "generic";

export interface TriggerDefinition<TPayload = unknown> {
  id: string;
  source: TriggerSource;
  /** The event type this trigger fires on (e.g. "checkout.session.completed"). */
  eventType: string;
  /** Agent slug to dispatch when the condition is met. */
  agent: string;
  /**
   * Optional gate. Return true to fire, false to skip. Defaults to
   * always-fire when omitted.
   */
  condition?: (payload: TPayload) => boolean;
  /**
   * Optional shaper that maps the raw webhook payload into the
   * agent's expected input. Identity if omitted.
   */
  buildInput?: (payload: TPayload) => unknown;
}

export type SignatureVerifier = (
  rawBody: string,
  headers: Record<string, string>,
  secret: string,
) => boolean;

export interface DispatchOutcome {
  trigger: string;
  agent: string;
  /**
   * - "fired": the agent runner was invoked.
   * - "skipped": condition gate returned false.
   * - "unknown-event": no trigger matched the (source, eventType) pair.
   * - "invalid-signature": verifier rejected the request.
   * - "error": the agent runner threw.
   */
  outcome:
    | "fired"
    | "skipped"
    | "unknown-event"
    | "invalid-signature"
    | "error";
  message?: string;
  result?: unknown;
}

export type AgentDispatcher = (
  agent: string,
  input: unknown,
) => Promise<unknown>;

// ── Registry ──────────────────────────────────────────────────────────────

export class TriggerRegistry {
  private readonly triggers = new Map<string, TriggerDefinition>();
  private readonly verifiers = new Map<TriggerSource, SignatureVerifier>();

  register<T>(def: TriggerDefinition<T>): this {
    if (this.triggers.has(def.id)) {
      throw new Error(`Trigger '${def.id}' already registered`);
    }
    this.triggers.set(def.id, def as TriggerDefinition);
    return this;
  }

  setVerifier(source: TriggerSource, verify: SignatureVerifier): this {
    this.verifiers.set(source, verify);
    return this;
  }

  list(): TriggerDefinition[] {
    return [...this.triggers.values()];
  }

  /**
   * Run every trigger that matches (source, eventType). Verifies the
   * signature ONCE per request; runs each matching trigger through
   * its condition gate; dispatches survivors via the runner.
   */
  async dispatch(
    args: {
      source: TriggerSource;
      eventType: string;
      payload: unknown;
      rawBody: string;
      headers: Record<string, string>;
      secret?: string;
    },
    runner: AgentDispatcher,
  ): Promise<DispatchOutcome[]> {
    // ── Signature gate ──
    const verifier = this.verifiers.get(args.source);
    if (verifier) {
      if (!args.secret) {
        return [
          {
            trigger: "",
            agent: "",
            outcome: "invalid-signature",
            message: `Missing secret for source '${args.source}'`,
          },
        ];
      }
      if (!verifier(args.rawBody, args.headers, args.secret)) {
        return [
          {
            trigger: "",
            agent: "",
            outcome: "invalid-signature",
            message: `Signature verification failed for '${args.source}'`,
          },
        ];
      }
    }

    const matches = [...this.triggers.values()].filter(
      (t) => t.source === args.source && t.eventType === args.eventType,
    );
    if (matches.length === 0) {
      return [
        {
          trigger: "",
          agent: "",
          outcome: "unknown-event",
          message: `No trigger for ${args.source}/${args.eventType}`,
        },
      ];
    }

    const outcomes: DispatchOutcome[] = [];
    for (const t of matches) {
      const gate =
        t.condition === undefined ? true : Boolean(t.condition(args.payload));
      if (!gate) {
        outcomes.push({
          trigger: t.id,
          agent: t.agent,
          outcome: "skipped",
          message: "condition gate returned false",
        });
        continue;
      }
      const input = t.buildInput ? t.buildInput(args.payload) : args.payload;
      try {
        const result = await runner(t.agent, input);
        outcomes.push({
          trigger: t.id,
          agent: t.agent,
          outcome: "fired",
          result,
        });
      } catch (err) {
        outcomes.push({
          trigger: t.id,
          agent: t.agent,
          outcome: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return outcomes;
  }
}
