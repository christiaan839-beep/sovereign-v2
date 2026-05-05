import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api-guard";

/**
 * Reusable auth guard for API routes.
 * Returns the user email if authenticated, or a 401 response if not.
 *
 * Includes per-user rate limiting (60 req/min) by default. Opt out with
 * `requireAuth({ rateLimit: false })` for endpoints with higher throughput
 * needs (e.g., streaming, batched background jobs).
 *
 * Usage:
 *   const auth = await requireAuth();
 *   if (auth.error) return auth.error;
 *   const email = auth.email;
 */
export async function requireAuth(
  opts: { rateLimit?: boolean } = {},
): Promise<
  | { email: string; userId: string; error?: never }
  | { error: NextResponse; email?: never; userId?: never }
> {
  const { rateLimit = true } = opts;
  try {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!user || !email) {
      return {
        error: NextResponse.json(
          { error: "Unauthorized. Please sign in." },
          { status: 401 },
        ),
      };
    }

    if (rateLimit) {
      const check = await checkRateLimit(user.id);
      if (!check.allowed) {
        return {
          error: NextResponse.json(
            {
              error: "Rate limit exceeded",
              code: "RATE_LIMITED",
              resetIn: check.resetIn,
            },
            {
              status: 429,
              headers: {
                "Retry-After": String(Math.ceil(check.resetIn / 1000)),
              },
            },
          ),
        };
      }
    }

    return { email, userId: user.id };
  } catch {
    return {
      error: NextResponse.json(
        { error: "Authentication failed." },
        { status: 401 },
      ),
    };
  }
}
