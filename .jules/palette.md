## 2024-07-26 - Keyboard Accessible Hover Actions
**Learning:** Hover-only elements (e.g. `opacity-0 group-hover:opacity-100`) hide interactive elements from keyboard users. The parent container must have `focus-within:opacity-100` and interactive elements inside need explicit `focus-visible` styles.
**Action:** Always add `focus-within:opacity-100` to `opacity-0 group-hover:opacity-100` containers, and explicitly add `focus-visible:ring-2 focus-visible:outline-none` to buttons inside to ensure they are visible when tabbed to.
