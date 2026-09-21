
## 2026-08-26 - Keyboard Accessibility for Hover Actions in ScreenNode
**Learning:** Interactive icon-only buttons hidden behind CSS hover states (`opacity-0 group-hover:opacity-100`) become inaccessible to keyboard users. To make them accessible, the parent container must include `focus-within:opacity-100`. Furthermore, to provide clear visual feedback without showing focus rings on mouse clicks, utility and icon-only buttons require `focus-visible:ring-2`, `focus-visible:outline-none`, and `aria-hidden="true"` on the internal SVG icon element to prevent screen reader clutter.
**Action:** When creating action bars hidden on hover, always add `focus-within` to the parent container and `focus-visible` utility classes to the buttons to ensure clear focus indication for keyboard users.
## 2024-05-15 - Focus Within Opacity

**Learning:** When using `opacity-0 group-hover:opacity-100` on a container for action buttons, keyboard users cannot see the buttons when they tab to them because they remain hidden. Adding `focus-within:opacity-100` to the container makes the buttons visible when any button inside the container receives focus.
**Action:** Always include `focus-within:opacity-100` alongside `group-hover:opacity-100` when the container holds interactive elements to ensure keyboard accessibility.
