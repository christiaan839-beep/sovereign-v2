## 2026-08-24 - Focus Visible Missing on Common Reusable Buttons
**Learning:** Reusable utility components (like toast dismissals and export action groups) frequently omit keyboard focus rings, relying solely on hover states, rendering them inaccessible to keyboard users.
**Action:** Always verify focus-visible states and aria-hidden="true" on inner icons for frequently imported interactive utility components across the codebase.
