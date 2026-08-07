## 2024-07-12 - Keyboard Accessibility for Hover-Revealed Actions
**Learning:** Elements hidden with `opacity-0 group-hover:opacity-100` are completely inaccessible to keyboard users because they can't see where focus is, and standard tab navigation is invisible.
**Action:** Always add `focus-within:opacity-100` to the parent container, and add `focus-visible` outlines (e.g., `focus-visible:ring-1 focus-visible:ring-[color]`) to the interactive children. Also ensure icon-only buttons have an `aria-label`.
