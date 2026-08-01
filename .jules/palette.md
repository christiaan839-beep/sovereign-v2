
## 2024-08-01 - Keyboard Accessibility for Hover-Revealed Elements
**Learning:** Action buttons inside list items are often hidden behind `opacity-0 group-hover:opacity-100`, rendering them invisible to keyboard users when focused.
**Action:** Always pair `group-hover:opacity-100` with `focus-within:opacity-100` on the parent container, and apply `focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-[#00B7FF]` to the interactive elements inside.
