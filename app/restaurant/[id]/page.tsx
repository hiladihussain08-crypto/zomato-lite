"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

type Review = {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
};

// This page's whole contract: call GET /api/restaurants/[id], print what arrives.
// THE FRONTEND DOES ZERO MATHS. The average is computed in the backend, on every
// load, and this file has no arithmetic anywhere - no adding, no dividing, no sorting.
type RestaurantData = {
  name: string;
  cuisine: string;
  area: string;
  averageRating: number | null;
  totalReviews: number;
  latestReview: Review | null;
  reviews: Review[];
};

function Stars({ rating, small = false }: { rating: number; small?: boolean }) {
  return (
    <span className={small ? "text-sm" : "text-lg"} aria-label={`${rating} out of 5`}>
      <span className="text-amber-600">{"★".repeat(rating)}</span>
      <span className="text-stone-300">{"☆".repeat(5 - rating)}</span>
    </span>
  );
}

// Presentation only: turning one timestamp into one readable string.
function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function RestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<RestaurantData | null>(null);
  const [loadFailedStatus, setLoadFailedStatus] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setLoadFailedStatus(null);
    fetch(`/api/restaurants/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setLoadFailedStatus(res.status);
          return;
        }
        const json = await res.json();
        if (!cancelled) setData(json as RestaurantData);
      })
      .catch(() => {
        if (!cancelled) setLoadFailedStatus(500);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <main className="min-h-screen bg-[#FAF9F6] px-6 py-16 text-stone-900">
      <div className="mx-auto max-w-[560px] space-y-10">
        {loadFailedStatus !== null && (
          <p className="text-stone-500">
            {loadFailedStatus === 404
              ? "This restaurant could not be found."
              : "The kitchen did not answer just now - a network hiccup, not your fault. Refresh the page."}{" "}
            <Link href="/" className="text-amber-700 underline">Back</Link>
          </p>
        )}
        {!data && loadFailedStatus === null && <p className="text-stone-500">Loading…</p>}

        {data && (
          <>
            <header>
              <h1 className="text-3xl font-semibold tracking-tight">{data.name}</h1>
              <p className="mt-2 text-sm text-stone-500">
                {data.cuisine} · {data.area}
              </p>
            </header>

            {data.totalReviews === 0 ? (
              <section className="rounded-lg border border-stone-200 bg-white p-6 text-center">
                <p className="text-stone-700">
                  No reviews yet. Somebody&apos;s first visit is waiting to be told.
                </p>
                <Link href={`/review/${id}`} className="mt-4 inline-block text-sm font-semibold text-amber-700 hover:underline">
                  Write the first review
                </Link>
              </section>
            ) : (
              <>
                <section className="flex items-end gap-3">
                  {/* THE LINE: the average arrives computed (4.5) and is printed as-is. */}
                  <p className="text-7xl font-semibold leading-none tracking-tight">{data.averageRating}</p>
                  <p className="pb-1 text-sm text-stone-500">
                    {data.totalReviews} {data.totalReviews === 1 ? "review" : "reviews"}
                  </p>
                </section>

                {data.latestReview && (
                  <section>
                    <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">Latest review</p>
                    <article className="mt-3 rounded-lg border border-stone-200 bg-white p-5">
                      <Stars rating={data.latestReview.rating} />
                      <p className="mt-3 text-lg">{data.latestReview.comment}</p>
                      <p className="mt-3 text-xs text-stone-400">{formatDate(data.latestReview.createdAt)}</p>
                    </article>
                  </section>
                )}

                {data.reviews.length > 0 && (
                  <section>
                    <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Earlier reviews</p>
                    <ul className="mt-2 divide-y divide-stone-200">
                      {data.reviews.map((review) => (
                        <li key={review.id} className="py-4">
                          <Stars rating={review.rating} small />
                          <p className="mt-2 text-stone-800">{review.comment}</p>
                          <p className="mt-1 text-xs text-stone-400">{formatDate(review.createdAt)}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}

            <footer className="pt-4">
              <Link href={`/review/${id}`} className="text-sm font-semibold text-amber-700 hover:underline">
                Write a review
              </Link>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}
