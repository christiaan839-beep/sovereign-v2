
## 2024-05-18 - Hover Actions Keyboard Accessibility
**Learning:** Elements hidden with `opacity-0 group-hover:opacity-100` are completely inaccessible to keyboard users because they can receive focus but remain invisible.
**Action:** Always add `focus-within:opacity-100` to the parent container alongside `group-hover:opacity-100`, and ensure interactive elements inside have explicit `focus-visible` utility classes (e.g., `focus-visible:ring-2`) to show clear focus indication.
