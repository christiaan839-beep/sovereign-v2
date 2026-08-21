## $(date +%Y-%m-%d) - Hidden Hover Actions Keyboard Navigation
**Learning:** Actions hidden behind `opacity-0 group-hover:opacity-100` are invisible to keyboard users when focused, rendering them inaccessible. Screen readers may also read out decorative SVG content if not properly marked with `aria-hidden="true"`.
**Action:** Always add `focus-within:opacity-100` to hover containers, apply explicit `focus-visible` styles to the interactive elements inside, and ensure inner SVG icons have `aria-hidden="true"`.
