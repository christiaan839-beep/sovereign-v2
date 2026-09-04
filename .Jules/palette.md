## 2025-02-28 - Interactive Canvas Node Accessibility
**Learning:** Actions on canvas nodes (like delete, copy, expand) hidden behind `opacity-0 group-hover:opacity-100` become completely inaccessible to keyboard users unless explicitly handled.
**Action:** Always pair `group-hover:opacity-100` on containers with `focus-within:opacity-100`. Apply `focus-visible:ring-2 focus-visible:outline-none` and appropriate `aria-label`s to the hidden interactive elements. Add `aria-hidden="true"` to icon SVGs to reduce screen reader noise.
