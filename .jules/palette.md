
## 2026-08-14 - Canvas Component Icon Buttons Accessibility
**Learning:** Multiple icon-only buttons across the canvas components (ScreenNode, AgentPanel, FlowExport, NoteNode, VoiceCanvas, VibeBar) were missing descriptive `aria-label`s, preventing screen readers from accurately conveying their purpose. Additionally, the interior `svg` or `lucide-react` icons lacked `aria-hidden="true"`, causing potential redundancy or confusion for screen reader users.
**Action:** Always verify that interactive elements lacking visible text have explicitly defined `aria-label`s and that internal decorative or illustrative icons have `aria-hidden="true"` to maintain a clean accessibility tree.
