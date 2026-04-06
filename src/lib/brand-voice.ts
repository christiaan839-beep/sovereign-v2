/**
 * SOVEREIGN MATRIX — Brand Voice Extraction & Injection
 *
 * Analyzes example content to extract a reusable brand voice profile,
 * generates system prompt additions, and persists profiles in Pinecone
 * per-org for cross-session recall.
 */

import { ai } from "./ai";
import { embed } from "./ai";
import { getPineconeClient } from "./memory";
import { createLogger } from "@/lib/logger";

const log = createLogger("brand-voice");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrandVoiceProfile {
  tone: string; // e.g., "confident, direct, slightly irreverent"
  vocabulary: string[]; // preferred words/phrases
  avoidWords: string[]; // words to never use
  sentenceStyle: string; // e.g., "short punchy sentences, occasional questions"
  exampleSnippets: string[]; // 3-5 representative sentences
  industry: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BRAND_VOICE_PREFIX = "brand-voice";
const EXTRACTION_SYSTEM = `You are a brand voice analyst. Given sample content, extract the writing DNA — not what the content says, but HOW it says it. Focus on rhythm, word choices, sentence structure, and personality.

You must respond ONLY with valid JSON matching this exact schema:
{
  "tone": "string — 3-5 adjectives describing the voice",
  "vocabulary": ["array of 10-15 signature words or phrases the brand uses"],
  "avoidWords": ["array of 8-12 words that would feel wrong for this brand"],
  "sentenceStyle": "string — describe the sentence patterns",
  "exampleSnippets": ["3-5 representative sentences pulled directly from the samples"],
  "industry": "string — detected industry"
}

No markdown. No explanation. Just the JSON object.`;

// ---------------------------------------------------------------------------
// Extract Voice Profile
// ---------------------------------------------------------------------------

export async function extractBrandVoice(
  examples: string[]
): Promise<BrandVoiceProfile> {
  const combinedExamples = examples
    .map((ex, i) => `--- SAMPLE ${i + 1} ---\n${ex}`)
    .join("\n\n");

  const prompt = `Analyze these writing samples and extract the brand voice profile:\n\n${combinedExamples}`;

  const raw = await ai(prompt, {
    model: "gemini",
    system: EXTRACTION_SYSTEM,
    maxTokens: 1500,
  });

  try {
    // Strip any markdown fencing the model might add anyway
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned) as BrandVoiceProfile;

    // Validate required fields
    if (!parsed.tone || !parsed.vocabulary || !parsed.sentenceStyle) {
      throw new Error("Missing required fields in parsed profile");
    }

    return {
      tone: parsed.tone,
      vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
      avoidWords: Array.isArray(parsed.avoidWords) ? parsed.avoidWords : [],
      sentenceStyle: parsed.sentenceStyle,
      exampleSnippets: Array.isArray(parsed.exampleSnippets)
        ? parsed.exampleSnippets.slice(0, 5)
        : [],
      industry: parsed.industry || "general",
    };
  } catch (err) {
    log.error("Failed to parse brand voice extraction:", err as Record<string, unknown>);
    // Return a sensible fallback rather than crashing
    return {
      tone: "professional, clear",
      vocabulary: [],
      avoidWords: [],
      sentenceStyle: "varied sentence lengths",
      exampleSnippets: [],
      industry: "general",
    };
  }
}

// ---------------------------------------------------------------------------
// Generate System Prompt Addition
// ---------------------------------------------------------------------------

export function getBrandVoicePrompt(profile: BrandVoiceProfile): string {
  const parts: string[] = [
    "--- BRAND VOICE DIRECTIVE ---",
    `Tone: ${profile.tone}`,
    `Sentence style: ${profile.sentenceStyle}`,
    `Industry context: ${profile.industry}`,
  ];

  if (profile.vocabulary.length > 0) {
    parts.push(`Preferred vocabulary: ${profile.vocabulary.join(", ")}`);
  }

  if (profile.avoidWords.length > 0) {
    parts.push(
      `NEVER use these words/phrases: ${profile.avoidWords.join(", ")}`
    );
  }

  if (profile.exampleSnippets.length > 0) {
    parts.push("Reference sentences that capture the voice:");
    for (const snippet of profile.exampleSnippets) {
      parts.push(`  - "${snippet}"`);
    }
  }

  parts.push("--- END BRAND VOICE DIRECTIVE ---");
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Persist to Pinecone (per-org namespace)
// ---------------------------------------------------------------------------

export async function saveBrandVoice(
  orgId: string,
  profile: BrandVoiceProfile
): Promise<void> {
  const pc = await getPineconeClient();
  if (!pc) {
    log.error("Pinecone not configured — brand voice not saved", {});
    return;
  }

  const serialized = JSON.stringify(profile);
  const searchText = `${BRAND_VOICE_PREFIX}:${orgId} — tone: ${profile.tone}, industry: ${profile.industry}`;
  const vector = await embed(searchText);

  const index = pc.client.index(pc.index);
  await index.upsert({
    records: [
      {
        id: `${BRAND_VOICE_PREFIX}-${orgId}`,
        values: vector,
        metadata: {
          type: BRAND_VOICE_PREFIX,
          orgId,
          profile: serialized,
          text: searchText,
          updatedAt: Date.now(),
        },
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Load from Pinecone
// ---------------------------------------------------------------------------

export async function loadBrandVoice(
  orgId: string
): Promise<BrandVoiceProfile | null> {
  const pc = await getPineconeClient();
  if (!pc) return null;

  try {
    const index = pc.client.index(pc.index);

    // Direct ID fetch — much faster than vector similarity
    const result = await index.fetch({ ids: [`${BRAND_VOICE_PREFIX}-${orgId}`] });
    const record = result.records?.[`${BRAND_VOICE_PREFIX}-${orgId}`];

    if (record?.metadata?.profile) {
      return JSON.parse(record.metadata.profile as string) as BrandVoiceProfile;
    }

    return null;
  } catch (err) {
    log.error("Failed to load brand voice:", err as Record<string, unknown>);
    return null;
  }
}
