import { NextResponse } from "next/server";
import { q } from "@/lib/db";

// GET = "give me something." Reads only. Changes nothing in the database.
// Response shape mirrors the screen: name, big average, latest review, older list,
// plus the redesign's additions: dish verdict counts and per-review dish marks /
// helpful totals. Everything computed here is computed fresh, every request -
// never stored.

type DishMark = { name: string; state: string };

function toReview(row: Record<string, unknown>, dishes: DishMark[] = [], helpfulCount = 0) {
  const parsed = new Date(row.created_at as string);
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    createdAt: Number.isNaN(parsed.getTime()) ? String(row.created_at) : parsed.toISOString(),
    dishes,
    helpfulCount,
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
  const restaurantRows = await q(
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
  const aggregateRows = await q(
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
      ? await q(
          "SELECT id, rating, comment, created_at FROM reviews WHERE restaurant_id = $1 ORDER BY created_at DESC LIMIT 1",
          [restaurantId]
        )
      : [];
  // ...and every review after it, newest first - so the page never prints the latest one twice.
  const olderRows =
    totalReviews > 1
      ? await q(
          "SELECT id, rating, comment, created_at FROM reviews WHERE restaurant_id = $1 AND id <> $2 ORDER BY created_at DESC",
          [restaurantId, latestRows[0].id]
        )
      : [];

  // The redesigned summary needs the full rating distribution (bars 5 -> 1,
  // zeros included) and how many stars the rounded-down average lights up.
  // Both are answers, so they are computed here - the frontend only draws.
  const distRows = await q(
    "SELECT rating, count(*)::int AS n FROM reviews WHERE restaurant_id = $1 GROUP BY rating",
    [restaurantId]
  );
  const distBy = new Map<number, number>();
  for (const d of distRows) distBy.set(Number(d.rating), Number(d.n));
  const maxCount = Math.max(1, ...distBy.values());
  const distribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: distBy.get(rating) ?? 0,
    pct: Math.round(((distBy.get(rating) ?? 0) / maxCount) * 100),
  }));

  // Dish verdict totals, straight from SQL. The sum stays in the database's hands;
  // the API only carries the answer upward. Ordered by mentions so the write page
  // can read its autocomplete suggestions from the same list.
  const dishRows = await q(
    `SELECT d.name,
            sum(CASE WHEN d.state = 'recommend' THEN 1 ELSE 0 END)::int AS recommend_count,
            sum(CASE WHEN d.state = 'skip' THEN 1 ELSE 0 END)::int AS skip_count
     FROM review_dishes d
     JOIN reviews r ON r.id = d.review_id
     WHERE r.restaurant_id = $1
     GROUP BY d.name
     ORDER BY count(*) DESC, d.name`,
    [restaurantId]
  );
  const dishes = dishRows.map((r) => ({
    name: String(r.name),
    recommendCount: Number(r.recommend_count),
    skipCount: Number(r.skip_count),
  }));

  // Per-review dish marks, grouped in memory by review id.
  const markRows = await q(
    `SELECT d.review_id, d.name, d.state
     FROM review_dishes d
     JOIN reviews r ON r.id = d.review_id
     WHERE r.restaurant_id = $1`,
    [restaurantId]
  );
  const marks = new Map<number, DishMark[]>();
  for (const m of markRows) {
    const key = Number(m.review_id);
    const list = marks.get(key) ?? [];
    list.push({ name: String(m.name), state: String(m.state) });
    marks.set(key, list);
  }

  // Helpful vote totals per review, again computed by COUNT in SQL.
  const helpfulRows = await q(
    `SELECT hv.review_id, count(*)::int AS n
     FROM helpful_votes hv
     JOIN reviews r ON r.id = hv.review_id
     WHERE r.restaurant_id = $1
     GROUP BY hv.review_id`,
    [restaurantId]
  );
  const helpfulBy = new Map<number, number>();
  for (const h of helpfulRows) helpfulBy.set(Number(h.review_id), Number(h.n));

  return NextResponse.json({
    name: restaurant.name,
    cuisine: restaurant.cuisine,
    area: restaurant.area,
    averageRating,
    averageStarsOn: averageRating !== null ? Math.floor(averageRating) : 0,
    distribution,
    totalReviews,
    latestReview:
      latestRows.length > 0
        ? toReview(
            latestRows[0],
            marks.get(Number(latestRows[0].id)) ?? [],
            helpfulBy.get(Number(latestRows[0].id)) ?? 0
          )
        : null,
    reviews: olderRows.map((row) =>
      toReview(
        row,
        marks.get(Number(row.id)) ?? [],
        helpfulBy.get(Number(row.id)) ?? 0
      )
    ),
    dishes,
  });
}
