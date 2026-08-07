## 2026-07-23 - Hover Action Focus Indicators
**Learning:** When using `opacity-0 group-hover:opacity-100` to reveal actions on hover, keyboard users cannot see the focus outline unless the wrapper also includes `focus-within:opacity-100`. Furthermore, utility buttons inside must have explicit `focus-visible:ring-2`.
**Action:** Always pair `group-hover:opacity-100` with `focus-within:opacity-100` on the container and ensure clear explicit `focus-visible:ring-2` on the interactive elements inside.
