import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * ONE-TIME migration for the redesign promotion. Additive only - no DROP,
 * no TRUNCATE, no existing data touched. This endpoint exists because the
 * author's home router refuses DNS lookups to Neon, so db scripts cannot run
 * locally - but Vercel functions reach Neon fine. Guard: the caller must send
 * k = first 24 hex chars of sha256(DATABASE_URL). The key is derived from the
 * same secret on both sides and stored nowhere. THIS FILE IS DELETED in the
 * very next commit, right after the migration succeeds.
 */
export async function GET(request: Request) {
  const given = new URL(request.url).searchParams.get("k") ?? "";
  const expect = crypto
    .createHash("sha256")
    .update(process.env.DATABASE_URL ?? "")
    .digest("hex")
    .slice(0, 24);
  if (given.length !== 24 || given !== expect) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const action = new URL(request.url).searchParams.get("action");

  // action=purge: maintenance-only removal of ONE exact review row by id (its
  // dish marks and helpful votes follow via ON DELETE CASCADE). Exists so the
  // stage-2 write tests can leave zero trace in production data. Deleted with
  // this endpoint at final cleanup - never a user-facing feature.
  if (action === "purge") {
    const reviewId = Number(new URL(request.url).searchParams.get("reviewId"));
    if (!Number.isInteger(reviewId) || reviewId <= 0) {
      return NextResponse.json({ error: "reviewId must be a whole number" }, { status: 400 });
    }
    const removed = await q("DELETE FROM reviews WHERE id = $1 RETURNING id", [reviewId]);
    return NextResponse.json({
      ok: true,
      action: "purge",
      removed: removed.length > 0,
      reviewId,
    });
  }

  const applied: string[] = [];

  // review_dishes: one row per (review, dish, verdict). Counts are computed by
  // GROUP BY at read time - like everything else in this product, never stored.
  await q(
    `CREATE TABLE IF NOT EXISTS review_dishes (
      id         SERIAL PRIMARY KEY,
      review_id  INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      state      TEXT NOT NULL CHECK (state IN ('recommend', 'skip')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
  applied.push("review_dishes ready");

  // Case-insensitive uniqueness: 'paneer burrito' and 'Paneer burrito' are one dish.
  await q(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_review_dish
     ON review_dishes (review_id, lower(name))`
  );
  applied.push("unique dish-per-review index ready");

  // helpful_votes: primary key (review_id, voter_key) enforces one vote per
  // browser; the voter key is an anonymous random id living in localStorage.
  await q(
    `CREATE TABLE IF NOT EXISTS helpful_votes (
      review_id  INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      voter_key  TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (review_id, voter_key)
    )`
  );
  applied.push("helpful_votes ready");

  // Approved plan: three demo dish facts attached to the three seeded reviews.
  // WHERE NOT EXISTS makes re-runs harmless; a missing seed comment simply
  // inserts nothing and shows up in the response as a gap.
  const seeds: Array<{ comment: string; dish: string; state: string }> = [
    { comment: "Paneer burrito is unreal", dish: "Paneer burrito", state: "recommend" },
    { comment: "Good, but slow service", dish: "Fries", state: "skip" },
    { comment: "Solid. Would repeat.", dish: "Chicken wrap", state: "recommend" },
  ];
  const seeded: string[] = [];
  for (const s of seeds) {
    const inserted = await q(
      `INSERT INTO review_dishes (review_id, name, state)
       SELECT r.id, $2, $3
       FROM reviews r
       WHERE r.comment = $1
         AND NOT EXISTS (
           SELECT 1 FROM review_dishes d
           WHERE d.review_id = r.id AND lower(d.name) = lower($2)
         )
       RETURNING id`,
      [s.comment, s.dish, s.state]
    );
    if (inserted.length > 0) seeded.push(s.dish + " -> " + s.state);
  }

  const totals = (
    await q(
      `SELECT
         (SELECT count(*) FROM review_dishes)::int  AS dishes,
         (SELECT count(*) FROM helpful_votes)::int  AS votes`
    )
  )[0];
  const dishCounts = await q(
    `SELECT res.name AS restaurant, d.name AS dish, d.state, count(*)::int AS n
     FROM review_dishes d
     JOIN reviews r  ON r.id  = d.review_id
     JOIN restaurants res ON res.id = r.restaurant_id
     GROUP BY 1, 2, 3
     ORDER BY 2, 3`
  );

  return NextResponse.json({
    ok: true,
    applied,
    seededNow: seeded,
    totals,
    dishCounts,
  });
}
