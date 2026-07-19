## 2026-07-19 - Fix Denial of Service in timingSafeEqual
**Vulnerability:** DoS risk via unhandled exceptions (ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH) when comparing multi-byte UTF-8 strings. Checking string length before conversion is insufficient because strings with the same character length can have different byte lengths (e.g. emoji vs ascii).
**Learning:** crypto.timingSafeEqual strictly requires buffers of equal byte length. Always verify buffer length *after* converting strings to buffers, never before.
**Prevention:** Use `bufA.length === bufB.length` on the generated buffers instead of `a.length === b.length` on the strings.
