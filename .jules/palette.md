## 2024-07-23 - Add ARIA Labels and Keyboard Focus to Notification Center/Bell

**Learning:** Notification centers and interactive icon-only buttons often lack clear keyboard accessibility styles and screen reader context in this application's components.
**Action:** When implementing icon-only buttons and interactive lists (like dropdowns and notification lists), always ensure explicit `focus-visible` styles are set (e.g., `focus-visible:ring-2 focus-visible:outline-none`) and add ARIA labels. For notification items that have interactive action buttons hidden by `opacity-0 group-hover:opacity-100`, explicitly apply `focus-within:opacity-100` to the parent container to ensure keyboard navigability.
