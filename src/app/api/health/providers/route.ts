// Public re-export so the route resolves at /api/health/providers
// on Vercel (without needing the _health prefix). Pattern matches
// /api/health/permanence and /api/health/ping.
export { GET } from "@/app/api/_health/providers/route";
