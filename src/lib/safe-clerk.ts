"use client";

import { useUser as useClerkUser, useAuth as useClerkAuth } from "@clerk/nextjs";

/**
 * Safe Clerk hooks that return fallback values when ClerkProvider isn't mounted.
 * Used in dashboard pages where Clerk may not be available (sandbox/offline).
 */

export function useSafeUser() {
  try {
    return useClerkUser();
  } catch {
    return { user: null, isLoaded: true, isSignedIn: false } as ReturnType<typeof useClerkUser>;
  }
}

export function useSafeAuth() {
  try {
    return useClerkAuth();
  } catch {
    return { userId: null, isLoaded: true, isSignedIn: false } as unknown as ReturnType<typeof useClerkAuth>;
  }
}
