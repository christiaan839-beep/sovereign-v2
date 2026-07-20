## 2025-03-01 - Replace bitwise string comparison with crypto.timingSafeEqual
**Vulnerability:** Manual constant-time string comparison loops using bitwise operations on `charCodeAt` are vulnerable to multi-byte UTF-8 character length mismatches and potential timing attacks due to JIT optimizations.
**Learning:** Always use `crypto.timingSafeEqual` with proper buffer length checks after converting strings to `Buffer`. Comparing string lengths before converting to Buffer can lead to `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` DoS vulnerabilities when multi-byte strings are used.
**Prevention:** Use native `crypto.timingSafeEqual` and strictly enforce `bufA.length === bufB.length` check prior to the call.
