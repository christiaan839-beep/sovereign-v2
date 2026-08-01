## 2025-02-12 - Accessibility on hover elements
**Learning:** Elements hidden by opacity-0 group-hover:opacity-100 are completely inaccessible via keyboard navigation because focus alone won't trigger the group-hover state.
**Action:** Always add focus-within:opacity-100 to the container so hidden actions reveal when children receive keyboard focus, and ensure the interactive children have focus-visible styling (like focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-[#00B7FF]). Additionally, ensure aria-hidden="true" is set on inner SVGs of icon-only buttons.
