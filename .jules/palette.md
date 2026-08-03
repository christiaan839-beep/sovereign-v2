
## 2024-05-30 - Fix keyboard accessibility of group-hover hidden elements
**Learning:** Interactive elements hidden behind a hover state using `opacity-0 group-hover:opacity-100` are technically focusable by keyboard, but remain invisible to sighted keyboard users unless the parent container is focused.
**Action:** When creating hover-revealed action menus, explicitly add `focus-within:opacity-100` to the container and explicit `focus-visible:ring` styles to the interactive elements themselves to ensure clear visibility for keyboard navigation.
