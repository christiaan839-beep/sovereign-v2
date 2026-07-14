## 2024-05-24 - Missing ARIA label on Toast close button
**Learning:** Toast close buttons are frequently missed for accessibility because they are dynamically generated and typically consist of only an "X" icon. Without an aria-label, screen readers might just read "button", leaving users confused about the action.
**Action:** Always check dynamically generated overlay components (like Toasts, Modals) to ensure icon-only buttons have descriptive `aria-label`s. Added `aria-label="Close toast"` to the X button in `ToastProvider`.
