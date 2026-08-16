## 2024-05-13 - [Focus States on Icon Buttons]
**Learning:** Icon-only buttons often lack focus visible styles causing poor keyboard navigation accessibility. Hover state styles alone are not enough.
**Action:** Always add `focus-visible:ring-2 focus-visible:outline-none` and a proper border radius to icon-only buttons. Ensure an `aria-label` is present.
