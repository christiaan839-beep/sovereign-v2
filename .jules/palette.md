## 2024-03-24 - Add Accessibility to Toast Close Button
**Learning:** Found that toast notifications (ToastProvider.tsx) had a close button without an aria-label, making it inaccessible to screen readers, and lacking focus indicators for keyboard navigation.
**Action:** Added `aria-label="Close notification"`, `aria-hidden="true"` to the inner X icon, and `rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B7FF] focus-visible:ring-offset-2 focus-visible:ring-offset-black` for keyboard navigation to the button.
