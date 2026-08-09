
## 2025-02-18 - Ensure keyboard accessibility for hover-dependent elements
**Learning:** Elements hidden with `opacity-0 group-hover:opacity-100` are inaccessible to keyboard users because they cannot be hovered, and when tabbed into, they remain invisible.
**Action:** When hiding interactive elements behind hover states, always add `focus-within:opacity-100` to the parent container so they become visible when a child element receives keyboard focus. Also explicitly add `focus-visible:ring-2 focus-visible:outline-none` for clear focus indication on the buttons.
