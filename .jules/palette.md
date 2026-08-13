## $(date +%Y-%m-%d) - Adding ARIA labels to canvas controls
**Learning:** Icon-only buttons used in inline canvas toolbars (like the VibeBar) often rely entirely on visual cues (icons) and are easily overlooked for accessibility.
**Action:** Always ensure icon-only buttons receive an `aria-label`, have their SVG explicitly marked with `aria-hidden="true"` to prevent screen reader noise, and are given distinct keyboard focus styles (e.g., `focus-visible:ring-2` with the primary brand color) to clearly indicate their interactive state.
