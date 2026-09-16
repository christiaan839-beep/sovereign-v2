## 2024-05-24 - [Keyboard Accessibility for Hover Actions]
**Learning:** Found that secondary actions hidden behind `group-hover:opacity-100` are completely inaccessible to keyboard users because hover states don't trigger on focus.
**Action:** Always add `focus-within:opacity-100` to the container or `focus-visible:opacity-100` to the focusable element itself when using hover to reveal actions.
