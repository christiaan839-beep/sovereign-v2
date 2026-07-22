## 2024-05-24 - DoS risk in timing-safe comparisons
**Vulnerability:** manual constant-time string comparison loops using bitwise XOR on charCodeAt, and using string length check before crypto.timingSafeEqual.
**Learning:** Checking string length before conversion to Buffer is insufficient for multi-byte UTF-8 characters and allows attackers to trigger unhandled exceptions (DoS) via ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH.
**Prevention:** Always verify buffers are of equal byte length *after* converting strings to buffers (`bufA.length === bufB.length`), and use Node.js native `crypto.timingSafeEqual` for cryptographic string comparisons.
