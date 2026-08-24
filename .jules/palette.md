## 2024-05-13 - Focus Styles on Icon Buttons
**Learning:** Found an icon-only close button on the toast and in the error boundary missing a focus indicator.
**Action:** Adding explicit keyboard focus (`focus-visible:ring-2 focus-visible:outline-none`) and aria labels to make icon-only utility buttons fully accessible for keyboard users.
