## 2026-08-20 - Ensure visibility of hover-only actions on keyboard focus
**Learning:** Using `opacity-0 group-hover:opacity-100` completely hides action buttons from keyboard users traversing the UI with tab, making the component inaccessible.
**Action:** Always pair `group-hover:opacity-100` with `focus-within:opacity-100` on the container so that actions become visible when an internal button receives keyboard focus. Also ensure focus rings (`focus-visible:ring-2`) and `focus-visible:outline-none` are applied to the interactive children.
