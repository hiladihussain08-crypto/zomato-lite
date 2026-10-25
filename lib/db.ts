import { neon } from "@neondatabase/serverless";

// The single kitchen door. Every API endpoint imports this same sql object.
// The connection string comes from .env.local - never written inside code,
// so the password can be swapped (local vs production) without touching logic.
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing - .env.local was not loaded by the dev server");
}

export const sql = neon(process.env.DATABASE_URL);

// Long-distance calls occasionally drop - "fetch failed" is a network-level miss,
// not a logic error. Retrying once or twice usually lands. The retry lives here,
// at the one shared door, so both endpoints get it without knowing or caring.
export async function q(query: string, params?: unknown[]): Promise<Record<string, unknown>[]> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const rows = (await sql.query(query, params)) as Record<string, unknown>[];
      return rows;
    } catch (error) {
      const transient =
        error instanceof Error && error.message.includes("fetch failed");
      if (!transient || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  return [];
}
