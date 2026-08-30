## $(date +%Y-%m-%d) - Adding ARIA labels to icon buttons

**Learning:** Missing `aria-label` attributes on icon-only buttons (like close buttons or UI actions) make them inaccessible to screen readers, causing a confusing experience where users hear just "button" without knowing its function.
**Action:** Always add descriptive `aria-label`s to any interactive element that relies purely on an icon for visual context (e.g., `<button aria-label="Close toast"> <X /> </button>`). Add `aria-hidden="true"` to the inner SVG itself so screen readers skip the raw icon markup. Also ensure focus visibility with classes like `focus-visible:ring-2` to support keyboard navigation.
