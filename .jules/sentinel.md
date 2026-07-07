## 2024-10-25 - Fix DoS via timingSafeEqual length mismatch
**Vulnerability:** Checking `a.length !== b.length` on strings before converting them to buffers for `crypto.timingSafeEqual` allows multi-byte UTF-8 characters to bypass the length check but fail the buffer length check, causing an unhandled exception (DoS) via `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH`.
**Learning:** Always verify buffers are of equal byte length *after* converting strings to buffers (`bufA.length === bufB.length`). String lengths and Buffer lengths are not guaranteed to match for multi-byte characters.
**Prevention:** Convert inputs to buffers before doing any length checks and before passing them to `timingSafeEqual`.
