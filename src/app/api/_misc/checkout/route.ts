import { NextResponse } from 'next/server';
import { createLogger } from "@/lib/logger";
const log = createLogger("paystack-api");

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

export async function POST(req: Request) {
    try {
        const { email, lead_id } = await req.json();

        if (!PAYSTACK_SECRET_KEY) {
            log.error("Missing PAYSTACK_SECRET_KEY");
            return NextResponse.json({ error: "Paystack API Offline" }, { status: 500 });
        }

        // $5k USD retainer is functionally ~R90,000 ZAR. Amount is set in cents (9000000).
        const zarAmountCents = 9000000; 

        const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email || 'commander-lead@example.com',
                amount: zarAmountCents,
                currency: 'ZAR',
                callback_url: 'https://sovereign-matrix.com/dashboard/onboarding',
                metadata: {
                    custom_fields: [
                        {
                            display_name: "Product",
                            variable_name: "product_name",
                            value: "Sovereign Matrix Elite Node License (Phase 1 Retainer)"
                        }
                    ]
                }
            })
        });

        const paystackData = await paystackResponse.json();

        if (!paystackResponse.ok || !paystackData.status) {
            log.error("Paystack API error", paystackData as Record<string, unknown>);
            return NextResponse.json({ error: paystackData.message }, { status: paystackResponse.status || 500 });
        }

        // Return the secure Paystack checkout URL directly to the Closer Agent or N8N Webhook
        return NextResponse.json({ 
            status: 'checkout_generated', 
            checkout_url: paystackData.data.authorization_url,
            reference: paystackData.data.reference
        });

    } catch (error) {
        log.error("Paystack fatal error", error as Record<string, unknown>);
        return NextResponse.json({ error: 'Internal Exec Error' }, { status: 500 });
    }
}
