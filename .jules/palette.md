
## 2026-08-26 - Keyboard Accessibility for Hover Actions in ScreenNode
**Learning:** Interactive icon-only buttons hidden behind CSS hover states (`opacity-0 group-hover:opacity-100`) become inaccessible to keyboard users. To make them accessible, the parent container must include `focus-within:opacity-100`. Furthermore, to provide clear visual feedback without showing focus rings on mouse clicks, utility and icon-only buttons require `focus-visible:ring-2`, `focus-visible:outline-none`, and `aria-hidden="true"` on the internal SVG icon element to prevent screen reader clutter.
**Action:** When creating action bars hidden on hover, always add `focus-within` to the parent container and `focus-visible` utility classes to the buttons to ensure clear focus indication for keyboard users.
