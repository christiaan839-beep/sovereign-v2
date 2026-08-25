## 2024-08-25 - Fix keyboard focus for hover-hidden elements
**Learning:** Elements hidden with `opacity-0 group-hover:opacity-100` are invisible to keyboard users. Simply making them focusable is not enough, as they remain visually hidden when tabbed into.
**Action:** Always add `focus-within:opacity-100` to the container so it becomes visible when a child receives focus. Furthermore, apply `focus-visible:ring-2 focus-visible:outline-none` with appropriate focus colors to the interactive children.
