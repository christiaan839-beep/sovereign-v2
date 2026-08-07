## 2024-07-18 - Keyboard Accessibility for Hover-Hidden Actions
**Learning:** Hiding action buttons with `opacity-0 group-hover:opacity-100` makes them inaccessible to keyboard users because they cannot be seen when focused.
**Action:** Always add `focus-within:opacity-100` to the parent container so it becomes visible when a child element receives focus. Also, ensure interactive children have explicit `focus-visible` outlines or rings.
