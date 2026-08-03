# Palette's Journal
## 2024-11-20 - Toast Accessibility Enhancements
**Learning:** Screen readers won't automatically announce custom toast notifications without explicit role and aria-live attributes. Also, dynamically rendered close buttons in toasts need focus-visible rings for keyboard users.
**Action:** Apply `role="alert"` (for errors) or `role="status"` and correct `aria-live` regions. Always add `focus-visible:ring-2` to close buttons.
