import { NextResponse } from "next/server";

export async function GET() {
  const criticalVars = [
    { key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", required: true },
    { key: "CLERK_SECRET_KEY", required: true },
    { key: "NVIDIA_NIM_API_KEY", required: true }
  ];

  const optionalVars = [
    { key: "RESEND_API_KEY", feature: "Transactional Emails" },
    { key: "STRIPE_SECRET_KEY", feature: "Payments" },
    { key: "PAYFAST_MERCHANT_ID", feature: "PayFast Checkout" },
    { key: "TELEGRAM_BOT_TOKEN", feature: "Telegram Notifications" }
  ];

  const status = {
    critical: criticalVars.map(v => ({ key: v.key, configured: !!process.env[v.key] })),
    optional: optionalVars.map(v => ({ key: v.key, feature: v.feature, configured: !!process.env[v.key] })),
    timestamp: new Date().toISOString(),
    isReady: criticalVars.every(v => !!process.env[v.key])
  };

  return NextResponse.json(status);
}
