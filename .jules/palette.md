## 2024-08-06 - Hidden Action Buttons Accessibility
**Learning:** When using `opacity-0 group-hover:opacity-100` to hide action buttons on list items, they become completely invisible to keyboard users who tab into them.
**Action:** Always add `focus-within:opacity-100` to the container and explicit `focus-visible:ring-2` to the buttons to ensure the focus state is visually apparent.
