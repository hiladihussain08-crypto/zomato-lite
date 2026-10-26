import { NextResponse } from "next/server";
import { q } from "@/lib/db";

// POST = "here, take this." One address, one job: save one review.
//
// Why validate here at all? Because the frontend is just one polite visitor.
// Anyone with a terminal can send {"rating": 500} straight at this address.
// Checks run cheapest-first: pure number/string tests before database lookups.
//
// Promotion change: comment is now OPTIONAL (stars are the required minimum -
// a review can be a bare rating), and the redesign's dish verdicts travel along.
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

  // Check 2: the text. Optional now - the backend stores "" when the visitor
  // shares only stars. It must still BE text if present.
  const comment = typeof body?.comment === "string" ? body.comment.trim().slice(0, 300) : "";

  // Check 3: dish verdicts. Optional; at most 5; each needs a real (trimmed,
  // short) name and one of the two states; no duplicates inside one submission.
  const rawDishes = body?.dishes;
  const dishes: Array<{ name: string; state: string }> = [];
  if (rawDishes !== undefined) {
    if (!Array.isArray(rawDishes)) {
      return NextResponse.json({ error: "Dishes must be a list" }, { status: 400 });
    }
    if (rawDishes.length > 5) {
      return NextResponse.json({ error: "You can add up to 5 dishes" }, { status: 400 });
    }
    for (const d of rawDishes) {
      const name = typeof d?.name === "string" ? d.name.trim() : "";
      const state = d?.state;
      if (!name || name.length > 60) {
        return NextResponse.json({ error: "Dish name must be 1-60 characters" }, { status: 400 });
      }
      if (state !== "recommend" && state !== "skip") {
        return NextResponse.json({ error: "Dish state must be recommend or skip" }, { status: 400 });
      }
      if (dishes.some((x) => x.name.toLowerCase() === name.toLowerCase())) {
        return NextResponse.json({ error: "Duplicate dish name" }, { status: 400 });
      }
      dishes.push({ name, state });
    }
  }

  // Check 4 (touches the database, so it goes last): does this restaurant exist?
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
  const reviewId = Number(inserted[0].id);

  // Dish rows follow the review. The WHERE NOT EXISTS + case-insensitive check
  // enforces the same one-name-per-review rule the database index defends.
  for (const d of dishes) {
    await q(
      `INSERT INTO review_dishes (review_id, name, state)
       SELECT $1, $2, $3
       WHERE NOT EXISTS (
         SELECT 1 FROM review_dishes
         WHERE review_id = $1 AND lower(name) = lower($2)
       )`,
      [reviewId, d.name, d.state]
    );
  }

  return NextResponse.json(
    { success: true, reviewId },
    { status: 201 }
  );
}
