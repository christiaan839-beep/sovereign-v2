## 2026-09-01 - Focus states for hover-revealed elements
**Learning:** Interactive elements hidden behind hover states (e.g., using opacity-0 group-hover:opacity-100) are inaccessible to keyboard users unless the parent explicitly adds focus-within:opacity-100 and the interactive elements inside have explicit focus-visible utility classes.
**Action:** Always add focus-within:opacity-100 to the container and focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-[color] to the interactive elements when revealing them via hover states.
