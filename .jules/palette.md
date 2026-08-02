## 2024-08-02 - Keyboard Navigation for Hover Actions
**Learning:** Interactive elements hidden behind `opacity-0 group-hover:opacity-100` are inaccessible via keyboard navigation. They require `focus-within:opacity-100` on the container, and explicit `focus-visible` utility classes on the interactive elements to provide clear visual focus.
**Action:** Always add `focus-within:opacity-100` to hover-action containers and apply `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color]` to all icon-only or utility buttons.
