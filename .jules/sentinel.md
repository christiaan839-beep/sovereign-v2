## 2024-07-09 - Fix DoS in timingSafeEqual length check
**Vulnerability:** Comparing string lengths before calling `timingSafeEqual` with UTF-8 buffers allows an attacker to send a string with multi-byte characters that matches the character length but has a different byte length. This causes `timingSafeEqual` to throw `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH`, resulting in an unhandled exception (DoS).
**Learning:** `timingSafeEqual` strictly requires buffers of the exact same byte length. String length (character count) is not equivalent to byte length for UTF-8 encoded strings.
**Prevention:** Always convert strings to buffers first, then compare the `.length` of the resulting buffers before passing them to `timingSafeEqual`.
