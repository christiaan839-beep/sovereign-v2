## 2024-07-16 - [TimingSafeEqual DoS Vulnerability]
**Vulnerability:** Unhandled exceptions (`ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH`) thrown by `crypto.timingSafeEqual` leading to DoS.
**Learning:** Checking string `.length` before converting to buffers is insufficient because multi-byte UTF-8 characters or invalid hex strings can result in buffers of different lengths.
**Prevention:** Always verify `bufA.length === bufB.length` *after* calling `Buffer.from()` and before passing to `timingSafeEqual`.
