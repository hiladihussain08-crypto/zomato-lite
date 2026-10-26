// npm run db:setup
// Wipes any previous zomato-lite tables, rebuilds them from db/schema.sql,
// seeds facts from db/seed.sql, then prints the rows it created.
// Rerunning it is always safe: think of it as wiping the whiteboard and writing afresh.
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is missing - node must be run with --env-file=.env.local");
  process.exit(1);
}

// The one connection the whole app will ever need. neon() = SQL over HTTPS.
const sql = neon(DATABASE_URL);

function statements(file) {
  return readFileSync(new URL(`../db/${file}`, import.meta.url), "utf8")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Reset, rebuild, reseed. Order matters: every foreign key must lose its
// dependents first, so the dishes/votes tables go before reviews, and reviews
// before restaurants - Postgres refuses to drop a table that is being pointed at.
await sql.query("DROP TABLE IF EXISTS helpful_votes");
await sql.query("DROP TABLE IF EXISTS review_dishes");
await sql.query("DROP TABLE IF EXISTS reviews");
await sql.query("DROP TABLE IF EXISTS restaurants");

for (const statement of statements("schema.sql")) await sql.query(statement);
console.log("schema applied - restaurants + reviews + review_dishes + helpful_votes exist");

for (const statement of statements("seed.sql")) await sql.query(statement);
console.log("seed applied - Ludhiana Burrito + 3 reviews + 3 dish facts");

const restaurants = await sql.query("SELECT id, name, cuisine, area FROM restaurants");
const reviews = await sql.query(
  "SELECT id, restaurant_id, rating, comment, created_at FROM reviews ORDER BY created_at DESC"
);
console.log("");
console.log("Rows now in the database:");
console.table(restaurants);
console.table(
  reviews.map((r) => ({ ...r, created_at: String(r.created_at) }))
);
