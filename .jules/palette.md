
## 2025-07-22 - Keyboard Accessible Hover Actions
**Learning:** Elements hidden behind hover states (e.g., using `opacity-0 group-hover:opacity-100`) cannot be seen by keyboard users unless explicitly handled.
**Action:** Always add `focus-within:opacity-100` to the parent container when building hover-reveal actions, and explicitly apply `focus-visible` utility classes (e.g., `focus-visible:ring-2 focus-visible:outline-none`) to the interactive elements inside.
