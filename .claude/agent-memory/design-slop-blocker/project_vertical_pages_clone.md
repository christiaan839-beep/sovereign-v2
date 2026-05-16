---
name: Vertical pages are template-cloned
description: src/app/for-*/page.tsx files are within 14 lines of each other and structurally identical — same nav, hero shape, PRIMITIVES grid, USE_CASES list, COMPLIANCE checklist, final CTA. Only the accent color (violet/cyan/amber) and the noun-list change.
type: project
---

The "regulated vertical" landing pages (for-insurance, for-pharma, for-banking, for-defense, for-csrd, for-clinical-trials, etc.) all derive from the same template — 269-284 lines each, diff-able with mostly noun substitutions.

**Why:** Each vertical has a 5-7-figure ACV ($150K-$2M ACV per the v3 receipt) but the pages don't reflect that buyer value. They read as templated SEO pages, not as bespoke surfaces for a regulated-buyer due-diligence motion.

**How to apply:** When asked about vertical pages, flag template-clone slop. Each Tier-1 vertical (insurance, pharma, banking, defense, CSRD, clinical trials, tax audit, pharmacovigilance) deserves: (1) one bespoke hero stat that only that vertical would care about, (2) a vertical-specific visual artifact (sample receipt JSON, regulator quote, decision tree, audit timeline), (3) a competitor-displacement line naming the actual incumbent the buyer is leaving (Moody's, ServiceNow GRC, Veeva Vault, etc.), and (4) named pilot customer or stage-of-readiness signal. Don't propose "just change the color" — the template itself is the slop.
