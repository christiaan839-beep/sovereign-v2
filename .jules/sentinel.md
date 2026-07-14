
## 2025-01-20 - Fix DoS vector in crypto.timingSafeEqual length check
**Vulnerability:** `timingSafeStringEqual` compared string lengths instead of buffer byte lengths before calling `crypto.timingSafeEqual`. This allows an attacker to cause an unhandled `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` exception (leading to DoS) by providing a string with the same character length but a different byte length (e.g., using multi-byte UTF-8 characters).
**Learning:** When comparing strings with `crypto.timingSafeEqual`, checking string length before converting to buffers is insufficient for multi-byte UTF-8 characters. The byte length must be checked *after* conversion.
**Prevention:** Always convert strings to buffers first, and then compare their lengths (`bufA.length === bufB.length`) before calling `crypto.timingSafeEqual`.
