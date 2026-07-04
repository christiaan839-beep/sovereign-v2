## 2025-01-01 - timingSafeEqual with UTF-8 Buffer Length Mismatch
 **Vulnerability:** Unsafe string comparison on secrets using '!==' instead of 'timingSafeEqual', leading to timing side-channel attacks.
 **Learning:** When fixing with 'timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"))', checking 'a.length !== b.length' based on string length is insufficient because it checks string characters, not byte size. If string length matches but byte length does not, 'timingSafeEqual' crashes since it demands identically sized buffers.
 **Prevention:** Always calculate the 'Buffer.from' of both values first, then check their byte lengths before passing them into 'timingSafeEqual'.
