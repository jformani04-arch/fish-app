import { CatchLog } from "@/lib/catches";
import { normalizeWeatherCondition } from "@/lib/normalization/weather";
import { normalizeLocationName } from "@/lib/normalization/location";
import { normalizeSpeciesName } from "@/lib/normalization/species";
import { normalizeLureName } from "@/lib/normalization/lure";

export interface PersonalStats {
  totalCatches: number;
  uniqueSpecies: number;
  uniqueLocations: number;
  topSpecies: string | null;
  topLure: string | null;
  thisYearCatches: number;
  thisMonthCatches: number;
  daysSinceLastCatch: number | null;
}

export interface SpeciesCount {
  species: string;
  count: number;
  percentage: number;
}

export interface MonthlyActivity {
  label: string;
  yearMonth: string;
  count: number;
}

export interface LureCount {
  lure: string;
  count: number;
}

export interface LocationCount {
  location: string;
  count: number;
}

export interface WeatherCount {
  condition: string;
  count: number;
}

export interface TimeOfDayCount {
  period: string;
  count: number;
}

export interface SeasonCount {
  season: string;
  count: number;
}

export interface BigCatch {
  id: string;
  species: string;
  lengthRaw: string;
  weightRaw: string;
  lengthValue: number;
  weightValue: number;
  date: string;
  location: string;
}

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
}

export interface LocationPerformance {
  location: string;
  catchCount: number;
  avgLength: number | null;
  avgWeight: number | null;
  topSpecies: string | null;
}

export interface SpeciesAtLocation {
  species: string;
  count: number;
}

export interface SpeciesLocationMatrix {
  location: string;
  species: SpeciesAtLocation[];
}

export interface LureSpeciesEffectiveness {
  lure: string;
  species: SpeciesAtLocation[];
  totalCatches: number;
}

export interface TimeOfDayBySpecies {
  species: string;
  bestPeriod: string;
  periodCounts: { period: string; count: number }[];
}

export interface AnalyticsData {
  stats: PersonalStats;
  speciesBreakdown: SpeciesCount[];
  monthlyActivity: MonthlyActivity[];
  topLures: LureCount[];
  topLocations: LocationCount[];
  weatherBreakdown: WeatherCount[];
  timeOfDayBreakdown: TimeOfDayCount[];
  seasonBreakdown: SeasonCount[];
  biggestByLength: BigCatch | null;
  biggestByWeight: BigCatch | null;
  locationPerformance: LocationPerformance[];
  speciesLocationMatrix: SpeciesLocationMatrix[];
  lureEffectiveness: LureSpeciesEffectiveness[];
  topSpeciesByTimeOfDay: TimeOfDayBySpecies[];
}

function parseNumericValue(raw: string): number {
  if (!raw) return 0;
  const match = raw.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

function countBy(
  items: CatchLog[],
  keyFn: (item: CatchLog) => string
): Array<{ key: string; count: number }> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item).trim();
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function getTimeOfDayPeriod(dateStr: string): string {
  if (!dateStr) return "";
  const hour = new Date(dateStr).getHours();
  if (hour >= 5 && hour < 9) return "Dawn";
  if (hour >= 9 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 15) return "Midday";
  if (hour >= 15 && hour < 18) return "Afternoon";
  if (hour >= 18 && hour < 21) return "Evening";
  return "Night";
}

function getSeason(dateStr: string): string {
  if (!dateStr) return "";
  const month = new Date(dateStr).getMonth();
  if (month >= 2 && month <= 4) return "Spring";
  if (month >= 5 && month <= 7) return "Summer";
  if (month >= 8 && month <= 10) return "Fall";
  return "Winter";
}

export function computeAnalytics(catches: CatchLog[]): AnalyticsData {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();

  const synced = catches.filter((c) => c.date);

  // ----- Personal Stats -----
  const thisYearCatches = synced.filter(
    (c) => new Date(c.date).getFullYear() === thisYear
  ).length;

  const thisMonthCatches = synced.filter((c) => {
    const d = new Date(c.date);
    return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
  }).length;

  const sortedByDate = [...synced].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const lastCatchDate = sortedByDate[0]?.date ?? null;
  const daysSinceLastCatch = lastCatchDate
    ? Math.floor((now.getTime() - new Date(lastCatchDate).getTime()) / 86400000)
    : null;

  const speciesCounts = countBy(synced, (c) => normalizeSpeciesName(c.species));
  const lureCounts = countBy(synced, (c) => normalizeLureName(c.lure));
  const locationCounts = countBy(synced, (c) => normalizeLocationName(c.location));

  const uniqueSpecies = new Set(
    synced.map((c) => normalizeSpeciesName(c.species).toLowerCase()).filter(Boolean)
  ).size;
  const uniqueLocations = new Set(
    synced.map((c) => normalizeLocationName(c.location).toLowerCase()).filter(Boolean)
  ).size;

  const stats: PersonalStats = {
    totalCatches: catches.length,
    uniqueSpecies,
    uniqueLocations,
    topSpecies: speciesCounts[0]?.key ?? null,
    topLure: lureCounts[0]?.key ?? null,
    thisYearCatches,
    thisMonthCatches,
    daysSinceLastCatch,
  };

  // ----- Species Breakdown -----
  const totalWithSpecies = synced.filter((c) => c.species.trim()).length || 1;
  const speciesBreakdown: SpeciesCount[] = speciesCounts.slice(0, 8).map(({ key, count }) => ({
    species: key,
    count,
    percentage: Math.round((count / totalWithSpecies) * 100),
  }));

  // ----- Monthly Activity (last 12 months) -----
  const monthlyMap = new Map<string, number>();
  const months: MonthlyActivity[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(thisYear, now.getMonth() - i, 1);
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "short" });
    monthlyMap.set(yearMonth, 0);
    months.push({ label, yearMonth, count: 0 });
  }
  for (const c of synced) {
    const d = new Date(c.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyMap.has(key)) {
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + 1);
    }
  }
  const monthlyActivity: MonthlyActivity[] = months.map((m) => ({
    ...m,
    count: monthlyMap.get(m.yearMonth) ?? 0,
  }));

  // ----- Top Lures -----
  const topLures: LureCount[] = lureCounts.slice(0, 6).map(({ key, count }) => ({
    lure: key,
    count,
  }));

  // ----- Top Locations -----
  const topLocations: LocationCount[] = locationCounts.slice(0, 5).map(({ key, count }) => ({
    location: key,
    count,
  }));

  // ----- Weather Breakdown -----
  const weatherBreakdown: WeatherCount[] = countBy(synced, (c) =>
    normalizeWeatherCondition(c.weather)
  )
    .slice(0, 6)
    .map(({ key, count }) => ({ condition: key, count }));

  // ----- Time of Day -----
  const TOD_ORDER = ["Dawn", "Morning", "Midday", "Afternoon", "Evening", "Night"];
  const todRaw = countBy(synced, (c) => getTimeOfDayPeriod(c.date));
  const timeOfDayBreakdown: TimeOfDayCount[] = TOD_ORDER
    .map((period) => ({
      period,
      count: todRaw.find((x) => x.key === period)?.count ?? 0,
    }))
    .filter((x) => x.count > 0);

  // ----- Season Breakdown -----
  const SEASON_ORDER = ["Spring", "Summer", "Fall", "Winter"];
  const seasonRaw = countBy(synced, (c) => getSeason(c.date));
  const seasonBreakdown: SeasonCount[] = SEASON_ORDER
    .map((season) => ({
      season,
      count: seasonRaw.find((x) => x.key === season)?.count ?? 0,
    }))
    .filter((x) => x.count > 0);

  // ----- Biggest Catches -----
  const withSize = synced
    .filter((c) => c.species.trim())
    .map((c) => ({
      id: c.id,
      species: c.species,
      lengthRaw: c.length,
      weightRaw: c.weight,
      lengthValue: parseNumericValue(c.length),
      weightValue: parseNumericValue(c.weight),
      date: c.date,
      location: c.location,
    }));

  const biggestByLength =
    withSize.filter((c) => c.lengthValue > 0).sort((a, b) => b.lengthValue - a.lengthValue)[0] ??
    null;

  const biggestByWeight =
    withSize.filter((c) => c.weightValue > 0).sort((a, b) => b.weightValue - a.weightValue)[0] ??
    null;

  // ----- Location Performance -----
  const locationMap = new Map<string, { catches: CatchLog[] }>();
  for (const c of synced) {
    const loc = normalizeLocationName(c.location);
    if (!loc) continue;
    if (!locationMap.has(loc)) locationMap.set(loc, { catches: [] });
    locationMap.get(loc)!.catches.push(c);
  }

  const locationPerformance: LocationPerformance[] = [...locationMap.entries()]
    .map(([location, { catches: lCatches }]) => {
      const lengths = lCatches.map((c) => parseNumericValue(c.length)).filter((v) => v > 0);
      const weights = lCatches.map((c) => parseNumericValue(c.weight)).filter((v) => v > 0);
      const speciesCnt = new Map<string, number>();
      for (const c of lCatches) {
        const sp = normalizeSpeciesName(c.species);
        if (sp) speciesCnt.set(sp, (speciesCnt.get(sp) ?? 0) + 1);
      }
      const topSpecies = [...speciesCnt.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return {
        location,
        catchCount: lCatches.length,
        avgLength: lengths.length > 0 ? lengths.reduce((s, v) => s + v, 0) / lengths.length : null,
        avgWeight: weights.length > 0 ? weights.reduce((s, v) => s + v, 0) / weights.length : null,
        topSpecies,
      };
    })
    .sort((a, b) => b.catchCount - a.catchCount)
    .slice(0, 8);

  // ----- Species × Location Matrix (top 5 locations × their species) -----
  const speciesLocationMatrix: SpeciesLocationMatrix[] = locationPerformance
    .slice(0, 5)
    .map(({ location }) => {
      const lCatches = locationMap.get(location)?.catches ?? [];
      const spMap = new Map<string, number>();
      for (const c of lCatches) {
        const sp = normalizeSpeciesName(c.species);
        if (sp) spMap.set(sp, (spMap.get(sp) ?? 0) + 1);
      }
      const species: SpeciesAtLocation[] = [...spMap.entries()]
        .map(([sp, count]) => ({ species: sp, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      return { location, species };
    })
    .filter((m) => m.species.length > 0);

  // ----- Lure Effectiveness by Species (top 6 lures) -----
  const lureMap = new Map<string, Map<string, number>>();
  for (const c of synced) {
    const lure = normalizeLureName(c.lure);
    const species = normalizeSpeciesName(c.species);
    if (!lure || !species) continue;
    if (!lureMap.has(lure)) lureMap.set(lure, new Map());
    const spMap = lureMap.get(lure)!;
    spMap.set(species, (spMap.get(species) ?? 0) + 1);
  }

  const lureEffectiveness: LureSpeciesEffectiveness[] = [...lureMap.entries()]
    .map(([lure, spMap]) => {
      const species: SpeciesAtLocation[] = [...spMap.entries()]
        .map(([sp, count]) => ({ species: sp, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);
      return { lure, species, totalCatches: species.reduce((s, x) => s + x.count, 0) };
    })
    .sort((a, b) => b.totalCatches - a.totalCatches)
    .slice(0, 6);

  // ----- Time of Day by Species (top 3 species) -----
  const TOD_ORDER_INNER = ["Dawn", "Morning", "Midday", "Afternoon", "Evening", "Night"];
  const topSpeciesNames = speciesCounts.slice(0, 3).map((x) => x.key);
  const topSpeciesByTimeOfDay: TimeOfDayBySpecies[] = topSpeciesNames
    .map((species) => {
      const spCatches = synced.filter((c) => normalizeSpeciesName(c.species) === species && c.date);
      const periodCnt = new Map<string, number>();
      for (const c of spCatches) {
        const p = getTimeOfDayPeriod(c.date);
        if (p) periodCnt.set(p, (periodCnt.get(p) ?? 0) + 1);
      }
      const periodCounts = TOD_ORDER_INNER
        .filter((p) => periodCnt.has(p))
        .map((period) => ({ period, count: periodCnt.get(period) ?? 0 }));
      const bestPeriod = periodCounts.sort((a, b) => b.count - a.count)[0]?.period ?? "";
      return { species, bestPeriod, periodCounts };
    })
    .filter((x) => x.periodCounts.length > 0);

  return {
    stats,
    speciesBreakdown,
    monthlyActivity,
    topLures,
    topLocations,
    weatherBreakdown,
    timeOfDayBreakdown,
    seasonBreakdown,
    biggestByLength,
    biggestByWeight,
    locationPerformance,
    speciesLocationMatrix,
    lureEffectiveness,
    topSpeciesByTimeOfDay,
  };
}

// ── Filtering ─────────────────────────────────────────────────────────────────

export type AnalyticsDateRange = "week" | "month" | "3months" | "year";

export interface AnalyticsFilter {
  species: string | null;
  dateRange: AnalyticsDateRange | null;
  season: string | null;
  lure: string | null;
  weather: string | null;
}

export const EMPTY_FILTER: AnalyticsFilter = {
  species: null,
  dateRange: null,
  season: null,
  lure: null,
  weather: null,
};

export function isFilterActive(filter: AnalyticsFilter): boolean {
  return (
    filter.species !== null ||
    filter.dateRange !== null ||
    filter.season !== null ||
    filter.lure !== null ||
    filter.weather !== null
  );
}

function getDateRangeCutoffForFilter(range: AnalyticsDateRange): Date {
  const now = new Date();
  if (range === "week") return new Date(now.getTime() - 7 * 86400000);
  if (range === "month") return new Date(now.getTime() - 30 * 86400000);
  if (range === "3months") return new Date(now.getTime() - 90 * 86400000);
  return new Date(now.getFullYear(), 0, 1);
}

export function filterCatches(catches: CatchLog[], filter: AnalyticsFilter): CatchLog[] {
  let result = catches;
  if (filter.species) result = result.filter((c) => c.species === filter.species);
  if (filter.lure) result = result.filter((c) => c.lure === filter.lure);
  if (filter.weather)
    result = result.filter((c) => normalizeWeatherCondition(c.weather) === filter.weather);
  if (filter.season) result = result.filter((c) => c.date && getSeason(c.date) === filter.season);
  if (filter.dateRange) {
    const cutoff = getDateRangeCutoffForFilter(filter.dateRange);
    result = result.filter((c) => c.date && new Date(c.date) >= cutoff);
  }
  return result;
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

export function getHeatmapPoints(catches: CatchLog[]): HeatmapPoint[] {
  return catches
    .filter((c) => c.latitude != null && c.longitude != null)
    .map((c) => ({ latitude: c.latitude as number, longitude: c.longitude as number }));
}
