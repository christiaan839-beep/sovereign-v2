## 2024-05-24 - [Title] String Length Validation Bypass causing DoS with timingSafeEqual
**Vulnerability:** Checking string length instead of buffer byte length before calling `crypto.timingSafeEqual`.
**Learning:** `crypto.timingSafeEqual` throws `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` if buffers have different lengths. A string length check (e.g. `a.length !== b.length`) can be bypassed using multi-byte UTF-8 characters (like 'ñ', which has a string length of 1 but a byte length of 2). An attacker can use this to crash the process or cause unhandled 500 exceptions.
**Prevention:** Always convert strings to buffers first, then check the byte lengths of the resulting buffers before calling `crypto.timingSafeEqual`.
