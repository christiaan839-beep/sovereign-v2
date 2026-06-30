## 2024-10-24 - [Keyboard Accessibility for Hover Actions]
**Learning:** When using `opacity-0 group-hover:opacity-100` for hover actions, always pair it with `focus-within:opacity-100` on the container so the actions become visible to keyboard users navigating with Tab.
**Action:** Use `focus-within:opacity-100` along with `focus-visible` rings on interactive child elements to ensure keyboard accessibility.
