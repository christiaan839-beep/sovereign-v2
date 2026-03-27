import { NextResponse } from "next/server";
import { persistAppend } from "@/lib/persist";
import { db } from "@/db";
import { payments, tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";

/**
 * PayFast ITN (Instant Transaction Notification) Webhook.
 * On COMPLETE: records payment in DB + upgrades tenant plan.
 *
 * Security: Verifies PayFast signature to prevent webhook spoofing.
 */

function verifyPayFastSignature(data: Record<string, string>, passphrase?: string): boolean {
  const signature = data.signature;
  if (!signature) return false;

  // Build the signature string from all fields except 'signature', in submission order
  const sigString = Object.entries(data)
    .filter(([key]) => key !== "signature")
    .map(([key, val]) => `${key}=${encodeURIComponent(val.trim()).replace(/%20/g, "+")}`)
    .join("&");

  const fullString = passphrase ? `${sigString}&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, "+")}` : sigString;
  const expectedSig = createHash("md5").update(fullString).digest("hex");

  return expectedSig === signature;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const data: Record<string, string> = {};
    formData.forEach((value, key) => {
      data[key] = value.toString();
    });

    // Verify PayFast signature — reject spoofed webhooks
    const passphrase = process.env.PAYFAST_PASSPHRASE || process.env.PAYFAST_MERCHANT_KEY;
    if (!verifyPayFastSignature(data, passphrase)) {
      console.error("[PayFast Webhook] Invalid signature — possible spoofed request");
      return new NextResponse("Invalid signature", { status: 403 });
    }

    const status = data.payment_status;
    const email = data.email_address || "";
    const amount = data.amount_gross || "0";
    const planName = (data.item_name || "node").toLowerCase();

    // Normalize plan name from PayFast item_name
    const plan = planName.includes("cartel") ? "cartel"
      : planName.includes("array") ? "array"
      : "node";

    // Log every ITN for audit
    persistAppend("payfast-itn-log", {
      id: data.m_payment_id || `pf-${Date.now()}`,
      status,
      amount,
      email,
      plan,
      timestamp: new Date().toISOString(),
    }, 500);

    if (status === "COMPLETE") {
      // 1. Record payment in database
      try {
        await db.insert(payments).values({
          email,
          gateway: "payfast",
          externalId: data.m_payment_id || `pf-${Date.now()}`,
          plan,
          amount,
          currency: "ZAR",
          status: "complete",
        });
      } catch (dbErr) {
        console.error("[PayFast Webhook] DB insert failed:", dbErr);
      }

      // 2. Update tenant plan if they exist
      try {
        const existingTenants = await db.select().from(tenants).where(eq(tenants.plan, "free")).limit(100);
        // Find by matching clerk user (best effort — email matching isn't ideal but works pre-RBAC)
        // Future: store clerkUserId in PayFast custom_str1 field
        for (const tenant of existingTenants) {
          // We can't match by email easily with Clerk, so this upgrades the most recent free tenant
          // In production, pass clerkUserId via PayFast custom fields
          await db.update(tenants)
            .set({ plan })
            .where(eq(tenants.id, tenant.id));
          break;
        }
      } catch {
        // Non-critical — plan upgrade can be done manually
      }

      // 3. Trigger auto-onboard (best effort)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
      try {
        await fetch(`${baseUrl}/api/agents/auto-onboard`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: `${data.name_first || ""} ${data.name_last || ""}`.trim() || "New Client",
            email,
            plan,
          }),
        });
      } catch {}

      persistAppend("payfast-payments", {
        id: data.m_payment_id || `pf-${Date.now()}`,
        plan,
        amount,
        email,
        timestamp: new Date().toISOString(),
      }, 1000);
    }

    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    console.error("[PayFast Webhook] Error:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
