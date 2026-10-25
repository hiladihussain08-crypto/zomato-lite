-- One restaurant. Facts only: what it is called, what it cooks, where it is.
INSERT INTO restaurants (name, cuisine, area)
VALUES ('Ludhiana Burrito', 'Indian', 'Sector 32');

-- Three reviews. created_at is deliberately spread out so "latest" means something.
-- NOW() - INTERVAL saves us from typed-in dates: these facts are always 8/6/2 days old.
INSERT INTO reviews (restaurant_id, rating, comment, created_at)
VALUES
  ((SELECT id FROM restaurants WHERE name = 'Ludhiana Burrito'), 5, 'Paneer burrito is unreal', NOW() - INTERVAL '8 days'),
  ((SELECT id FROM restaurants WHERE name = 'Ludhiana Burrito'), 4, 'Good, but slow service', NOW() - INTERVAL '6 days'),
  ((SELECT id FROM restaurants WHERE name = 'Ludhiana Burrito'), 4, 'Solid. Would repeat.', NOW() - INTERVAL '2 days');
