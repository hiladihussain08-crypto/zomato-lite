"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// The redesigned write-a-review screen, promoted from write.html onto real
// data. Anonymous by design: stars (required), text (optional), dishes each
// recommend/skip (optional). The backend re-validates everything that arrives
// at /api/reviews - and its verdicts (404, dish checks) are printed as they are.

type DishCount = { name: string; recommendCount: number; skipCount: number };
type RestaurantData = {
  name: string;
  cuisine: string;
  area: string;
  dishes: DishCount[];
};

const WORDS = ["", "Poor", "Okay", "Good", "Great", "Loved it"];
const STARTERS = ["Great taste", "Good value", "Quick service", "Would repeat"];
const MAX_DISHES = 5;

function UpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-[13px] w-[13px]">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function DownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-[13px] w-[13px]">
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-[13px] w-[13px]">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-[15px] w-[15px]">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-[22px] w-[22px]">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-[14px] w-[14px]">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

const norm = (s: string) => s.trim().toLowerCase();

// Starters append as sentences and remove themselves sentence-clean.
function withPhrase(cur: string, ph: string) {
  const c = cur.trim();
  if (!c) return `${ph}.`;
  if (c.toLowerCase().indexOf(ph.toLowerCase()) !== -1) return c;
  const punct = !/[.!?]$/.test(c) ? `${c}.` : c;
  return `${punct} ${ph}.`;
}

function withoutPhrase(cur: string, ph: string) {
  const esc = ph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  let out = cur.replace(new RegExp(`(^|[.\\s])${esc}\\.?(?=[.\\s]|$)`, "i"), (_m, pre) => (pre === "." ? ". " : " "));
  out = out.replace(/\s{2,}/g, " ").replace(/^\s*[.]\s*/, "").trim();
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}

type DishRow = { name: string; state: string | null };

export default function ReviewPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = use(params);
  const router = useRouter();

  const [restaurant, setRestaurant] = useState<RestaurantData | null>(null);
  const [loadFailedStatus, setLoadFailedStatus] = useState<number | null>(null);

  const [rating, setRating] = useState(0);
  const [rows, setRows] = useState<DishRow[]>([]);
  const [starters, setStarters] = useState<string[]>([]);
  const [comment, setComment] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState("");
  const [dupMsg, setDupMsg] = useState<string | null>(null);
  const [acOpen, setAcOpen] = useState(false);

  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState(false);
  const [ratingHelp, setRatingHelp] = useState(false);
  const [shake, setShake] = useState(false);

  const [dlgOpen, setDlgOpen] = useState(false);

  const barRef = useRef<HTMLElement>(null);
  const rateRef = useRef<HTMLElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const barLiftRef = useRef<HTMLDivElement>(null);

  const FAIL = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("fail") === "1";

  const suggestions: string[] = restaurant
    ? restaurant.dishes.map((d) => d.name)
    : [];

  // ---------- draft (sessionStorage) ----------
  function saveDraft(next?: { rating?: number; rows?: DishRow[]; starters?: string[]; text?: string }) {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(
        "zl_draft",
        JSON.stringify({
          rating: next?.rating ?? rating,
          dishes: next?.rows ?? rows,
          starters: next?.starters ?? starters,
          text: next?.text ?? comment,
        })
      );
    } catch {
      // storage unavailable: the session is simply not resumable
    }
  }
  function clearDraft() {
    try {
      sessionStorage.removeItem("zl_draft");
    } catch {
      // nothing to clear
    }
  }
  function hasInput() {
    return rating > 0 || rows.length > 0 || comment.trim().length > 0;
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/restaurants/${restaurantId}`)
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setLoadFailedStatus(res.status);
          return;
        }
        const json = await res.json();
        if (!cancelled) setRestaurant({ name: json.name, cuisine: json.cuisine, area: json.area, dishes: json.dishes });
      })
      .catch(() => {
        if (!cancelled) setLoadFailedStatus(500);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  // One-time draft restore: stars, dishes (max 5), quick-start phrases (only
  // those still present in the restored text) and the text itself.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("zl_draft");
      if (!raw) return;
      const d = JSON.parse(raw);
      if (typeof d?.rating === "number" && d.rating >= 1 && d.rating <= 5) setRating(d.rating);
      const t = typeof d?.text === "string" ? d.text.slice(0, 300) : "";
      setComment(t);
      const restoredRows: DishRow[] = (Array.isArray(d?.dishes) ? d.dishes : [])
        .filter((x: { name: unknown }) => x && typeof x.name === "string")
        .slice(0, MAX_DISHES)
        .map((x: { name: string; state: unknown }) => ({
          name: x.name,
          state: x.state === "recommend" || x.state === "skip" ? x.state : null,
        }));
      if (restoredRows.length) setRows(restoredRows);
      const restoredStarters = (Array.isArray(d?.starters) ? d.starters : [])
        .filter((p: unknown): p is string => typeof p === "string" && (STARTERS as string[]).indexOf(p) !== -1)
        .filter((p: string) => t.toLowerCase().indexOf(p.toLowerCase()) !== -1);
      if (restoredStarters.length) setStarters(restoredStarters);
    } catch {
      // a broken draft is discarded silently
    }
  }, []);

  // Keep the submit bar above the mobile keyboard: the visual viewport tells
  // us how much the keyboard steals from the window.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const fit = () => {
      const overlap = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      if (barLiftRef.current) {
        barLiftRef.current.style.transform = overlap > 0 ? `translateY(-${overlap}px)` : "";
      }
    };
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    fit();
    return () => {
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
    };
  }, []);

  // ---------- stars ----------
  function selectStar(n: number, animate: boolean) {
    const was = rating;
    setRating(n);
    setRatingHelp(false);
    saveDraft({ rating: n });
    if (animate && n > was) {
      const btn = document.querySelector<HTMLButtonElement>(`.star-btn[data-stars="${n}"]`);
      if (btn) {
        btn.classList.add("zt-pop");
        window.setTimeout(() => btn.classList.remove("zt-pop"), 140);
      }
    }
  }

  function starKeys(e: React.KeyboardEvent<HTMLDivElement>) {
    const cur = rating === 0 ? -1 : rating;
    let next: number | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = Math.max(1, (cur === -1 ? 1 : cur) - 1);
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") next = Math.min(5, (cur === -1 ? 1 : cur) + 1);
    else if (e.key === "Home") next = 1;
    else if (e.key === "End") next = 5;
    if (next === null) return;
    e.preventDefault();
    selectStar(next, true);
    document.querySelector<HTMLButtonElement>(`.star-btn[data-stars="${next}"]`)?.focus();
  }

  // ---------- dishes ----------
  function addDish(raw: string) {
    const v = raw.trim().slice(0, 60);
    if (!v) return;
    if (rows.some((r) => norm(r.name) === norm(v))) {
      setDupMsg(`"${v}" is already on your list`);
      return;
    }
    if (rows.length >= MAX_DISHES) return;
    const next = [...rows, { name: v, state: null }];
    setRows(next);
    setAddText("");
    setAcOpen(false);
    setDupMsg(null);
    saveDraft({ rows: next });
  }

  function toggleDishState(i: number, act: "rec" | "skip") {
    // action keys ("rec"/"skip") map onto stored state names ("recommend"/"skip")
    const name = act === "rec" ? "recommend" : act;
    const next = rows.map((r, j) => (j === i ? { ...r, state: r.state === name ? null : name } : r));
    setRows(next);
    saveDraft({ rows: next });
  }

  function removeRow(i: number) {
    const next = rows.slice(0, i).concat(rows.slice(i + 1));
    setRows(next);
    saveDraft({ rows: next });
  }

  function toggleStarter(ph: string) {
    const active = starters.indexOf(ph) !== -1;
    let nextText = comment;
    let nextStarters: string[];
    if (!active) {
      nextStarters = [...starters, ph];
      nextText = withPhrase(comment, ph);
    } else {
      nextStarters = starters.filter((p) => p !== ph);
      nextText = withoutPhrase(comment, ph);
      // a phrase the visitor edited by hand is no longer chip-managed
      nextStarters = nextStarters.filter((p) => nextText.toLowerCase().indexOf(p.toLowerCase()) !== -1);
    }
    setStarters(nextStarters);
    setComment(nextText);
    saveDraft({ starters: nextStarters, text: nextText });
  }

  // ---------- add-a-dish autocomplete ----------
  const acOptions = suggestions.filter(
    (s) => norm(s).indexOf(norm(addText)) !== -1 && addText.length > 0 && !rows.some((r) => norm(r.name) === norm(s))
  );

  function submit() {
    if (posting) return;
    if (rating === 0) {
      setRatingHelp(true);
      setShake(true);
      window.setTimeout(() => setShake(false), 260);
      rateRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setPosting(true);
    setPostError(false);
    const fetchPromise =
      FAIL === true
        ? null
        : fetch("/api/reviews", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              restaurantId: Number(restaurantId),
              rating,
              comment: comment.trim().slice(0, 300),
              dishes: rows
                .filter((r) => r.state)
                .map((r) => ({ name: r.name, state: r.state as string })),
            }),
          });
    if (fetchPromise) {
      fetchPromise
        .then(async (res) => {
          const json = await res.json().catch(() => null);
          if (!res.ok) {
            // the backend's word is final; the visitor's words survive a verdict
            setPosting(false);
            setPostError(true);
            return;
          }
          try {
            sessionStorage.setItem("zl_toast", "1");
          } catch {
            // private mode: the reviews page simply skips the toast
          }
          router.push(`/restaurant/${restaurantId}`);
        })
        .catch(() => {
          setPosting(false);
          setPostError(true);
        });
    } else {
      // ?fail=1: simulate a server failure so the kept-input path is testable
      window.setTimeout(() => {
        setPosting(false);
        setPostError(true);
      }, 600);
    }
  }

  function goBack() {
    if (posting) return;
    if (hasInput()) {
      setDlgOpen(true);
    } else {
      router.push(`/restaurant/${restaurantId}`);
    }
  }

  if (loadFailedStatus !== null) {
    return (
      <main className="mx-auto max-w-[480px] px-6 py-16 text-[var(--text)]">
        <p className="text-[var(--secondary)]">
          {loadFailedStatus === 404
            ? "This restaurant does not exist, so there is nothing to review."
            : "The kitchen did not answer just now - a network hiccup, not your fault. Refresh the page."}{" "}
          <Link href={`/restaurant/${restaurantId}`} className="text-[var(--brand)] underline underline-offset-2">
            Back
          </Link>
        </p>
      </main>
    );
  }

  const atLimit = rows.length >= MAX_DISHES;
  const visibleSuggestions = suggestions.filter((s) => !rows.some((r) => norm(r.name) === norm(s)));

  return (
    <div className="mx-auto max-w-[480px]">
      {/* top bar */}
      <header className="px-4 pt-4 text-[var(--text)]">
        <div className="flex items-center gap-2.5">
          <button
            ref={backRef}
            type="button"
            aria-label="Back to reviews"
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[var(--skip-bg)]"
            onClick={goBack}
          >
            <BackIcon />
          </button>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
            <span className="text-[var(--brand)]">Zomato</span>
            <span>-Lite</span>
          </span>
        </div>
        <h1 className="mt-2.5 text-2xl font-semibold leading-tight">{restaurant ? restaurant.name : "Loading…"}</h1>
        {restaurant && (
          <p className="m-0 mt-0.5 text-[13px] text-[var(--secondary)]">
            {restaurant.cuisine} · {restaurant.area}
          </p>
        )}
      </header>

      <main className="bg-[var(--bg)] px-4 pb-28 pt-2 text-[var(--text)]">
        {/* rating */}
        <section ref={rateRef} className="pt-4 pb-1 text-center" aria-labelledby="rateTitle">
          <p id="rateTitle" className="m-0 text-[13px] text-[var(--secondary)]">
            How was it?
          </p>
          <div className="mt-1.5 flex justify-center gap-2" role="radiogroup" aria-label="Rating" onKeyDown={starKeys}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={n <= rating}
                data-stars={n}
                aria-label={`${n} star${n === 1 ? "" : "s"}, ${WORDS[n]}`}
                onClick={() => selectStar(n, true)}
                className={`star-btn flex h-11 w-11 items-center justify-center rounded-[10px] p-0 transition-colors hover:-translate-y-0.5 ${
                  n <= rating ? "text-[var(--star)]" : "text-[var(--star-off)]"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-10 w-10">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            ))}
          </div>
          {/* the reserved 20px keeps the layout from jumping */}
          <p className="m-0 mt-1.5 min-h-[20px] text-[13px] font-semibold text-[var(--brand)]" aria-live="polite">
            {rating === 0 ? "" : WORDS[rating]}
          </p>
        </section>

        {/* dishes */}
        <section className="mt-7" aria-labelledby="dishHeading">
          <h2 id="dishHeading" className="m-0 text-[13px] font-semibold">
            What did you try?
            <span className="ml-1.5 text-[11px] font-semibold text-[var(--muted)]">Optional</span>
          </h2>

          {rows.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{r.name}</span>
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => toggleDishState(i, "rec")}
                      aria-pressed={r.state === "recommend"}
                      aria-label={`Recommend ${r.name}`}
                      className={`relative inline-flex items-center gap-1 rounded-full border px-2.5 py-[5px] text-[12px] font-semibold transition-colors ${
                        r.state === "recommend"
                          ? "border-transparent bg-[var(--rec-bg)] text-[var(--rec-text)]"
                          : "border-[var(--border)] bg-[var(--card)] text-[var(--secondary)] hover:border-[var(--secondary)]"
                      }`}
                    >
                      <UpIcon />
                      Recommend
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleDishState(i, "skip")}
                      aria-pressed={r.state === "skip"}
                      aria-label={`Skip ${r.name}`}
                      className={`relative inline-flex items-center gap-1 rounded-full border px-2.5 py-[5px] text-[12px] font-semibold transition-colors ${
                        r.state === "skip"
                          ? "border-[var(--secondary)] bg-[var(--skip-bg)] text-[var(--text)]"
                          : "border-[var(--border)] bg-[var(--card)] text-[var(--secondary)] hover:border-[var(--secondary)]"
                      }`}
                    >
                      <DownIcon />
                      Skip
                    </button>
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${r.name}`}
                    onClick={() => removeRow(i)}
                    className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--text)]"
                  >
                    <XIcon />
                  </button>
                </div>
              ))}
            </div>
          )}

          {visibleSuggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {visibleSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-disabled={atLimit}
                  onClick={() => (atLimit ? undefined : addDish(s))}
                  className={`relative inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3.5 py-[5px] text-[13px] font-semibold text-[var(--secondary)] hover:border-[var(--secondary)] hover:text-[var(--text)] ${
                    atLimit ? "cursor-default opacity-45" : ""
                  }`}
                >
                  <PlusIcon />
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className={atLimit ? "hidden" : "mt-1"}>
            <button
              type="button"
              aria-expanded={addOpen}
              aria-controls="addForm"
              onClick={() => {
                const open = !addOpen;
                setAddOpen(open);
                if (open) window.setTimeout(() => addInputRef.current?.focus(), 50);
              }}
              className="inline-flex min-h-[44px] items-center text-[13px] font-semibold text-[var(--brand)] underline underline-offset-2"
            >
              + Add a dish
            </button>
          </div>

          {addOpen && !atLimit && (
            <div id="addForm" className="mt-2.5 flex flex-col gap-2">
              <div className="flex gap-2">
                <label className="sr-only" htmlFor="dishInput">
                  Dish name
                </label>
                <input
                  ref={addInputRef}
                  id="dishInput"
                  type="text"
                  autoComplete="off"
                  placeholder="Type a dish name"
                  value={addText}
                  onChange={(e) => {
                    setAddText(e.target.value);
                    setDupMsg(null);
                    setAcOpen(e.target.value.trim().length > 0);
                  }}
                  onBlur={() => setAcOpen(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addDish(addText);
                    }
                    if (e.key === "Escape") setAcOpen(false);
                    if (e.key === "ArrowDown" && acOptions.length > 0) {
                      e.preventDefault();
                      document.querySelector<HTMLButtonElement>("#dishAc button")?.focus();
                    }
                  }}
                  aria-autocomplete="list"
                  aria-controls="dishAc"
                  aria-expanded={acOpen && acOptions.length > 0}
                  className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-[15px] text-[var(--text)] placeholder:text-[var(--muted)]"
                />
                <button
                  type="button"
                  onClick={() => addDish(addText)}
                  className="min-h-[44px] shrink-0 rounded-xl bg-[var(--brand)] px-4 text-[13px] font-semibold text-[var(--on-brand)] hover:bg-[var(--brand-hover)]"
                >
                  Add
                </button>
              </div>
              {acOpen && acOptions.length > 0 && (
                <div id="dishAc" role="listbox" aria-label="Dish suggestions"
                  className="flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setAcOpen(false);
                      addInputRef.current?.focus();
                    }
                  }}
                >
                  {acOptions.map((o) => (
                    <button
                      key={o}
                      type="button"
                      role="option"
                      // mousedown becomes click; without this the blurring input
                      // unmounts the list before the click ever lands
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addDish(o)}
                      className="flex min-h-[44px] items-center gap-1.5 px-3 py-2.5 text-left text-[14px] hover:bg-[var(--skip-bg)]"
                    >
                      <PlusIcon />
                      {o}
                    </button>
                  ))}
                </div>
              )}
              {!dupMsg || dupMsg.length === 0 ? null : (
                <p className="text-[12px] text-[var(--secondary)]" role="status" aria-live="polite">
                  {dupMsg}
                </p>
              )}
            </div>
          )}

          <p className={`mt-1.5 text-[12px] text-[var(--muted)] ${atLimit ? "" : "hidden"}`} id="dishLimitHelper">
            You can add up to 5 dishes
          </p>
        </section>

        {/* quick-start chips */}
        <section className="mt-7" aria-labelledby="starterTitle">
          <p id="starterTitle" className="m-0 text-[12px] text-[var(--secondary)]">
            Tap to start your review
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {STARTERS.map((ph) => {
              const on = starters.indexOf(ph) !== -1;
              return (
                <button
                  key={ph}
                  type="button"
                  aria-pressed={on}
                  aria-label={`Insert: ${ph}`}
                  onClick={() => toggleStarter(ph)}
                  className={`inline-flex min-h-[36px] items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-3.5 py-[5px] text-[13px] font-semibold transition-colors ${
                    on ? "border-transparent bg-[var(--text)] text-[var(--bg)]" : "text-[var(--secondary)] hover:border-[var(--secondary)] hover:text-[var(--text)]"
                  }`}
                >
                  {ph}
                </button>
              );
            })}
          </div>
        </section>

        {/* textarea + counter */}
        <section className="mt-7">
          <label className="sr-only" htmlFor="reviewText">
            Your review
          </label>
          <textarea
            id="reviewText"
            rows={4}
            maxLength={300}
            placeholder="Something honest, something useful."
            value={comment}
            onChange={(e) => {
              const next = e.target.value.slice(0, 300);
              setComment(next);
              saveDraft({ text: next });
            }}
            aria-describedby="charCounter"
            className="block min-h-[110px] w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-[15px] leading-[1.5] text-[var(--text)] placeholder:text-[var(--muted)]"
          />
          <p id="charCounter" className={`mt-1.5 mr-0.5 text-right text-[12px] transition-colors ${comment.length >= 290 ? "font-semibold text-[var(--brand)]" : "text-[var(--muted)]"}`}>
            {comment.length} / 300
          </p>
        </section>
      </main>

      {/* sticky submit bar - page colour + hairline, lifted above the keyboard */}
      <div ref={barLiftRef}>
        <footer
          ref={barRef}
          className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[480px] border-t border-[var(--border)] bg-[var(--bg)] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]"
        >
          <p
            role="status"
            id="ratingHelp"
            className={`mb-2 flex ml-0.5 items-center gap-1.5 text-[12px] text-[var(--secondary)] ${ratingHelp ? "" : "hidden"}`}
          >
            <InfoIcon />
            Choose a star rating to continue
          </p>
          <p role="alert" id="postError" className={`mb-2 flex ml-0.5 items-center gap-1.5 text-[12px] text-[var(--secondary)] ${postError ? "" : "hidden"}`}>
            <InfoIcon />
            Couldn&apos;t post your review. Try again.
          </p>
          <button
            type="button"
            aria-describedby="ratingHelp postError"
            aria-busy={posting}
            onClick={submit}
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold transition-colors ${
              posting ? "pointer-events-none opacity-85" : ""
            } ${rating === 0 ? "bg-[#E8E6E1] text-[var(--secondary)] hover:bg-[#E1DED7] dark:bg-[#2A2A28] dark:text-[#ABABA8] dark:hover:bg-[#333331]" : "bg-[var(--brand)] text-[var(--on-brand)] hover:bg-[var(--brand-hover)]"} ${shake ? "zt-shake" : ""} active:scale-[0.99]`}
          >
            {posting ? (
              <>
                <span className="zt-spin inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white motion-reduce:hidden" aria-hidden="true" />
                Posting…
              </>
            ) : (
              "Submit review"
            )}
          </button>
        </footer>
      </div>

      {/* discard dialog */}
      {dlgOpen && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4 dark:bg-black/55"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDlgOpen(false);
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="dlgTitle"
            className="flex w-[min(340px,100%)] flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <p id="dlgTitle" className="m-0 text-base font-semibold">
              Discard your review?
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 text-[14px] font-semibold hover:border-[var(--secondary)]"
                onClick={() => {
                  setDlgOpen(false);
                  backRef.current?.focus();
                }}
              >
                Keep writing
              </button>
              <button
                type="button"
                className="text-[13px] font-semibold text-[var(--brand)] underline underline-offset-2"
                onClick={() => {
                  clearDraft();
                  setDlgOpen(false);
                  router.push(`/restaurant/${restaurantId}`);
                }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
