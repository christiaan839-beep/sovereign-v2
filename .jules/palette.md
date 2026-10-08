
## 2026-08-26 - Keyboard Accessibility for Hover Actions in ScreenNode
**Learning:** Interactive icon-only buttons hidden behind CSS hover states (`opacity-0 group-hover:opacity-100`) become inaccessible to keyboard users. To make them accessible, the parent container must include `focus-within:opacity-100`. Furthermore, to provide clear visual feedback without showing focus rings on mouse clicks, utility and icon-only buttons require `focus-visible:ring-2`, `focus-visible:outline-none`, and `aria-hidden="true"` on the internal SVG icon element to prevent screen reader clutter.
**Action:** When creating action bars hidden on hover, always add `focus-within` to the parent container and `focus-visible` utility classes to the buttons to ensure clear focus indication for keyboard users.
## 2026-08-26 - NoteNode Keyboard Focus Transparency Issue
**Learning:** For floating components that use `opacity-0` with `group-hover:opacity-100` to hide action buttons, using `focus-within:opacity-100` on the container ensures the buttons become visible during keyboard navigation. Additionally, `focus-visible:opacity-100` directly on the button ensures it stays visible when focused.
**Action:** When implementing hover-only action elements, always include `focus-within` on the parent container and `focus-visible` on the element itself to prevent invisible focused states for keyboard users.
