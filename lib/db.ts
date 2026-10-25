import { neon } from "@neondatabase/serverless";

// The single kitchen door. Every API endpoint imports this same sql object.
// The connection string comes from .env.local - never written inside code,
// so the password can be swapped (local vs production) without touching logic.
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing - .env.local was not loaded by the dev server");
}

export const sql = neon(process.env.DATABASE_URL);
