# Zomato Lite

A one-restaurant review product, small on purpose. Two screens, two APIs, two database tables — and one live URL:

**https://zomato-lite-omega-seven.vercel.app**

- Restaurant page: `/restaurant/1`
- Write a review: `/review/1`

## The idea inside

Store **facts** (one row per review: rating, comment, timestamp). Compute **answers** on request.

- There is no `average_rating` column and no `latest_review` column. The backend runs
  `AVG(rating)` / `COUNT(*)` / newest-first order **on every page load**, so stored values can
  never drift from the truth.
- The frontend has zero maths: it receives `4.5` and prints `4.5`.
- Both the API and the database validate input: the rating must be an integer 1–5 — checked at
  three layers (UI kindness, backend security, database `CHECK`) because anyone with a terminal
  can talk to the API directly.

## Where things live

| Layer | Files |
|---|---|
| Frontend | `app/page.tsx`, `app/restaurant/[id]/page.tsx`, `app/review/[restaurantId]/page.tsx` |
| Backend | `app/api/reviews/route.ts`, `app/api/restaurants/[id]/route.ts`, `lib/db.ts` |
| Database | `db/schema.sql`, `db/seed.sql`, `scripts/db-setup.mjs` |
| Config | `package.json`, `tsconfig.json`, `next.config.ts`, `.env.local` (never committed) |

## Endpoints

| Endpoint | Behaviour |
|---|---|
| `POST /api/reviews` | `{ restaurantId, rating, comment }` → 3 checks → insert one row → `201 { success, reviewId }` or `400 { error }` |
| `GET /api/restaurants/[id]` | name, cuisine, area, `averageRating` (1 decimal), `totalReviews`, `latestReview` (newest), `reviews` (the rest, newest first) → `404` if unknown restaurant |

## Run it locally

```bash
npm install
# put your Neon connection string in .env.local as DATABASE_URL (it is git-ignored)
npm run db:setup   # rebuild the two tables + seed Ludhiana Burrito with 3 reviews
npm run dev        # http://localhost:3000
```

## Deployed

Connected to GitHub: every push to `main` builds and releases to production via Vercel — no deploy commands, tickets, or humans required.
