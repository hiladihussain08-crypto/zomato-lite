import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// GET = "give me something." Reads only. Changes nothing in the database.
// Response shape mirrors the screen: name, big average, latest review, older list.
// Everything computed here is computed fresh, every request - never stored.

function toReview(row: Record<string, unknown>) {
  const parsed = new Date(row.created_at as string);
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    createdAt: Number.isNaN(parsed.getTime()) ? String(row.created_at) : parsed.toISOString(),
  };
}

// In Next.js 15 the dynamic [id] part of the URL arrives as a Promise - awaited, not read.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const restaurantId = Number(id);

  // Does the restaurant exist? If not: 404 and nothing else is computed.
  const restaurantRows = await sql.query(
    "SELECT id, name, cuisine, area FROM restaurants WHERE id = $1",
    [restaurantId]
  );
  if (restaurantRows.length === 0) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }
  const restaurant = restaurantRows[0];

  // The three computations this product's entire intelligence is made of.
  // averageRating comes from AVG(rating), totalReviews from COUNT(*) - in ONE server trip.
  // Both always answer, even when no reviews exist: COUNT says 0, AVG says NULL.
  // The backend does not pretend an empty list has an average - it reports null.
  const aggregateRows = await sql.query(
    "SELECT AVG(rating) AS average, COUNT(*) AS total FROM reviews WHERE restaurant_id = $1",
    [restaurantId]
  );
  const aggregate = aggregateRows[0];
  const rawAverage = Number(aggregate.average);
  const averageRating = Number.isFinite(rawAverage) ? Math.round(rawAverage * 10) / 10 : null;
  const totalReviews = Number(aggregate.total);

  // Latest review (newest by created_at) separately...
  const latestRows =
    totalReviews > 0
      ? await sql.query(
          "SELECT id, rating, comment, created_at FROM reviews WHERE restaurant_id = $1 ORDER BY created_at DESC LIMIT 1",
          [restaurantId]
        )
      : [];
  // ...and every review after it, newest first - so the page never prints the latest one twice.
  const olderRows =
    totalReviews > 1
      ? await sql.query(
          "SELECT id, rating, comment, created_at FROM reviews WHERE restaurant_id = $1 AND id <> $2 ORDER BY created_at DESC",
          [restaurantId, latestRows[0].id]
        )
      : [];

  return NextResponse.json({
    name: restaurant.name,
    cuisine: restaurant.cuisine,
    area: restaurant.area,
    averageRating,
    totalReviews,
    latestReview: latestRows.length > 0 ? toReview(latestRows[0]) : null,
    reviews: olderRows.map(toReview),
  });
}
