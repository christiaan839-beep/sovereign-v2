/**
 * PayFast ITN (Instant Transaction Notification) entry point.
 *
 * PayFast can be configured to call either /itn or /webhook — this handler
 * delegates entirely to the verified webhook implementation so there is a
 * single code path with IP validation + MD5 signature verification.
 *
 * DO NOT add business logic here. All processing lives in ../webhook/route.ts
 * which enforces PayFast IP ranges and signature verification before acting.
 */
export { POST } from "../webhook/route";
