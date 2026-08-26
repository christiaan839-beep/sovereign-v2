
## 2024-05-24 - Interactive Elements in Hover States
**Learning:** Interactive elements hidden behind `group-hover:opacity-100` are invisible to keyboard users when focused unless `focus-within:opacity-100` is applied to the container. Furthermore, these elements need explicit `focus-visible` styling (e.g. `focus-visible:ring-2`) to show clear focus indication.
**Action:** Always pair `group-hover:opacity-100` with `focus-within:opacity-100` on containers of interactive elements and ensure all buttons have clear `focus-visible` outlines. Add `aria-hidden="true"` to icon-only SVG elements inside interactive containers.
