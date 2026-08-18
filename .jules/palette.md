
## 2026-08-18 - Focus-Within for Hover Actions
**Learning:** When using `opacity-0 group-hover:opacity-100` to hide inline actions, keyboard users cannot see the actions when tabbing into them.
**Action:** Always add `focus-within:opacity-100` to the parent container when building hover-revealed action groups.
