## 2024-07-24 - Keyboard Accessible Hover States
**Learning:** Interactive elements hidden behind hover states (e.g., `opacity-0 group-hover:opacity-100`) remain invisible to keyboard users unless explicitly handled.
**Action:** Always add `focus-within:opacity-100` to the parent container to reveal the elements on keyboard focus, and ensure the interactive elements themselves have clear `focus-visible` indicators (e.g., `focus-visible:ring-2`) and `aria-label`s.
