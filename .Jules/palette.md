## 2025-05-15 - ARIA Labels and Focus Within Visibility
**Learning:** When hiding action buttons with `opacity-0 group-hover:opacity-100` on containers, they become invisible to keyboard users. Adding `focus-within:opacity-100` is a clean, reusable pattern to ensure keyboard focus makes the actions visible without needing custom CSS.
**Action:** Use `focus-within:opacity-100` alongside hover classes on containers for interactive elements.
