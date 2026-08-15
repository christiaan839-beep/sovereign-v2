
## 2026-08-15 - Accessible hidden interactive elements
**Learning:** Elements hidden behind hover states (e.g. `opacity-0 group-hover:opacity-100`) become inaccessible to keyboard users unless explicitly handled.
**Action:** When hiding interactive controls behind hover states, explicitly add `focus-within:opacity-100` to the parent container (or the element itself) and provide `focus-visible` utility classes (like `focus-visible:ring-2 focus-visible:outline-none`) and `aria-label` to ensure they are discoverable and navigable via keyboard.
