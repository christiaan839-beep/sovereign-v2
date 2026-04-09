/**
 * /api/projects — Re-exports /api/clients handlers.
 * Both endpoints reference the same clientProjects table.
 */
export { GET, POST } from "@/app/api/clients/route";
