## 2024-05-15 - ARIA Roles for Animated Toasts
**Learning:** Animated toast notifications implemented with Framer Motion `AnimatePresence` are invisible to screen readers without `role="status"` and `aria-live="polite"`. The dismiss buttons within them also often lack keyboard focus states due to custom styling.
**Action:** When implementing auto-dismissing notifications, always ensure the container has semantic aria-live roles and any interactive elements within have explicit `focus-visible` utility classes and `aria-label`s.
