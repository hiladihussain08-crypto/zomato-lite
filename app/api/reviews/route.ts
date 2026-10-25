import { NextResponse } from "next/server";
import { q } from "@/lib/db";

// POST = "here, take this." One address, one job: save one review.
//
// Why validate here at all? Because the frontend is just one polite visitor.
// Anyone with a terminal can send {"rating": 500} straight at this address.
// Checks run cheapest-first: pure number/string tests before database lookups.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  // Check 1: rating must be a whole number from 1 to 5.
  const rating = body?.rating;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "Rating must be a whole number from 1 to 5" },
      { status: 400 }
    );
  }

  // Check 2: comment must still have something to say once whitespace is gone.
  const comment = typeof body?.comment === "string" ? body.comment.trim() : "";
  if (!comment) {
    return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
  }

  // Check 3 (touches the database, so it goes last): does this restaurant exist?
  const restaurantId = body?.restaurantId;
  if (typeof restaurantId !== "number" || !Number.isInteger(restaurantId)) {
    return NextResponse.json(
      { error: "restaurantId must be a whole number" },
      { status: 400 }
    );
  }
  const exists = await q("SELECT 1 FROM restaurants WHERE id = $1", [restaurantId]);
  if (exists.length === 0) {
    return NextResponse.json({ error: "This restaurant does not exist" }, { status: 400 });
  }

  // Every check passed. Write exactly one row of fact. Nothing else changes.
  // $1/$2/$3 are placeholders: values travel separately from SQL text,
  // so a stray apostrophe or a hostile string can never become code.
  const inserted = await q(
    "INSERT INTO reviews (restaurant_id, rating, comment) VALUES ($1, $2, $3) RETURNING id",
    [restaurantId, rating, comment]
  );

  return NextResponse.json(
    { success: true, reviewId: inserted[0].id },
    { status: 201 }
  );
}
