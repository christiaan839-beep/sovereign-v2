## 2025-01-01 - Fix DoS in timingSafeEqual string comparison
**Vulnerability:** Comparing `.length` on strings before `timingSafeEqual` allows a Denial-of-Service if strings have matching character length but differing byte lengths due to multi-byte UTF-8 characters, as `timingSafeEqual` will throw an unhandled `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH`.
**Learning:** Always verify byte length on Buffers AFTER converting from strings rather than checking string lengths, as UTF-8 chars can take >1 byte.
**Prevention:** The byte length check must always be performed on the final Buffer objects just prior to `crypto.timingSafeEqual()`.
