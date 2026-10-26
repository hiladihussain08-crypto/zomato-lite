CREATE TABLE restaurants (
  id        SERIAL PRIMARY KEY,
  name      TEXT NOT NULL,
  cuisine   TEXT NOT NULL,
  area      TEXT NOT NULL
);

CREATE TABLE reviews (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dish verdicts: one row per (review, dish). Counts are computed by GROUP BY
-- at read time, never stored. The unique lower(name) index makes 'Paneer
-- burrito' and 'paneer burrito' the same dish within one review.
CREATE TABLE review_dishes (
  id         SERIAL PRIMARY KEY,
  review_id  INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  state      TEXT NOT NULL CHECK (state IN ('recommend', 'skip')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_review_dish ON review_dishes (review_id, lower(name));

-- Helpful votes: primary key (review_id, voter_key) enforces one vote per
-- browser. The voter key is an anonymous random id living in localStorage.
CREATE TABLE helpful_votes (
  review_id  INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  voter_key  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (review_id, voter_key)
);
