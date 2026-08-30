## 2024-08-30 - Keyboard Accessibility for Hover Actions
**Learning:** Elements hidden with `opacity-0 group-hover:opacity-100` are completely inaccessible to keyboard users because they remain visually hidden when focused.
**Action:** Always add `focus-within:opacity-100` to the container and explicitly set `focus-visible:ring-2 focus-visible:outline-none` on the interactive children to ensure they become visible and clearly indicate focus when navigated via keyboard.
