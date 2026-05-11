// STATUS: ahead-of-consumers — see docs/audits/codebase-audit.md (Tier B).
// Pinecone client wrapper; vector-memory.ts is the only consumer path.
import { Pinecone } from "@pinecone-database/pinecone";

const pineconeKey = process.env.PINECONE_API_KEY || "";
const pineconeIndex = process.env.PINECONE_INDEX || "umbra";

// Only initialize if we have a key, prevents crashing in local dev without keys
export const pc = pineconeKey ? new Pinecone({ apiKey: pineconeKey }) : null;
export const index = pc ? pc.index(pineconeIndex) : null;

/**
 * Helper to check if Pinecone is globally configured.
 * If not, our memory modules gracefully fall back to in-memory arrays.
 */
export const isPineconeReady = () => !!index;
