## 2024-05-24 - Focus visibility on hover-hidden interactive elements
**Learning:** In complex interactive components like canvas nodes, relying solely on `opacity-0 group-hover:opacity-100` hides elements completely from keyboard users who tab through the interface.
**Action:** Always pair `group-hover:opacity-100` with `focus-within:opacity-100` on the parent container, and add explicit `focus-visible:opacity-100` along with explicit focus rings (`focus-visible:ring-2`) to the interactive children.
