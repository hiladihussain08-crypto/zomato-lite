"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Restaurant = {
  name: string;
  cuisine: string;
  area: string;
};

// Screen 1: write a review. The only logic in here is validation *kindness*:
// keeping the button disabled while the input is obviously unfinished, so honest
// users cannot stumble. The backend still re-checks everything - that is security.
export default function ReviewPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = use(params);
  const router = useRouter();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loadFailedStatus, setLoadFailedStatus] = useState<number | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  // The name comes from the same GET endpoint the restaurant page uses.
  // One kitchen, two dining rooms.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/restaurants/${restaurantId}`)
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setLoadFailedStatus(res.status);
          return;
        }
        const json = await res.json();
        if (!cancelled) {
          setRestaurant({ name: json.name, cuisine: json.cuisine, area: json.area });
        }
      })
      .catch(() => {
        if (!cancelled) setLoadFailedStatus(500);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  async function submitReview(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setBackendError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: Number(restaurantId),
          rating,
          comment: comment.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Do not invent a message. Print exactly what the backend said.
        setBackendError(json.error ?? `Request failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      router.push(`/restaurant/${restaurantId}`);
    } catch {
      // The network itself failed - a different fact than a rejected review.
      setBackendError("Could not reach the server");
      setSubmitting(false);
    }
  }

  if (loadFailedStatus !== null) {
    return (
      <main className="min-h-screen bg-[#FAF9F6] px-6 py-16 text-stone-900">
        <div className="mx-auto max-w-[560px]">
          <p className="text-stone-500">
            {loadFailedStatus === 404
              ? "This restaurant does not exist, so there is nothing to review."
              : "The kitchen did not answer just now - a network hiccup, not your fault. Refresh the page."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF9F6] px-6 py-16 text-stone-900">
      <div className="mx-auto max-w-[560px] space-y-10">
        <Link
          href={`/restaurant/${restaurantId}`}
          className="inline-block rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-100"
        >
          ← Back to reviews
        </Link>
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest">
            <span className="text-[#E23744]">Zomato</span>
            <span className="text-stone-900">-Lite</span>
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {restaurant === null ? "Loading…" : restaurant.name}
          </h1>
          {restaurant !== null && (
            <p className="mt-2 text-sm text-stone-500">
              {restaurant.cuisine} · {restaurant.area}
            </p>
          )}
        </header>

        <form onSubmit={submitReview} className="space-y-8">
          <fieldset>
            <legend className="text-sm font-medium text-stone-600">Your rating</legend>
            <div className="mt-3 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`Rate ${n} out of 5`}
                  onClick={() => setRating(n)}
                  className="rounded-lg p-2 text-4xl leading-none transition-colors hover:bg-stone-100"
                >
                  <span className={n <= rating ? "text-amber-600" : "text-stone-300"}>★</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="comment" className="text-sm font-medium text-stone-600">
              Your review
            </label>
            <textarea
              id="comment"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Something honest, something useful."
              className="mt-3 w-full resize-none rounded-lg border border-stone-200 bg-white p-4 text-base placeholder:text-stone-400 focus:outline-2 outline-amber-700"
            />
          </div>

          {backendError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {backendError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || rating === 0 || comment.trim().length === 0}
            className="w-full rounded-lg border-2 border-black bg-white py-3.5 text-sm font-semibold text-black transition-colors hover:border-[#E23744] hover:bg-[#E23744] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Sending…" : "Submit review"}
          </button>
        </form>
      </div>
    </main>
  );
}
