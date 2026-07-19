## 2024-07-19 - Ensure Keyboard Focus for Hover-Hidden Actions
**Learning:** Interactive elements hidden behind `opacity-0 group-hover:opacity-100` are entirely inaccessible to keyboard users unless explicitly managed. Simply adding `focus-visible` rings to the hidden elements is insufficient.
**Action:** Always add `focus-within:opacity-100` to the parent container hiding the elements to ensure they become visible when a keyboard user tabs into them, alongside appropriate `focus-visible:ring-*` classes on the interactive elements themselves.
