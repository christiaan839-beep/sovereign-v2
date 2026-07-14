## 2024-05-24 - Interactive Elements Hidden Behind Hover
**Learning:** Keyboard users cannot access elements hidden with only `opacity-0 group-hover:opacity-100` because focus cannot trigger hover states. Focus visibility is essential for interactive child elements within a hidden container.
**Action:** Always add `focus-within:opacity-100` to the parent container when hiding interactive child elements, and apply specific `focus-visible:ring` styles to the elements themselves.
