/**
 * Analytics normalization engine.
 * Normalizes all catch dimensions for consistent grouping and aggregation.
 * Ensures analytics remain trustworthy and not diluted by inconsistent naming.
 */

import { CatchLog } from "@/lib/catches";
import { normalizeWeatherCondition } from "@/lib/normalization/weather";
import { normalizeLocationName } from "@/lib/normalization/location";
import { normalizeSpeciesName } from "@/lib/normalization/species";
import { normalizeLureName } from "@/lib/normalization/lure";

export interface NormalizedCatch extends CatchLog {
  speciesNormalized: string;
  lureNormalized: string;
  locationNormalized: string;
  weatherNormalized: string;
}

/**
 * Normalize a single catch for analytics purposes.
 * All string fields are normalized to ensure consistent grouping.
 */
export function normalizeCatch(catch_: CatchLog): NormalizedCatch {
  return {
    ...catch_,
    speciesNormalized: normalizeSpeciesName(catch_.species),
    lureNormalized: normalizeLureName(catch_.lure),
    locationNormalized: normalizeLocationName(catch_.location),
    weatherNormalized: normalizeWeatherCondition(catch_.weather),
  };
}

/**
 * Normalize a collection of catches for analytics.
 * Returns array of normalized catches with all fields normalized.
 */
export function normalizeCatches(catches: CatchLog[]): NormalizedCatch[] {
  return catches.map(normalizeCatch);
}

/**
 * Group normalized catches by a field and count occurrences.
 * Ensures consistent grouping using normalized values.
 */
export function groupByNormalized(
  catches: NormalizedCatch[],
  field: keyof NormalizedCatch
): Map<string, number> {
  const map = new Map<string, number>();

  for (const c of catches) {
    const value = String(c[field]).trim();
    if (!value) continue;
    map.set(value, (map.get(value) ?? 0) + 1);
  }

  return map;
}

/**
 * Get top N items from a group by count.
 * Useful for computing top species, lures, locations, etc.
 */
export function getTopByCount(
  grouping: Map<string, number>,
  limit: number = 10
): Array<{ name: string; count: number }> {
  return [...grouping.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Calculate unique count using normalized values.
 * Prevents fragmentation from duplicate entries with different casings.
 */
export function getUniqueCount(catches: NormalizedCatch[], field: keyof NormalizedCatch): number {
  return new Set(
    catches
      .map((c) => String(c[field]).trim())
      .filter(Boolean)
      .map((v) => v.toLowerCase())
  ).size;
}
