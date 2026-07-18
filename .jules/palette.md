## 2024-05-24 - Explicit Focus States Pattern
**Learning:** Many utility buttons (like icon-only buttons in Toasts and secondary action buttons) are missing explicit focus states for keyboard navigation.
**Action:** Always add `focus-visible:ring-2 focus-visible:outline-none` with appropriate focus color (matching the border/hover brand color) and `rounded-md` to ensure keyboard accessibility while preventing unwanted focus rings on mouse click. Added aria-labels to icon-only close buttons.
