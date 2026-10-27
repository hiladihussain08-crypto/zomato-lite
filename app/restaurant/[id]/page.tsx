"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";

// The redesigned reviews screen, promoted from redesign.html onto real data.
// Contract unchanged: this file calls GET /api/restaurants/[id] and prints what
// arrives. THE FRONTEND DOES ZERO MATHS - the average, distribution, bar widths,
// star counts and helpful totals are all computed by the backend; this file has
// no arithmetic beyond printing numbers as they arrive.

type DishMark = { name: string; state: string };

type Review = {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
  dishes: DishMark[];
  helpfulCount: number;
};

type DishCount = { name: string; recommendCount: number; skipCount: number };

type RestaurantData = {
  name: string;
  cuisine: string;
  area: string;
  averageRating: number | null;
  averageStarsOn: number;
  distribution: Array<{ rating: number; count: number; pct: number }>;
  totalReviews: number;
  latestReview: Review | null;
  reviews: Review[];
  dishes: DishCount[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Words for the singular filter sentences: "Showing 1 four-star review".
const WORDS_FOR = ["", "one", "two", "three", "four", "five"];

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function UpIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function DownIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
    </svg>
  );
}

function CheckIcon({ className = "h-[15px] w-[15px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ChevronIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function XMiniIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-[18px] w-[18px]">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

// Presentation only: one timestamp becomes one readable string.
function stamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function dayFloor(x: Date) {
  return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
}

function relDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Math.round((dayFloor(new Date()) - dayFloor(d)) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function SkeletonScreen() {
  return (
    <div aria-label="Loading reviews">
      <div className="sk h-[150px] rounded-none sm:rounded-b-2xl" />
      <div className="px-4 pt-6">
        <div className="flex gap-5">
          <div className="flex w-24 shrink-0 flex-col gap-2">
            <div className="sk h-10 w-16" />
            <div className="sk h-3.5 w-[88px]" />
            <div className="sk h-3 w-[60px]" />
          </div>
          <div className="flex flex-1 flex-col justify-center gap-4">
            <div className="sk h-1.5" />
            <div className="sk h-1.5" />
            <div className="sk h-1.5" />
            <div className="sk h-1.5" />
            <div className="sk h-1.5" />
          </div>
        </div>
        <div className="sk mt-8 h-3 w-[210px]" />
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="sk h-[36px] w-[150px] rounded-full" />
          <div className="sk h-[36px] w-[130px] rounded-full" />
          <div className="sk h-[36px] w-[70px] rounded-full" />
        </div>
        <div className="mt-8 flex flex-col gap-3">
          {[2, 3, 2].map((lines, i) => (
            <div key={i} className="flex flex-col gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
              <div className="flex items-center gap-2">
                <div className="sk h-[22px] w-[38px] rounded-md" />
                <div className="sk ml-auto h-3 w-[70px]" />
              </div>
              {Array.from({ length: lines }, (_, j) => (
                <div key={j} className={`sk h-3 ${j === lines - 1 ? "w-[55%]" : "w-[92%]"}`} />
              ))}
              <div className="sk h-7 w-[96px] rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// One review card. The "latest" tag lights up only for the newest review in
// the whole list; helpful votes report through the callback with instant UI.
function ReviewCard({
  review,
  isLatest,
  voted,
  shownCount,
  onHelpful,
  expanded,
  onToggleExpanded,
}: {
  review: Review;
  isLatest: boolean;
  voted: boolean;
  shownCount: number;
  onHelpful: (reviewId: number) => void;
  expanded: boolean;
  onToggleExpanded: (reviewId: number) => void;
}) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [overflows, setOverflows] = useState(false);

  // A three-line CSS clamp hides overflow; this measure decides whether the
  // Read more affordance exists at all for this particular text length.
  useEffect(() => {
    const p = textRef.current;
    if (!p) return;
    setOverflows(!expanded && p.scrollHeight > p.clientHeight + 2);
  }, [review.comment, expanded]);

  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex items-center gap-2">
        <span
          className="rounded-md bg-[var(--brand)] px-2 py-0.5 text-[13px] font-semibold leading-[1.3] text-[var(--on-brand)]"
          aria-label={`${review.rating.toFixed(1)} star rating`}
        >
          {review.rating.toFixed(1)}
        </span>
        {isLatest && (
          <span className="rounded-md border border-[var(--brand)] px-[7px] py-[2px] text-[11px] font-semibold leading-[1.3] text-[var(--brand)]">
            Latest
          </span>
        )}
        <span className="ml-auto whitespace-nowrap text-[13px] text-[var(--secondary)]" title={stamp(review.createdAt)}>
          {relDate(review.createdAt)}
        </span>
      </div>

      <p
        ref={textRef}
        className={`m-0 text-[15px] ${expanded || !overflows ? "" : "line-clamp-3"}`}
      >
        {review.comment}
      </p>

      {(expanded || overflows) && (
        <button
          type="button"
          className="self-start text-[13px] font-semibold text-[var(--brand)] underline underline-offset-2"
          aria-expanded={expanded}
          onClick={() => onToggleExpanded(review.id)}
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}

      {review.dishes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {review.dishes.map((d, i) => {
            const up = d.state === "recommend";
            return (
              <span
                key={i}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[12px] font-semibold ${
                  up ? "bg-[var(--rec-bg)] text-[var(--rec-text)]" : "bg-[var(--skip-bg)] text-[var(--skip-text)]"
                }`}
              >
                {up ? <UpIcon className="h-[11px] w-[11px]" /> : <DownIcon className="h-[11px] w-[11px]" />}
                {d.name}
                <span className="sr-only">{up ? "recommended" : "skip"}</span>
              </span>
            );
          })}
        </div>
      )}

      <div className="flex">
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[13px] font-semibold transition-colors ${
            voted
              ? "border-[var(--rec-text)] text-[var(--rec-text)]"
              : "border-[var(--border)] text-[var(--secondary)] hover:text-[var(--text)]"
          }`}
          aria-pressed={voted}
          aria-label="Mark this review helpful"
          onClick={() => onHelpful(review.id)}
        >
          <UpIcon />
          Helpful
          <span className="text-[12px]">{shownCount}</span>
        </button>
      </div>
    </article>
  );
}

export default function RestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<RestaurantData | null>(null);
  const [loadFailedStatus, setLoadFailedStatus] = useState<number | null>(null);

  const [ratingF, setRatingF] = useState<number | null>(null);
  const [dishF, setDishF] = useState<string | null>(null);

  const [votes, setVotes] = useState<Record<number, boolean>>({});
  const [serverCounts, setServerCounts] = useState<Record<number, number>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [voterKey, setVoterKey] = useState<string>("");
  const [toast, setToast] = useState(false);

  // Rating-filter choreography: the fixed top bar gains the page background
  // once the hero has scrolled by, the filter chip lives there only while the
  // rating section is out of view, card list swaps fade over 150ms, and
  // restores keep the scroll position stable (see the commit effect below).
  const [pageScrolled, setPageScrolled] = useState(false);
  const [ratingOnScreen, setRatingOnScreen] = useState(true);
  const [listDimmed, setListDimmed] = useState(false);
  const [staleList, setStaleList] = useState<Review[] | null>(null);
  const [dishBorn, setDishBorn] = useState(0);
  const ratingSecRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fadeT = useRef<number | null>(null);
  const anchorTop = useRef<number | null>(null);
  const scrollHome = useRef(false);
  const listIntoView = useRef(false);

  // Anonymous, account-free helpful voting: one random id per browser,
  // persisted in localStorage, sent with every vote.
  useEffect(() => {
    try {
      let key = localStorage.getItem("zl_voter");
      if (!key) {
        key =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : "v" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem("zl_voter", key);
      }
      setVoterKey(key);
    } catch {
      setVoterKey("anon-voter-key");
    }
  }, []);

  // The write page toasts on its way out; this page welcomes the reader back.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("zl_toast")) {
        sessionStorage.removeItem("zl_toast");
        setToast(true);
        const t = window.setTimeout(() => setToast(false), 2600);
        return () => window.clearTimeout(t);
      }
    } catch {
      // private mode: the toast simply never fires
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setLoadFailedStatus(null);
    setRatingF(null);
    setDishF(null);
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

  async function toggleHelpful(reviewId: number) {
    const next = !votes[reviewId];
    setVotes((v) => ({ ...v, [reviewId]: next }));
    try {
      const res = await fetch("/api/helpful", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, voterKey, on: next }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        setVotes((v) => ({ ...v, [reviewId]: !next }));
        return;
      }
      // The server's count is the truth; the optimistic value was just a guess
      // that made the click feel instant.
      setServerCounts((c) => ({ ...c, [reviewId]: json.count }));
      setVotes((v) => ({ ...v, [reviewId]: json.active === true }));
    } catch {
      setVotes((v) => ({ ...v, [reviewId]: !next }));
    }
  }

  // ---------- rating filter ----------

  // Filter state commits instantly (row ink, result line, heading, dish swap
  // all answer at once), while the card list fades: the outgoing cards stay
  // on screen dimming out over 150ms, then the new list fades in. Reduced
  // motion commits and swaps without any fade.
  // kind: "apply" = selecting a filter ("scroll the list into view if it is
  // below the fold"), "stabilize" = clearing (keep the viewport still),
  // "home" = the pinned chip (also scroll back to the rating section).
  function transitionTo(mutate: () => void, kind: "apply" | "stabilize" | "home" = "apply") {
    if (fadeT.current !== null) window.clearTimeout(fadeT.current);
    if (kind === "stabilize") {
      const el = ratingSecRef.current;
      anchorTop.current = el ? Math.round(el.getBoundingClientRect().top) : null;
    } else if (kind === "home") {
      scrollHome.current = true;
    } else {
      listIntoView.current = true;
    }
    if (kind !== "apply") setDishBorn((k) => k + 1);
    if (reducedMotion()) {
      mutate();
      return;
    }
    setStaleList(shown);
    setListDimmed(true);
    fadeT.current = window.setTimeout(() => {
      mutate();
      setStaleList(null);
      setListDimmed(false);
    }, 150);
  }

  function selectRating(r: number) {
    if (r === ratingF) {
      transitionTo(() => setRatingF(null), "stabilize");
      return;
    }
    transitionTo(() => {
      setRatingF(r);
      setDishF(null); // a rating filter and a dish filter never coexist
    }, "apply");
  }

  function clearRating() {
    if (ratingF === null) return;
    transitionTo(() => setRatingF(null), "stabilize");
  }

  function clearFromChip() {
    if (ratingF === null) return;
    transitionTo(() => setRatingF(null), "home");
  }

  // The committed layout is measured here, after React has painted it, so the
  // scroll repairs act on the new geometry rather than a guess.
  useEffect(() => {
    const el = ratingSecRef.current;
    if (anchorTop.current !== null && el) {
      const delta = Math.round(el.getBoundingClientRect().top) - anchorTop.current;
      if (Math.abs(delta) > 2) window.scrollBy({ top: delta });
      anchorTop.current = null;
    } else if (scrollHome.current && el) {
      scrollHome.current = false;
      const top = Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - 58));
      window.scrollTo({ top, behavior: reducedMotion() ? "auto" : "smooth" });
    } else if (listIntoView.current && listRef.current) {
      const listTop = listRef.current.getBoundingClientRect().top;
      if (listTop >= window.innerHeight) {
        window.scrollBy({ top: listTop - 58, behavior: reducedMotion() ? "auto" : "smooth" });
      }
      listIntoView.current = false;
    }
  }, [ratingF, dishF]);

  // Fixed-bar state: the bar's background and the restaurant name appear
  // once the hero has scrolled under it.
  useEffect(() => {
    const onScroll = () => setPageScrolled(window.scrollY > 90);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The filter chip appears only when the rating section is completely out
  // of view - "scrolled past the rating section".
  useEffect(() => {
    const el = ratingSecRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => setRatingOnScreen(entries[0].isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [data]);

  const allReviews = data ? (data.latestReview ? [data.latestReview, ...data.reviews] : data.reviews) : [];

  const passes = (r: Review) => {
    if (ratingF !== null && r.rating !== ratingF) return false;
    if (dishF !== null && !r.dishes.some((d) => d.name === dishF)) return false;
    return true;
  };
  const shown = allReviews.filter(passes);

  // During the 150ms card crossfade the outgoing list keeps rendering; the
  // rest of the page (ink, result line, heading) already reflects the filter.
  const listShown = staleList ?? shown;

  const dishState = (d: DishCount): "recommend" | "skip" =>
    d.recommendCount > 0 || d.skipCount === 0 ? "recommend" : "skip";

  // The list heading mirrors the filter: "9 reviews · 5 stars" / "3 reviews · Fries".
  let headingText = "Reviews";
  if (data) {
    if (ratingF !== null) {
      headingText = `${shown.length} ${shown.length === 1 ? "review" : "reviews"} · ${ratingF} stars`;
    } else if (dishF !== null) {
      headingText = `${shown.length} ${shown.length === 1 ? "review" : "reviews"} · ${dishF}`;
    }
  }

  const helpText: string | null =
    loadFailedStatus !== null
      ? loadFailedStatus === 404
        ? "This restaurant could not be found."
        : "The kitchen did not answer just now - a network hiccup, not your fault. Refresh the page."
      : null;

  return (
    <div className="mx-auto max-w-[480px]">
      {/* Toast - shown when returning from a successful /review post */}
      <div
        className={`pointer-events-none fixed left-4 right-4 top-3.5 z-30 mx-auto flex max-w-[448px] items-center gap-2 rounded-full bg-[var(--rec-bg)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--rec-text)] transition-all duration-150 ${
          toast ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        }`}
        role="status"
        aria-live="polite"
      >
        <CheckIcon />
        <span>Thanks, your review is live</span>
      </div>

      {helpText !== null && (
        <main className="px-6 py-16 text-[var(--text)]">
          <p className="text-[var(--secondary)]">
            {helpText}{" "}
            <Link href="/" className="text-[var(--brand)] underline underline-offset-2">
              Back
            </Link>
          </p>
        </main>
      )}

      {!data && loadFailedStatus === null && <SkeletonScreen />}

      {data && (
        <>
          {/* Fixed top bar: transparent over the hero; page colour, name and
              the rating-filter chip once the content has scrolled beneath */}
          <div
            className={`fixed inset-x-0 top-0 z-20 mx-auto flex h-[52px] max-w-[480px] items-center gap-2 border-b px-4 motion-safe:transition-colors duration-150 ${
              pageScrolled ? "bg-[var(--bg)] border-[var(--border)]" : "bg-transparent border-transparent"
            }`}
          >
            <span
              className={`min-w-0 truncate text-[16px] font-semibold motion-safe:transition-opacity duration-150 ${
                pageScrolled ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden={pageScrolled ? undefined : true}
            >
              {data.name}
            </span>
            {ratingF !== null && !ratingOnScreen && (
              <button
                type="button"
                aria-label={`Clear the ${ratingF}-star filter`}
                onClick={clearFromChip}
                className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--brand)] px-2.5 py-1.5 text-[13px] font-semibold text-[var(--on-brand)]"
              >
                {ratingF} stars
                <XMiniIcon />
              </button>
            )}
          </div>

          {/* Hero */}
          <header className="relative h-[150px] overflow-hidden rounded-b-2xl">
            <div aria-hidden="true" className="absolute inset-0 bg-[url('/burrito.jpg')] bg-cover bg-center" />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
            <span className="absolute left-4 top-3 z-[2] inline-block rounded-full bg-[rgba(250,249,246,0.9)] px-2.5 py-[5px] text-[11px] font-semibold uppercase tracking-[0.18em]">
              <span className="text-[var(--brand)]">Zomato</span>
              <span className="text-[#1C1C1C]">-Lite</span>
            </span>
            <div className="absolute bottom-3 left-4 right-4 z-[1]">
              <h1 className="m-0 text-2xl font-semibold leading-tight text-white">{data.name}</h1>
              <p className="m-0 mt-0.5 text-[13px] text-white/90">
                {data.cuisine} · {data.area}
              </p>
            </div>
          </header>

          <main className="bg-[var(--bg)] px-4 pb-[112px] pt-6 text-[var(--text)]">
            {data.totalReviews === 0 ? (
              <section className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-6 text-center">
                <p className="m-0 text-[var(--secondary)]">No reviews yet. Be the first to share one.</p>
              </section>
            ) : (
              <>
                {/* Rating summary - two top-aligned columns, one at every width */}
                <section ref={ratingSecRef} className="-mx-3.5 p-3.5" aria-label="Rating summary">
                  <div className="flex items-start gap-3">
                    <div className="w-[68px] shrink-0">
                      <p className="m-0 text-[36px] font-semibold leading-none tracking-[-0.01em]">{data.averageRating}</p>
                      <p
                        className="mt-1.5 whitespace-nowrap text-[12px] leading-none tracking-[1px]"
                        aria-label={`${data.averageRating} out of 5 stars`}
                      >
                        {Array.from({ length: 5 }, (_, i) => (
                          <span key={i} className={i < data.averageStarsOn ? "text-[var(--star)]" : "text-[var(--muted)]"}>
                            {i < data.averageStarsOn ? "★" : "☆"}
                          </span>
                        ))}
                      </p>
                      <p className="m-0 mt-1.5 text-[11px] leading-[1.2] text-[var(--secondary)]">
                        {data.totalReviews} {data.totalReviews === 1 ? "review" : "reviews"}
                      </p>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="m-0 mb-1.5 text-[13px] leading-none text-[var(--secondary)]">Filter by rating</p>
                      <div id="rating-bar-rows" role="group" aria-label="Filter reviews by rating" className="flex flex-col gap-1">
                        {data.distribution.map((d) => {
                          const active = ratingF === d.rating;
                          const dead = d.count === 0;
                          return (
                            <button
                              key={d.rating}
                              type="button"
                              className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg border-[0.5px] border-[var(--border)] px-2 text-left hover:bg-[var(--skip-bg)] active:bg-[var(--border)] ${
                                dead || (ratingF !== null && !active) ? "opacity-45" : "opacity-100"
                              }`}
                              style={
                                active
                                  ? { borderColor: "#E23744", borderWidth: "1.5px", backgroundColor: "rgba(226,55,68,0.08)" }
                                  : undefined
                              }
                              aria-pressed={active}
                              aria-disabled={dead || undefined}
                              aria-label={`Filter by ${d.rating} star reviews, ${d.count} review${d.count === 1 ? "" : "s"}`}
                              onClick={() => {
                                if (dead) return;
                                selectRating(d.rating);
                              }}
                            >
                              <span className="w-[14px] shrink-0 text-[12px] font-semibold text-[var(--text)]">{d.rating}</span>
                              <span className="h-[6px] min-w-0 flex-1 overflow-hidden rounded-[3px] bg-[var(--border)]">
                                <span className="block h-full rounded-[3px] bg-[var(--brand)]" style={{ width: `${d.pct}%` }} />
                              </span>
                              <span className="min-w-[16px] shrink-0 text-right text-[12px] text-[var(--secondary)]">{d.count}</span>
                              {active ? (
                                <CheckIcon className="h-3 w-3 shrink-0 text-[var(--brand)]" />
                              ) : dead ? null : (
                                <ChevronIcon className="h-3 w-3 shrink-0 text-[var(--muted)]" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Dish section while no rating filter runs; the filter's result line otherwise */}
                {ratingF === null && (
                  <section
                    key={dishBorn}
                    aria-labelledby="dishHeading"
                    className={`mt-2 border-t border-[var(--border)] pt-5 ${dishBorn > 0 ? "zt-fadein" : ""}`}
                  >
                  <h2 id="dishHeading" className="m-0 mb-3 text-[13px] font-semibold">
                    What people say about the food
                  </h2>
                  {data.dishes.length === 0 ? (
                    <p className="m-0 text-[13px] text-[var(--muted)]">
                      Nothing yet - dishes appear here as reviews name them.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter reviews by dish">
                      {data.dishes.map((d) => {
                        const up = dishState(d) === "recommend";
                        const n = up ? d.recommendCount : d.skipCount;
                        const on = dishF === d.name;
                        return (
                          <button
                            key={d.name}
                            type="button"
                            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-shadow ${
                              up ? "bg-[var(--rec-bg)] text-[var(--rec-text)]" : "bg-[var(--skip-bg)] text-[var(--skip-text)]"
                            } ${on ? "outline outline-[1.5px]" : ""}`}
                            style={on ? { outlineColor: up ? "var(--rec-text)" : "var(--skip-text)", outlineOffset: "1px" } : undefined}
                            aria-pressed={on}
                            onClick={() => transitionTo(() => setDishF(on ? null : d.name))}
                          >
                            {up ? <UpIcon className="h-[14px] w-[14px]" /> : <DownIcon className="h-[14px] w-[14px]" />}
                            <span>
                              {d.name} {n}
                            </span>
                            <span className="sr-only">{up ? "recommended" : "skip"}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {data.dishes.length > 0 && (
                    <p className="mt-2 text-[13px] text-[var(--muted)]">Tap a dish to see reviews that mention it</p>
                  )}
                  </section>
                )}

                {ratingF !== null && (
                  <div id="filterResult" aria-live="polite" className="mt-4 flex items-center justify-between gap-3">
                    <p className="m-0 min-w-0 text-[13px] leading-[1.35]">
                      Showing {shown.length} {WORDS_FOR[ratingF]}-star review{shown.length === 1 ? "" : "s"}
                    </p>
                    <button
                      type="button"
                      onClick={clearRating}
                      className="shrink-0 rounded-[10px] bg-[var(--card)] px-[10px] py-2 text-[13px] font-semibold text-[var(--brand)] hover:opacity-90"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {/* Reviews */}
                <section aria-labelledby="reviewsHeading" className="mt-7">
                  <h2 id="reviewsHeading" className="m-0 text-[13px] font-semibold">
                    {headingText}
                  </h2>
                  {allReviews.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-6 text-center">
                      <p className="m-0 text-[var(--secondary)]">No reviews yet. Be the first to share one.</p>
                    </div>
                  ) : shown.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-6 text-center">
                      <p className="m-0 text-[var(--secondary)]">No reviews match this filter</p>
                      <button
                        type="button"
                        className="text-[13px] font-semibold text-[var(--brand)] underline underline-offset-2"
                        onClick={() => {
                          setRatingF(null);
                          setDishF(null);
                        }}
                      >
                        Clear filters
                      </button>
                    </div>
                  ) : (
                    <div
                      ref={listRef}
                      className={`mt-2.5 flex flex-col gap-3 transition-opacity duration-150 motion-reduce:transition-none ${
                        listDimmed ? "opacity-0" : "opacity-100"
                      }`}
                    >
                      {listShown.map((r) => (
                        <ReviewCard
                          key={r.id}
                          review={r}
                          isLatest={allReviews[0].id === r.id}
                          voted={votes[r.id] === true}
                          shownCount={serverCounts[r.id] !== undefined ? serverCounts[r.id] : r.helpfulCount + (votes[r.id] ? 1 : 0)}
                          onHelpful={toggleHelpful}
                          expanded={expanded[r.id] === true}
                          onToggleExpanded={(rid) => setExpanded((e) => ({ ...e, [rid]: !e[rid] }))}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </main>

          {/* Sticky action bar - on the page colour with a hairline, never a card block */}
          <footer className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[480px] bg-[var(--bg)] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] border-t border-[var(--border)]">
            <Link
              href={`/review/${id}`}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] text-base font-semibold text-[var(--on-brand)] no-underline transition-colors hover:bg-[var(--brand-hover)] active:scale-[0.99]"
            >
              <PenIcon />
              Write a review
            </Link>
          </footer>
        </>
      )}
    </div>
  );
}
