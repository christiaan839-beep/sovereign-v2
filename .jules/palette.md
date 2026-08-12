## 2024-05-30 - Keyboard Accessibility for Hover-Hidden Actions
**Learning:** Actions hidden behind `opacity-0 group-hover:opacity-100` are completely inaccessible to keyboard users unless they also receive a `focus-within:opacity-100` class on the container, combined with proper `focus-visible` states on the buttons themselves.
**Action:** Always combine `group-hover:opacity-100` with `focus-within:opacity-100` when the container holds interactive elements, and ensure each interactive child has clear `focus-visible` focus indication.
