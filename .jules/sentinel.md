## 2024-07-17 - Fix timingSafeEqual DoS via Buffer Length Mismatch
**Vulnerability:** Use of string `.length` property before converting strings to buffers for `crypto.timingSafeEqual`. Characters like "€" have a string length of 1 but a UTF-8 byte length of 3, leading to unequal buffer lengths which throws an unhandled exception (DoS) in `timingSafeEqual`.
**Learning:** JavaScript string length does not correspond 1-to-1 with byte length, making string length checks insufficient before byte-level cryptographic comparisons.
**Prevention:** When comparing cryptographic secrets with `crypto.timingSafeEqual`, always verify buffers are of equal byte length *after* converting strings to buffers (`bufA.length === bufB.length`).
