## 2024-06-12 - Explicit Keyboard Focus States
**Learning:** Native utility buttons and custom UI components often lack explicit focus indicators in dark-mode themes, severely hindering keyboard accessibility.
**Action:** Always append explicit `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color]` utilities directly to interactive elements, matching the ring color to the brand/accent color.
