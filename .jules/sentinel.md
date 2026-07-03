## 2025-05-20 - Constant-Time Webhook Signature Verification
**Vulnerability:** Timing side-channel attack during webhook signature verification due to simple string comparison.
**Learning:** Webhook receiver endpoints for payment processors were comparing HMAC signatures and hashes using standard string equality (`===`). This leaks information about the expected hash byte-by-byte via timing differences, allowing an attacker to forge signatures over time.
**Prevention:** Always use constant-time equality functions (`crypto.timingSafeEqual()`) when comparing secrets, hashes, or signatures. Always convert hex strings to Buffers and check length equality before passing to `crypto.timingSafeEqual()` to avoid errors.
