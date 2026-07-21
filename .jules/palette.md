## 2024-05-24 - Interactive Elements Hidden Behind Hover
**Learning:** Elements hidden with `opacity-0 group-hover:opacity-100` are completely inaccessible to keyboard users tabbing through the UI, as hover is not triggered.
**Action:** Always pair `group-hover:opacity-100` with `focus-within:opacity-100` on the parent container, and add explicit `focus-visible:ring-2` to the interactive elements themselves.
