-- Phase 8: Backfill normalization for existing catch_log data.
--
-- Normalizes the four analytics-critical fields (species, lure, location, weather)
-- so that historical data groups correctly in analytics alongside new data written
-- through the TypeScript normalization layer.
--
-- Safety guarantees:
--   - All updates are wrapped in a transaction; rolls back fully on any error.
--   - Only rows where the normalized form differs from the stored value are touched.
--   - Original data is never deleted — only reformatted.
--   - Idempotent: safe to run multiple times.

BEGIN;

-- ─── Weather → canonical buckets ────────────────────────────────────────────
-- Maps the 12-option form list (and common free-text variants) to the 8
-- WEATHER_BUCKETS used by the TypeScript analytics pipeline.

UPDATE catch_logs
SET weather = CASE
  WHEN lower(trim(weather)) IN ('sunny', 'clear', 'clear skies', 'clear sky')
    THEN 'Sunny'
  WHEN lower(trim(weather)) IN ('partly cloudy', 'partially cloudy', 'part cloudy', 'partly clouds', 'some clouds')
    THEN 'Partly Cloudy'
  WHEN lower(trim(weather)) IN ('cloudy', 'clouds', 'overcast', 'dark cloudy', 'heavily cloudy')
    THEN 'Cloudy'
  WHEN lower(trim(weather)) IN ('rain', 'raining', 'rainy', 'light rain', 'heavy rain', 'drizzle', 'light drizzle')
    THEN 'Rain'
  WHEN lower(trim(weather)) IN ('thunderstorms', 'thunderstorm', 'thunder storms', 'heavy thunderstorm', 'severe thunderstorm', 'lightning', 'thunder and lightning', 'storms')
    THEN 'Thunderstorms'
  WHEN lower(trim(weather)) IN ('fog', 'foggy', 'mist', 'misty', 'haze', 'hazy')
    THEN 'Fog'
  WHEN lower(trim(weather)) IN ('snow', 'snowing', 'snowy', 'sleet', 'hail', 'snow/sleet')
    THEN 'Snow'
  WHEN lower(trim(weather)) IN ('windy', 'wind', 'high wind', 'strong wind', 'gusty winds', 'high winds')
    THEN 'Windy'
  ELSE trim(weather)
END
WHERE
  weather IS NOT NULL
  AND trim(weather) != ''
  AND weather IS DISTINCT FROM CASE
    WHEN lower(trim(weather)) IN ('sunny', 'clear', 'clear skies', 'clear sky') THEN 'Sunny'
    WHEN lower(trim(weather)) IN ('partly cloudy', 'partially cloudy', 'part cloudy', 'partly clouds', 'some clouds') THEN 'Partly Cloudy'
    WHEN lower(trim(weather)) IN ('cloudy', 'clouds', 'overcast', 'dark cloudy', 'heavily cloudy') THEN 'Cloudy'
    WHEN lower(trim(weather)) IN ('rain', 'raining', 'rainy', 'light rain', 'heavy rain', 'drizzle', 'light drizzle') THEN 'Rain'
    WHEN lower(trim(weather)) IN ('thunderstorms', 'thunderstorm', 'thunder storms', 'heavy thunderstorm', 'severe thunderstorm', 'lightning', 'thunder and lightning', 'storms') THEN 'Thunderstorms'
    WHEN lower(trim(weather)) IN ('fog', 'foggy', 'mist', 'misty', 'haze', 'hazy') THEN 'Fog'
    WHEN lower(trim(weather)) IN ('snow', 'snowing', 'snowy', 'sleet', 'hail', 'snow/sleet') THEN 'Snow'
    WHEN lower(trim(weather)) IN ('windy', 'wind', 'high wind', 'strong wind', 'gusty winds', 'high winds') THEN 'Windy'
    ELSE trim(weather)
  END;

-- ─── Species → title-cased + common alias expansion ─────────────────────────
-- Expands well-known shorthand to canonical names, then title-cases all values.
-- Postgres's initcap() is used for title-casing (handles simple word boundaries).
-- Species aliases mirror the TypeScript getCanonicalSpecies() function.

UPDATE catch_logs
SET species = CASE
  -- Shorthand/alias expansion (must come before general initcap)
  WHEN lower(trim(species)) = 'largemouth'          THEN 'Largemouth Bass'
  WHEN lower(trim(species)) = 'smallmouth'          THEN 'Smallmouth Bass'
  WHEN lower(trim(species)) = 'stripedstripe'       THEN 'Striped Bass'
  WHEN lower(trim(species)) = 'striped'             THEN 'Striped Bass'
  WHEN lower(trim(species)) IN ('lr', 'lmb')        THEN 'Largemouth Bass'
  WHEN lower(trim(species)) IN ('sm', 'smb')        THEN 'Smallmouth Bass'
  WHEN lower(trim(species)) = 'pike'                THEN 'Northern Pike'
  WHEN lower(trim(species)) = 'rainbow'             THEN 'Rainbow Trout'
  WHEN lower(trim(species)) = 'brown'               THEN 'Brown Trout'
  WHEN lower(trim(species)) = 'brook'               THEN 'Brook Trout'
  WHEN lower(trim(species)) = 'cutthroat'           THEN 'Cutthroat Trout'
  WHEN lower(trim(species)) = 'blue gill'           THEN 'Bluegill'
  WHEN lower(trim(species)) = 'bluegill sunfish'    THEN 'Bluegill'
  WHEN lower(trim(species)) = 'walleyed'            THEN 'Walleye'
  WHEN lower(trim(species)) = 'chinook'             THEN 'Chinook Salmon'
  WHEN lower(trim(species)) = 'coho'                THEN 'Coho Salmon'
  WHEN lower(trim(species)) = 'pink'                THEN 'Pink Salmon'
  WHEN lower(trim(species)) = 'chum'                THEN 'Chum Salmon'
  -- General: title-case everything else
  ELSE initcap(trim(species))
END
WHERE
  species IS NOT NULL
  AND trim(species) != ''
  AND species IS DISTINCT FROM CASE
    WHEN lower(trim(species)) = 'largemouth'          THEN 'Largemouth Bass'
    WHEN lower(trim(species)) = 'smallmouth'          THEN 'Smallmouth Bass'
    WHEN lower(trim(species)) = 'stripedstripe'       THEN 'Striped Bass'
    WHEN lower(trim(species)) = 'striped'             THEN 'Striped Bass'
    WHEN lower(trim(species)) IN ('lr', 'lmb')        THEN 'Largemouth Bass'
    WHEN lower(trim(species)) IN ('sm', 'smb')        THEN 'Smallmouth Bass'
    WHEN lower(trim(species)) = 'pike'                THEN 'Northern Pike'
    WHEN lower(trim(species)) = 'rainbow'             THEN 'Rainbow Trout'
    WHEN lower(trim(species)) = 'brown'               THEN 'Brown Trout'
    WHEN lower(trim(species)) = 'brook'               THEN 'Brook Trout'
    WHEN lower(trim(species)) = 'cutthroat'           THEN 'Cutthroat Trout'
    WHEN lower(trim(species)) = 'blue gill'           THEN 'Bluegill'
    WHEN lower(trim(species)) = 'bluegill sunfish'    THEN 'Bluegill'
    WHEN lower(trim(species)) = 'walleyed'            THEN 'Walleye'
    WHEN lower(trim(species)) = 'chinook'             THEN 'Chinook Salmon'
    WHEN lower(trim(species)) = 'coho'                THEN 'Coho Salmon'
    WHEN lower(trim(species)) = 'pink'                THEN 'Pink Salmon'
    WHEN lower(trim(species)) = 'chum'                THEN 'Chum Salmon'
    ELSE initcap(trim(species))
  END;

-- ─── Lure → title-cased ──────────────────────────────────────────────────────
-- Lures have no alias mapping — title-case and trim is the right normalization.

UPDATE catch_logs
SET lure = initcap(trim(lure))
WHERE
  lure IS NOT NULL
  AND trim(lure) != ''
  AND lure IS DISTINCT FROM initcap(trim(lure));

-- ─── Location → title-cased + trimmed ───────────────────────────────────────
-- Full location normalization (suffix removal, article handling) requires
-- TypeScript. The SQL migration covers trim + basic title-casing; the read-time
-- normalization in lib/analytics.ts handles remaining grouping consistency.

UPDATE catch_logs
SET location = initcap(trim(location))
WHERE
  location IS NOT NULL
  AND trim(location) != ''
  AND location IS DISTINCT FROM initcap(trim(location));

-- ─── Fishing spots → title-cased ─────────────────────────────────────────────
-- Spot names are user-defined and used in analytics grouping.

UPDATE fishing_spots
SET name = initcap(trim(name))
WHERE
  name IS NOT NULL
  AND trim(name) != ''
  AND name IS DISTINCT FROM initcap(trim(name));

COMMIT;
