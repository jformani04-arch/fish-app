/**
 * Retention and long-term engagement computations.
 *
 * All functions are pure/synchronous — they operate on already-loaded CatchLog
 * arrays and produce structured results for home-screen retention cards and
 * insight generation. No network calls, no async operations.
 */

import { CatchLog } from "@/lib/catches";
import { normalizeSpeciesName } from "@/lib/normalization/species";
import { normalizeLocationName } from "@/lib/normalization/location";
import { normalizeLureName } from "@/lib/normalization/lure";

// ─── Shared utilities ─────────────────────────────────────────────────────────

type Season = "Spring" | "Summer" | "Fall" | "Winter";

function getSeason(date: Date): Season {
  const m = date.getMonth();
  if (m >= 2 && m <= 4) return "Spring";
  if (m >= 5 && m <= 7) return "Summer";
  if (m >= 8 && m <= 10) return "Fall";
  return "Winter";
}

function topByFrequency(items: string[]): string | null {
  if (items.length === 0) return null;
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item) counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function calendarDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function daysBetweenKeys(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

// ─── Seasonal Summary ─────────────────────────────────────────────────────────

export interface SeasonalSummary {
  season: Season;
  year: number;
  catchCount: number;
  uniqueSpecies: number;
  topSpecies: string | null;
  topLocation: string | null;
  topLure: string | null;
}

export const SEASON_COLORS: Record<Season, string> = {
  Spring: "#4ade80",
  Summer: "#fb923c",
  Fall: "#f59e0b",
  Winter: "#38bdf8",
};

/**
 * Returns stats for the current season in the current calendar year.
 * Returns null if fewer than 3 catches this season (not meaningful to display).
 */
export function getSeasonalSummary(catches: CatchLog[]): SeasonalSummary | null {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentSeason = getSeason(now);

  const seasonCatches = catches.filter((c) => {
    if (!c.date) return false;
    const d = new Date(c.date);
    return d.getFullYear() === currentYear && getSeason(d) === currentSeason;
  });

  if (seasonCatches.length < 3) return null;

  const species = seasonCatches.map((c) => normalizeSpeciesName(c.species)).filter(Boolean);
  const locations = seasonCatches.map((c) => normalizeLocationName(c.location)).filter(Boolean);
  const lures = seasonCatches.map((c) => normalizeLureName(c.lure)).filter(Boolean);

  return {
    season: currentSeason,
    year: currentYear,
    catchCount: seasonCatches.length,
    uniqueSpecies: new Set(species.map((s) => s.toLowerCase())).size,
    topSpecies: topByFrequency(species),
    topLocation: topByFrequency(locations),
    topLure: topByFrequency(lures),
  };
}

// ─── Milestones ───────────────────────────────────────────────────────────────

const CATCH_THRESHOLDS = [1, 10, 25, 50, 100, 250, 500, 1000];
const SPECIES_THRESHOLDS = [1, 5, 10, 15, 20, 25, 50];
const NEW_MILESTONE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export interface Milestone {
  id: string;
  type: "catches" | "species";
  threshold: number;
  title: string;
  description: string;
  achievedAt: string;
  isNew: boolean;
}

export function getMilestones(catches: CatchLog[]): Milestone[] {
  if (catches.length === 0) return [];

  const sorted = [...catches].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const now = Date.now();
  const milestones: Milestone[] = [];

  for (const threshold of CATCH_THRESHOLDS) {
    if (sorted.length >= threshold) {
      const achievedAt = sorted[threshold - 1].date;
      milestones.push({
        id: `catches-${threshold}`,
        type: "catches",
        threshold,
        title: threshold === 1 ? "First Catch" : `${threshold} Catches`,
        description:
          threshold === 1 ? "Started your fishing history" : `${threshold} catches logged`,
        achievedAt,
        isNew: now - new Date(achievedAt).getTime() < NEW_MILESTONE_WINDOW_MS,
      });
    }
  }

  const seenSpecies = new Set<string>();
  const speciesAchievedAt = new Map<number, string>();
  for (const c of sorted) {
    const sp = normalizeSpeciesName(c.species).toLowerCase();
    if (!sp) continue;
    const prev = seenSpecies.size;
    seenSpecies.add(sp);
    if (seenSpecies.size > prev) {
      for (const threshold of SPECIES_THRESHOLDS) {
        if (seenSpecies.size === threshold && !speciesAchievedAt.has(threshold)) {
          speciesAchievedAt.set(threshold, c.date);
        }
      }
    }
  }

  for (const threshold of SPECIES_THRESHOLDS) {
    if (seenSpecies.size >= threshold) {
      const achievedAt = speciesAchievedAt.get(threshold) ?? sorted[0].date;
      milestones.push({
        id: `species-${threshold}`,
        type: "species",
        threshold,
        title: threshold === 1 ? "First Species" : `${threshold} Species`,
        description:
          threshold === 1 ? "First species logged" : `${threshold} different species caught`,
        achievedAt,
        isNew: now - new Date(achievedAt).getTime() < NEW_MILESTONE_WINDOW_MS,
      });
    }
  }

  return milestones;
}

/**
 * Returns the most impressive milestone achieved in the last 14 days,
 * or null if no recent milestones exist.
 */
export function getLatestNewMilestone(catches: CatchLog[]): Milestone | null {
  const all = getMilestones(catches);
  const fresh = all.filter((m) => m.isNew);
  if (fresh.length === 0) return null;
  return fresh.sort((a, b) => b.threshold - a.threshold)[0];
}

// ─── On This Day ──────────────────────────────────────────────────────────────

export interface OnThisDayEntry {
  yearsAgo: number;
  year: number;
  catchCount: number;
  topSpecies: string | null;
  topLocation: string | null;
  imageUrl: string | null;
}

/**
 * Returns catches made on this calendar day (month + day) in a prior year.
 * Uses the most recent prior year that has data. Returns null if none exist.
 */
export function getOnThisDay(catches: CatchLog[]): OnThisDayEntry | null {
  const today = new Date();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();
  const currentYear = today.getFullYear();

  const historical = catches.filter((c) => {
    if (!c.date) return false;
    const d = new Date(c.date);
    return (
      d.getMonth() === todayMonth &&
      d.getDate() === todayDay &&
      d.getFullYear() < currentYear
    );
  });

  if (historical.length === 0) return null;

  const byYear = new Map<number, CatchLog[]>();
  for (const c of historical) {
    const year = new Date(c.date).getFullYear();
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(c);
  }

  const mostRecentYear = Math.max(...byYear.keys());
  const dayCatches = byYear.get(mostRecentYear)!;

  const species = dayCatches.map((c) => normalizeSpeciesName(c.species)).filter(Boolean);
  const locations = dayCatches.map((c) => normalizeLocationName(c.location)).filter(Boolean);
  const firstWithImage = dayCatches.find((c) => !!c.imageUrl);

  return {
    yearsAgo: currentYear - mostRecentYear,
    year: mostRecentYear,
    catchCount: dayCatches.length,
    topSpecies: topByFrequency(species),
    topLocation: topByFrequency(locations),
    imageUrl: firstWithImage?.imageUrl ?? null,
  };
}

// ─── Fishing Streak ───────────────────────────────────────────────────────────

export interface FishingStreak {
  current: number;
  longest: number;
}

/**
 * Computes current and longest fishing streaks (consecutive calendar days
 * with at least one catch). The current streak is 0 if the last catch was
 * more than a day ago.
 */
export function getFishingStreak(catches: CatchLog[]): FishingStreak {
  const dateSet = new Set<string>();
  for (const c of catches) {
    if (c.date) dateSet.add(calendarDayKey(new Date(c.date)));
  }

  const dates = [...dateSet].sort();
  if (dates.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    if (daysBetweenKeys(dates[i - 1], dates[i]) === 1) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  const today = calendarDayKey(new Date());
  const yesterday = calendarDayKey(new Date(Date.now() - 86_400_000));
  const lastDate = dates[dates.length - 1];
  const streakActive = lastDate === today || lastDate === yesterday;

  if (!streakActive) return { current: 0, longest };

  let current = 1;
  for (let i = dates.length - 1; i > 0; i--) {
    if (daysBetweenKeys(dates[i - 1], dates[i]) === 1) {
      current++;
    } else {
      break;
    }
  }

  return { current, longest };
}
