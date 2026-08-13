## 2024-05-24 - Accessibility for hover-revealed action buttons
**Learning:** For elements hidden via group-hover (`opacity-0 group-hover:opacity-100`), they remain inaccessible to keyboard users because focusing on them does not reveal them.
**Action:** Always add `focus-within:opacity-100` to the parent container when using hover-revealed states for interactive elements. Additionally, ensure the child elements have clear `focus-visible` styles (`focus-visible:outline-none focus-visible:ring-2`).
