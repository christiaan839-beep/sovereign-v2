/**
 * Direct route for AI streaming — re-exports from _misc/ai/stream.
 * Needed because Vercel's require() can't resolve deeply nested _misc paths.
 */
export { POST } from "@/app/api/_misc/ai/stream/route";
