## 2024-05-19 - Improved Export Buttons Accessibility
**Learning:** Found that secondary utility buttons like "Copy" or "Download" often lack proper ARIA labels and focus states compared to primary buttons, making them hard to use for keyboard navigators and screen readers.
**Action:** Always verify that utility buttons have explicit `aria-label` attributes and keyboard focus indicators (`focus-visible:ring-2 focus-visible:outline-none`) when auditing UI components.

## 2024-05-19 - Ensure Focus Visibility and ARIA Labels on Secondary Buttons
**Learning:** Secondary or utility buttons often lack explicit ARIA labels and focus visible styles (`focus-visible:ring-2 focus-visible:outline-none`). This makes them difficult to use for screen readers and keyboard users.
**Action:** When implementing secondary buttons, always explicitly add focus outlines (e.g. `focus-visible:ring-2 focus-visible:ring-[#00B7FF] focus-visible:outline-none`) and `aria-label` attributes to ensure they are accessible.
