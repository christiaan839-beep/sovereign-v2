## 2026-09-02 - Keyboard Accessibility for Hover Actions
**Learning:** When using opacity-based hover reveals (`opacity-0 group-hover:opacity-100`), keyboard users cannot see the hidden interactive elements when tabbing through them.
**Action:** Always combine `group-hover:opacity-100` with `group-focus-within:opacity-100` on the parent container of the hidden actions, and ensure the children elements themselves have explicit `focus-visible` utility classes to show an outline when focused.
