/**
 * Yoco Webhook — Direct route (no underscore prefix).
 *
 * This exists because Next.js treats _payments/ as a route group
 * (invisible to the router). This direct route at /api/webhooks/yoco
 * is what you configure in Yoco's dashboard.
 *
 * Webhook URL for Yoco dashboard:
 * https://sovereignmatrix.agency/api/webhooks/yoco
 */
export { POST } from "@/app/api/_payments/yoco/webhook/route";
