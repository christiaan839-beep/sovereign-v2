
## 2024-05-30 - Fix DoS vulnerability in internal secret comparison
**Vulnerability:** Checking string length before calling `crypto.timingSafeEqual` with `Buffer.from(..., "utf8")` is insufficient because string length can equal buffer byte length while multi-byte strings cause a buffer length mismatch. `crypto.timingSafeEqual` will throw an unhandled `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` error if buffer lengths don't match, causing a Denial of Service (DoS) when attackers send multi-byte strings.
**Learning:** Always verify buffers are of equal byte length *after* converting strings to buffers, not before.
**Prevention:** Use `bufA.length === bufB.length` check after creating the buffers, before passing them to `timingSafeEqual`.
