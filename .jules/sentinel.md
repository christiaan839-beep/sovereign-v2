## 2025-02-15 - Fix `timingSafeEqual` length mismatch crash
**Vulnerability:** Denial of Service (DoS) vulnerability via `crypto.timingSafeEqual` length mismatch exception. `timingSafeStringEqual` compared string length before converting to buffers, enabling multi-byte character payloads to bypass the check and crash the application when buffers of different byte lengths were compared.
**Learning:** `timingSafeEqual` strictly requires buffers of identical byte length. String length (character count) is not a safe proxy for byte length in UTF-8 encoding.
**Prevention:** Always compare buffer byte lengths (`bufA.length === bufB.length`) *after* converting strings to buffers and *before* calling `crypto.timingSafeEqual`.
