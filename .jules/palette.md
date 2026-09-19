
## 2026-08-26 - Keyboard Accessibility for Hover Actions in ScreenNode
**Learning:** Interactive icon-only buttons hidden behind CSS hover states (`opacity-0 group-hover:opacity-100`) become inaccessible to keyboard users. To make them accessible, the parent container must include `focus-within:opacity-100`. Furthermore, to provide clear visual feedback without showing focus rings on mouse clicks, utility and icon-only buttons require `focus-visible:ring-2`, `focus-visible:outline-none`, and `aria-hidden="true"` on the internal SVG icon element to prevent screen reader clutter.
**Action:** When creating action bars hidden on hover, always add `focus-within` to the parent container and `focus-visible` utility classes to the buttons to ensure clear focus indication for keyboard users.

## 2024-05-24 - Accessibility on hover elements
**Learning:** Found an accessibility issue where interactive elements hidden behind `opacity-0 group-hover:opacity-100` are invisible to keyboard users who tab through the interface, and this pattern is widely used for actions on list items (like notifications).
**Action:** Always add `focus-within:opacity-100` (or similar) to ensure keyboard navigation reveals actions hidden via hover.
