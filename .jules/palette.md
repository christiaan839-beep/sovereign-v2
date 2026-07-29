## 2024-07-29 - Improve keyboard accessibility for hover-revealed action bars
**Learning:** When hiding toolbars or action buttons behind hover states (e.g., `opacity-0 group-hover:opacity-100`), they become inaccessible to keyboard users unless explicitly handled.
**Action:** Always add `focus-within:opacity-100` to the parent container that controls the opacity, and ensure the interactive elements inside have explicit `focus-visible` styles like `focus-visible:ring-2` to clearly indicate focus and make them visible during keyboard navigation.
