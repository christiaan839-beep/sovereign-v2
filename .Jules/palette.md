## 2024-05-18 - Keyboard Accessibility for Hidden Hover Elements
**Learning:** Elements hidden with \`opacity-0 group-hover:opacity-100\` are invisible to keyboard users who tab through interactive elements.
**Action:** Always add \`focus-within:opacity-100\` to the container or \`focus-visible:opacity-100\` along with explicit \`focus-visible:ring-2\` focus states to ensure interactive elements appear and are clearly focused when navigated to via keyboard. Add \`aria-hidden="true"\` to inner SVGs for icon-only buttons.
