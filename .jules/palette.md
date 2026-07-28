## 2024-07-28 - Focus Styles on Hover-Only Elements
**Learning:** Elements hidden with `opacity-0` and only shown on hover (`group-hover:opacity-100`) are completely inaccessible to keyboard navigation because they never become visible when tabbed to.
**Action:** Always pair `group-hover:opacity-100` with `focus-within:opacity-100` on the parent container, and ensure interactive children have explicit `focus-visible` styles so they are revealed and highlighted during keyboard navigation.
