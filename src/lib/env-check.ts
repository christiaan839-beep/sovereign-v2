/**
 * Startup Environment Validation
 * Validates critical environment variables required for the platform to function.
 * Called automatically by root layout or middleware.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("env-check");

export function validateEnvironment() {
  if (typeof window !== "undefined") return; // Only run on server

  const criticalVars = [
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "NVIDIA_NIM_API_KEY"
  ];

  const missingCritical = criticalVars.filter(key => !process.env[key]);

  if (missingCritical.length > 0) {
    log.error("CRITICAL: Missing required environment variables:");
    missingCritical.forEach(key => log.error(`  - ${key}`));
    log.error("Platform operations will fail. Please configure these variables immediately.");
  }

  const optionalVars = [
    "RESEND_API_KEY",
    "STRIPE_SECRET_KEY",
    "PAYFAST_MERCHANT_ID",
    "TELEGRAM_BOT_TOKEN"
  ];

  const missingOptional = optionalVars.filter(key => !process.env[key]);
  
  if (missingOptional.length > 0) {
    log.warn("Some optimal features are degraded due to missing optional variables:");
    missingOptional.forEach(key => log.warn(`  - ${key}`));
    log.warn("Provide these keys to unlock full platform capabilities.");
  }
}
