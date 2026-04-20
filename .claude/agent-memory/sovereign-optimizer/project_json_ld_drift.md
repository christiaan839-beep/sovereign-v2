---
name: JSON-LD structured data drifts from marketing pricing
description: layout.tsx JSON-LD SoftwareApplication/Offer still lists Starter/Array/Node tiers v11 archived from marketing surfaces
type: project
---

src/app/layout.tsx renders JSON-LD SoftwareApplication with 5 Offers (Free, Starter $19, Array $49, Node $199, Enterprise $499). Session v11 archived Starter/Node from marketing-visible plans (`marketing: true` in src/lib/plans.ts is only Free/Growth/Enterprise). FAQ JSON-LD also answers "how much does it cost" with the full 5-tier list. Google/Bing see 5 tiers; the pricing page shows 3. Also references "Sovereign Array" which was renamed to "Growth" in earlier sessions.

**Why:** JSON-LD was hardcoded inline in layout.tsx before the pricing curation. Never refactored to pull from `getMarketingPlans()`.

**How to apply:** Either (a) import `getMarketingPlans()` at the top of layout.tsx and generate Offers dynamically, or (b) bite the bullet and hand-update the Offers + FAQ answer to match the 3 marketing tiers. Keeping this aligned matters for rich-snippet accuracy and for the "/pricing page says one thing, the AI overview says another" problem when people ask ChatGPT about pricing.
