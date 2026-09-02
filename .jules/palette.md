## 2026-09-02 - Focus visibility for hidden action buttons
**Learning:** When using `opacity-0 group-hover:opacity-100` to hide action buttons in UI nodes (like Canvas Screen nodes) visually, they become invisible and inaccessible to keyboard navigation because they receive focus while staying hidden (`opacity-0`).
**Action:** Always add `focus-within:opacity-100` to the parent container when using hover-based visibility, and ensure internal buttons explicitly use `focus-visible` styles with `aria-label` attributes to maintain accessibility without cluttering the visual UI.
