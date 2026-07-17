## 2024-07-17 - Keyboard Accessibility for Hover-State Actions
**Learning:** Interactive elements hidden behind `opacity-0 group-hover:opacity-100` become completely inaccessible to keyboard users because they cannot hover, and without explicit focus visibility, they don't know the element is focused.
**Action:** Always add `focus-within:opacity-100` to the hover container, and explicit `focus-visible:ring-2` styles to the interactive elements inside to ensure keyboard accessibility.
