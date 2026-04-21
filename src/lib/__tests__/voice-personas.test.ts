/**
 * voice-personas.ts — tests.
 *
 * Pure-data module. We assert shape + invariants: 6 personas, each with
 * a voice ID and a non-trivial system prompt. getPersona() returns the
 * default for unknown IDs so callers never have to null-check.
 */

import { describe, it, expect } from "vitest";
import { PERSONAS, getPersona, DEFAULT_PERSONA_ID, type PersonaId } from "@/lib/voice-personas";

describe("voice-personas", () => {
  it("exports exactly 6 personas", () => {
    expect(Object.keys(PERSONAS)).toHaveLength(6);
  });

  it("includes the spec-mandated persona IDs", () => {
    const expected: PersonaId[] = [
      "default",
      "architect",
      "closer",
      "therapist",
      "grok_mode",
      "storyteller",
    ];
    for (const id of expected) {
      expect(PERSONAS[id]).toBeTruthy();
    }
  });

  it("every persona has a voice, prompt >= 50 chars, and description", () => {
    for (const [id, p] of Object.entries(PERSONAS)) {
      expect(p.id, `${id}.id`).toBe(id);
      expect(p.name, `${id}.name`).toBeTruthy();
      expect(p.voice, `${id}.voice`).toBeTruthy();
      expect(p.description, `${id}.description`).toBeTruthy();
      expect(p.systemPrompt.length, `${id}.systemPrompt`).toBeGreaterThanOrEqual(50);
    }
  });

  it("personas have distinct voice + speed combinations", () => {
    const signatures = new Set<string>();
    for (const p of Object.values(PERSONAS)) {
      signatures.add(`${p.voice}::${p.speed ?? 1.0}`);
    }
    // Not strictly required to be all-distinct (closer + default share a voice
    // in the spec) but at least 4 distinct signatures.
    expect(signatures.size).toBeGreaterThanOrEqual(4);
  });

  it("getPersona returns the matched persona for known IDs", () => {
    const p = getPersona("architect");
    expect(p.id).toBe("architect");
  });

  it("getPersona returns the default persona for unknown IDs", () => {
    const p = getPersona("no-such-persona" as PersonaId);
    expect(p.id).toBe(DEFAULT_PERSONA_ID);
  });

  it("getPersona returns default when passed null or undefined", () => {
    expect(getPersona(null).id).toBe(DEFAULT_PERSONA_ID);
    expect(getPersona(undefined).id).toBe(DEFAULT_PERSONA_ID);
  });

  it("speed (when present) is within 0.8 and 1.2", () => {
    for (const p of Object.values(PERSONAS)) {
      if (p.speed != null) {
        expect(p.speed).toBeGreaterThanOrEqual(0.8);
        expect(p.speed).toBeLessThanOrEqual(1.2);
      }
    }
  });
});
