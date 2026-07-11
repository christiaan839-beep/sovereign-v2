## 2024-05-24 - [Fix DoS in timingSafeEqual string comparison]
 **Vulnerability:** Unhandled exception (DoS) due to `crypto.timingSafeEqual` length mismatch. String length checks (`a.length !== b.length`) before converting to UTF-8 buffers are insufficient because multi-byte characters have different byte lengths than string lengths.
 **Learning:** Always compare buffer `.length` *after* string-to-buffer conversion, not string `.length` before. `crypto.timingSafeEqual` will throw `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` if buffer lengths differ, which can be triggered maliciously to crash the Node process.
 **Prevention:** Assign `Buffer.from(string, "utf8")` to variables, check their lengths, and only then call `timingSafeEqual`.
