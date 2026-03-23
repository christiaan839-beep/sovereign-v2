import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Required for Edge Environments (Vercel)
// During Vercel's static build phase, env vars may be undefined.
// We use a build-phase placeholder that will never be called at runtime.
const connectionString = process.env.DATABASE_URL;

if (!connectionString && typeof window === "undefined" && process.env.NODE_ENV === "production") {
  console.error("[SOVEREIGN] DATABASE_URL is not configured. Database operations will fail.");
}

const sql = neon(connectionString || "postgresql://build:placeholder@localhost/build");
export const db = drizzle(sql, { schema });
