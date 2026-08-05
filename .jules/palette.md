## 2024-08-05 - Added Missing ARIA Labels to Canvas Interactive Elements
**Learning:** Found that multiple interactive elements like buttons inside `NoteNode`, `ScreenNode`, and `AgentPanel` lacked `aria-label` attributes, impacting accessibility for screen reader users when those components only use icons.
**Action:** Adding explicit `aria-label`s helps ensure the application can be interpreted and spoken clearly for screen reader users for components like delete, maximize, explore more, etc.
