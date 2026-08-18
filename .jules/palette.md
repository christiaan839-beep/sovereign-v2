## 2026-08-18 - Keyboard Accessibility for Hover-only Actions
**Learning:** Actions hidden behind `opacity-0 group-hover:opacity-100` are invisible to keyboard users and fail accessibility standards.
**Action:** Always add `focus-within:opacity-100` to the parent container of hover-revealed actions (or `focus-visible:opacity-100` for standalone elements), and ensure interactive elements have explicit `focus-visible` outline utilities and `aria-label`s.
