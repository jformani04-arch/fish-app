-- Geospatial performance indexes for catch_logs and fishing_spots.
--
-- These indexes optimize bounding-box queries (viewport-based global pin loading),
-- species filtering, and date range filtering used by the map screen.
--
-- PostGIS geometry columns are prepared as comments below — uncomment and run
-- after enabling the PostGIS extension in your Supabase project dashboard
-- (Database → Extensions → postgis) to unlock full spatial query capabilities
-- including ST_DWithin, ST_Within, heatmap aggregation, and geospatial analytics.

begin;

-- ── catch_logs spatial indexes ────────────────────────────────────────────────

-- Composite partial index for bbox queries: WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
create index if not exists idx_catch_logs_coords
  on public.catch_logs (latitude, longitude)
  where latitude is not null and longitude is not null;

-- Species filtering index (used by map filter sheet)
create index if not exists idx_catch_logs_species
  on public.catch_logs (species)
  where species is not null;

-- Date filtering index (used by map filter sheet date range)
create index if not exists idx_catch_logs_date
  on public.catch_logs (date)
  where date is not null;

-- ── fishing_spots spatial indexes ─────────────────────────────────────────────

create index if not exists idx_fishing_spots_coords
  on public.fishing_spots (latitude, longitude);

create index if not exists idx_fishing_spots_user_id
  on public.fishing_spots (user_id);

-- ── PostGIS preparation (run after enabling postgis extension) ────────────────
--
-- Step 1: Enable PostGIS
--   In Supabase dashboard: Database → Extensions → enable "postgis"
--   Or: CREATE EXTENSION IF NOT EXISTS postgis;
--
-- Step 2: Add geometry columns
--   ALTER TABLE public.catch_logs
--     ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326)
--     GENERATED ALWAYS AS (
--       CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL
--         THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
--       END
--     ) STORED;
--
--   ALTER TABLE public.fishing_spots
--     ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326)
--     GENERATED ALWAYS AS (
--       ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
--     ) STORED;
--
-- Step 3: Spatial indexes (GIST for geometry)
--   CREATE INDEX IF NOT EXISTS idx_catch_logs_geom
--     ON public.catch_logs USING GIST (geom)
--     WHERE geom IS NOT NULL;
--
--   CREATE INDEX IF NOT EXISTS idx_fishing_spots_geom
--     ON public.fishing_spots USING GIST (geom);
--
-- With PostGIS active, bounding box queries can use:
--   WHERE geom && ST_MakeEnvelope(minLng, minLat, maxLng, maxLat, 4326)
-- and radius queries can use:
--   WHERE ST_DWithin(geom::geography, ST_MakePoint(lng, lat)::geography, radius_meters)

commit;
