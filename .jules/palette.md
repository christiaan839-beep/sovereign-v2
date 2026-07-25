## 2024-11-20 - Keyboard Accessibility for Hover States
**Learning:** Interactive elements hidden behind `opacity-0 group-hover:opacity-100` are inaccessible to keyboard users because they cannot hover to reveal them, and focus styles are hidden.
**Action:** Always add `focus-within:opacity-100` to the parent container hiding the elements, and ensure the interactive elements themselves have clear `focus-visible:ring-2 focus-visible:outline-none` styles to guide the keyboard user. For single elements, `focus-visible:opacity-100` can be used directly on the button.
