## 2024-05-18 - Replacing Manual Constant-Time String Comparisons with crypto.timingSafeEqual
**Vulnerability:** Manual loops using charCodeAt for constant-time comparison are prone to implementation errors and bypasses compared to native crypto functions.
**Learning:** crypto.timingSafeEqual is the standard, but it requires buffers of the exact same byte length to avoid throwing RangeError. Converting strings to buffers before checking length is vital for UTF-8 compatibility.
**Prevention:** Always use node:crypto's timingSafeEqual with length checks performed *after* Buffer conversion instead of implementing custom XOR loops.
