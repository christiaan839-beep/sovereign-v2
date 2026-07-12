## 2024-05-30 - Fix Unhandled Exception (DoS) via ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH
**Vulnerability:** Checking string lengths instead of byte buffer lengths prior to calling `crypto.timingSafeEqual` allowed attackers to send multi-byte UTF-8 character strings of the same character length but different byte length, triggering an unhandled exception and crashing the process.
**Learning:** `string.length` counts characters, but `Buffer.from(string).length` counts bytes. `crypto.timingSafeEqual` requires exactly equal byte lengths to avoid throwing an exception.
**Prevention:** Always verify buffers are of equal byte length *after* converting strings to buffers (`bufA.length === bufB.length`) before calling `crypto.timingSafeEqual`.
