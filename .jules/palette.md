## 2024-09-17 - Keyboard Accessibility for Hover-Hidden Actions
**Learning:** Actions hidden behind hover states (like a delete button on a node) need explicit focus management for keyboard users.
**Action:** Always add `focus-within:opacity-100` to the parent or `focus-visible:opacity-100` to the button to ensure it appears when tabbed to. And ensure the button itself has `focus-visible:ring-2 focus-visible:outline-none`.
