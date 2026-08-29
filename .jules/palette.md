## 2024-10-27 - Keyboard accessibility for hover-hidden elements
**Learning:** Elements hidden with `opacity-0 group-hover:opacity-100` are technically focusable by keyboard, but they remain invisible to keyboard-only users.
**Action:** When hiding interactive elements on hover, always add `focus-within:opacity-100` to their parent container, or `focus-visible:opacity-100` to the elements themselves, along with clear focus indicators like `focus-visible:ring-2`.
