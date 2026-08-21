## 2026-08-21 - Added Focus Indicators to API Keys Page
**Learning:** Found that secondary action buttons in data tables (like 'Copy', 'Dismiss', 'Revoke' for API keys) were lacking `focus-visible` styles, making keyboard navigation difficult.
**Action:** Always ensure `focus-visible:ring-2 focus-visible:outline-none` and an appropriate brand color (e.g. `focus-visible:ring-[#00B7FF]` or `focus-visible:ring-rose-500` for destructive actions) are applied to utility buttons alongside their standard hover states.
