## 2024-09-05 - Keyboard Accessible Hover Actions
**Learning:** Elements hidden with `opacity-0 group-hover:opacity-100` become completely inaccessible to keyboard users unless explicitly managed. This pattern is common for inline actions like notification dismiss buttons.
**Action:** Always add `focus-within:opacity-100` to the hover container, and explicit `focus-visible:ring-2` to the interactive elements inside it to ensure keyboard navigation reveals and highlights the actions.
