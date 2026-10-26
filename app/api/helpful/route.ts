import { NextResponse } from "next/server";
import { q } from "@/lib/db";

// POST = "one visitor marks one review helpful (or takes that mark back)."
// One address, one job. The voter key is an anonymous random id the browser
// keeps in localStorage - no accounts. The database's primary key on
// (review_id, voter_key) makes double-votes impossible no matter what a
// client sends; toggling off is just another fact about the same pair.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  // Cheapest checks first: pure types, no database in sight.
  const reviewId = body?.reviewId;
  if (typeof reviewId !== "number" || !Number.isInteger(reviewId) || reviewId <= 0) {
    return NextResponse.json(
      { error: "reviewId must be a whole number" },
      { status: 400 }
    );
  }
  const voterKey = typeof body?.voterKey === "string" ? body.voterKey.trim() : "";
  if (voterKey.length < 8 || voterKey.length > 80) {
    return NextResponse.json(
      { error: "voterKey must be 8-80 characters" },
      { status: 400 }
    );
  }
  const on = body?.on === undefined ? true : body?.on === true;
  if (typeof body?.on !== "undefined" && typeof body?.on !== "boolean") {
    return NextResponse.json({ error: "on must be true or false" }, { status: 400 });
  }

  // Then the one database check: the review must exist.
  const reviewExists = await q("SELECT 1 FROM reviews WHERE id = $1", [reviewId]);
  if (reviewExists.length === 0) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  // Write the fact (or remove it). DO NOTHING makes repeats harmless; the
  // response always reports the review's CURRENT truth, computed fresh.
  if (on) {
    await q(
      `INSERT INTO helpful_votes (review_id, voter_key)
       VALUES ($1, $2)
       ON CONFLICT (review_id, voter_key) DO NOTHING`,
      [reviewId, voterKey]
    );
  } else {
    await q(
      "DELETE FROM helpful_votes WHERE review_id = $1 AND voter_key = $2",
      [reviewId, voterKey]
    );
  }

  const current = (
    await q(
      `SELECT
         EXISTS(SELECT 1 FROM helpful_votes WHERE review_id = $1 AND voter_key = $2) AS active,
         (SELECT count(*)::int FROM helpful_votes WHERE review_id = $1) AS count`,
      [reviewId, voterKey]
    )
  )[0];

  return NextResponse.json({
    success: true,
    active: current.active === true,
    count: Number(current.count),
  });
}
