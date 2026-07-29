## 2026-07-29 - [Accessible Toolbar Components]
**Learning:** Interactive toolbar components (like VibeBar and VoiceCanvas) often miss critical accessibility state attributes (`aria-expanded`, `aria-pressed`) and keyboard focus indicators (`focus-visible:ring-2`) for their custom icon-only buttons.
**Action:** Always verify that custom icon-only buttons include both `aria-label` and relevant state attributes, and explicitly add `focus-visible` utility classes for clear keyboard focus indication.
