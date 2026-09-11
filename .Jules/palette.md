## 2024-03-24 - Missing Focus Outlines on Core Button Component
**Learning:** The core Button component (`src/components/ui/Button.tsx`) lacks explicit focus states for keyboard navigation, making the entire application difficult to navigate for keyboard-only users.
**Action:** When designing or refactoring reusable UI components, always include `focus-visible` styles to ensure global keyboard accessibility.
