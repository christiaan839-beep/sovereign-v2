## 2025-02-18 - Interactive Elements Hidden Behind Hover
**Learning:** When using `opacity-0 group-hover:opacity-100` to hide interactive elements until hovered, keyboard users cannot see the element when they focus it. This is a common accessibility failure.
**Action:** Always add `focus-within:opacity-100` to the parent container when hiding interactive children, and ensure the children have explicit `focus-visible` styles (e.g., `focus:outline-none focus-visible:ring-1 focus-visible:ring-[color]`) so the focus is clearly visible once revealed.
