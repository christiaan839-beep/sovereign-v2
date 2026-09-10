## 2025-03-01 - Unsafe constant-time string comparisons
**Vulnerability:** Manual constant-time string comparisons (using `charCodeAt`) check string length before converting to buffers, allowing a DoS via unhandled `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` exceptions if used directly with `timingSafeEqual`, and may not correctly compare multi-byte characters.
**Learning:** Checking string length is insufficient for `timingSafeEqual` because multi-byte UTF-8 characters or invalid hex characters can result in buffers of different byte lengths, causing Node.js to throw an error.
**Prevention:** Always verify buffers are of equal byte length after converting strings to buffers (`bufA.length === bufB.length`) when using `crypto.timingSafeEqual`.
