import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("api-wrapper");

/**
 * Global API Wrapper
 * Provides unified error handling, timeout protection, and standardized
 * response formatting for external API calls (especially LLMs).
 */

interface WrapperOptions {
  timeoutMs?: number;
}

export async function withProtection(
  handler: () => Promise<NextResponse | Response>,
  options: WrapperOptions = { timeoutMs: 30000 }
) {
  try {
    // Timeout protection using Promise.race is tricky with standard fetch unless passing AbortSignal,
    // but we can enforce an absolute upper bound on handler execution time.
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Request timed out after ${options.timeoutMs}ms`)), options.timeoutMs);
    });

    const response = await Promise.race([handler(), timeoutPromise]) as Response;
    return response;
  } catch (err: unknown) {
    const error = err as Error;
    log.error("API wrapper error:", { message: error.message, name: error.name });
    
    const isTimeout = error.message?.includes('timed out');
    const status = isTimeout ? 504 : 500;
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "Internal server error",
        code: isTimeout ? "GATEWAY_TIMEOUT" : "INTERNAL_ERROR"
      },
      { status }
    );
  }
}
