## 2024-05-30 - Fix Unhandled Exception in timingSafeStringEqual
**Vulnerability:** Checking string length rather than buffer byte length before calling `crypto.timingSafeEqual` with UTF-8 encoding allows attackers to trigger unhandled `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` exceptions via multi-byte characters, leading to Denial of Service (DoS).
**Learning:** In JavaScript, strings containing non-ASCII characters have lengths that don't directly match the byte length of their UTF-8 buffer counterparts. Length equality must be checked *after* buffer conversion.
**Prevention:** Always verify buffers are of equal byte length after converting strings to buffers (`bufA.length === bufB.length`) before calling `crypto.timingSafeEqual`.
