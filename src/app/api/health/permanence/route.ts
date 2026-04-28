// Public re-export so the route resolves at /api/health/permanence
// on Vercel (without needing the _health prefix). The _health prefix
// is the project's convention for catch-all-aware grouping.
export { GET } from "@/app/api/_health/permanence/route";
