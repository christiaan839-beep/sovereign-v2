
## 2026-08-26 - Keyboard Accessibility for Hover Actions in ScreenNode
**Learning:** Interactive icon-only buttons hidden behind CSS hover states (`opacity-0 group-hover:opacity-100`) become inaccessible to keyboard users. To make them accessible, the parent container must include `focus-within:opacity-100`. Furthermore, to provide clear visual feedback without showing focus rings on mouse clicks, utility and icon-only buttons require `focus-visible:ring-2`, `focus-visible:outline-none`, and `aria-hidden="true"` on the internal SVG icon element to prevent screen reader clutter.
**Action:** When creating action bars hidden on hover, always add `focus-within` to the parent container and `focus-visible` utility classes to the buttons to ensure clear focus indication for keyboard users.
## 2024-05-23 - Accessible Async Buttons
**Learning:** Screen readers require explicit `aria-busy` attributes on buttons to understand async loading states. Additionally, custom focus rings in dark mode must include `focus-visible:ring-offset-2 focus-visible:ring-offset-black` to maintain contrast and visibility against dark backgrounds, alongside `focus:outline-none` to prevent native browser outline clashing.
**Action:** Always include `aria-busy={loading ? true : undefined}` for async buttons and explicit ring offsets for dark mode components.
