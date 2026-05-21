import { AnalyticsData } from "@/lib/analytics";

export type InsightCategory =
  | "timing"
  | "location"
  | "technique"
  | "species"
  | "trend"
  | "record";

export interface Insight {
  id: string;
  title: string;
  description: string;
  category: InsightCategory;
  value: string;
  priority: number;
}

export function generateInsights(data: AnalyticsData): Insight[] {
  const {
    stats,
    speciesBreakdown,
    topLures,
    topLocations,
    weatherBreakdown,
    timeOfDayBreakdown,
    seasonBreakdown,
    monthlyActivity,
    biggestByLength,
    biggestByWeight,
    locationPerformance,
  } = data;

  if (stats.totalCatches < 3) return [];

  const insights: Insight[] = [];
  const total = stats.totalCatches;

  // --- Personal record (always highest priority if exists) ---
  if (biggestByLength) {
    insights.push({
      id: "record-length",
      title: "Personal best",
      description: `${biggestByLength.species}${biggestByLength.location ? ` · ${biggestByLength.location}` : ""}`,
      category: "record",
      value: biggestByLength.lengthRaw || "—",
      priority: 10,
    });
  } else if (biggestByWeight) {
    insights.push({
      id: "record-weight",
      title: "Personal best",
      description: `${biggestByWeight.species}${biggestByWeight.location ? ` · ${biggestByWeight.location}` : ""}`,
      category: "record",
      value: biggestByWeight.weightRaw || "—",
      priority: 10,
    });
  }

  // --- Monthly trend ---
  const recent = monthlyActivity[monthlyActivity.length - 1];
  const prev = monthlyActivity[monthlyActivity.length - 2];
  if (recent && prev) {
    const diff = recent.count - prev.count;
    if (diff > 0) {
      insights.push({
        id: "trend-up",
        title: "Momentum building",
        description: `${diff} more catch${diff !== 1 ? "es" : ""} than last month`,
        category: "trend",
        value: `+${diff}`,
        priority: 9,
      });
    } else if (diff < 0 && prev.count > 0) {
      insights.push({
        id: "trend-down",
        title: "Quieter this month",
        description: `${Math.abs(diff)} fewer catches than last month`,
        category: "trend",
        value: String(diff),
        priority: 4,
      });
    } else if (diff === 0 && recent.count > 0) {
      insights.push({
        id: "trend-steady",
        title: "Consistent pace",
        description: `Same as last month — ${recent.count} catch${recent.count !== 1 ? "es" : ""}`,
        category: "trend",
        value: `${recent.count}`,
        priority: 5,
      });
    }
  }

  // --- Go-to lure ---
  if (topLures.length > 0) {
    const best = topLures[0];
    const pct = Math.round((best.count / total) * 100);
    if (pct >= 20) {
      insights.push({
        id: "top-lure",
        title: "Go-to lure",
        description: `Accounts for ${pct}% of your catches`,
        category: "technique",
        value: best.lure,
        priority: 9,
      });
    }
  }

  // --- Favorite water ---
  if (topLocations.length > 0) {
    const best = topLocations[0];
    insights.push({
      id: "top-location",
      title: "Favorite water",
      description: `${best.count} catch${best.count !== 1 ? "es" : ""} logged here`,
      category: "location",
      value: best.location,
      priority: 8,
    });
  }

  // --- Peak fishing window ---
  if (timeOfDayBreakdown.length > 0) {
    const best = timeOfDayBreakdown[0];
    const pct = Math.round((best.count / total) * 100);
    if (pct >= 25) {
      insights.push({
        id: "best-time",
        title: "Peak fishing window",
        description: `${pct}% of your catches happen at ${best.period.toLowerCase()}`,
        category: "timing",
        value: best.period,
        priority: 8,
      });
    }
  }

  // --- Most productive season ---
  if (seasonBreakdown.length > 0) {
    const best = seasonBreakdown[0];
    const pct = Math.round((best.count / total) * 100);
    if (pct >= 30) {
      insights.push({
        id: "best-season",
        title: "Most productive season",
        description: `${pct}% of all your catches`,
        category: "timing",
        value: best.season,
        priority: 7,
      });
    }
  }

  // --- Signature species ---
  if (speciesBreakdown.length > 0) {
    const best = speciesBreakdown[0];
    insights.push({
      id: "top-species",
      title: "Your signature species",
      description: `${best.count} catch${best.count !== 1 ? "es" : ""} · ${best.percentage}% of total`,
      category: "species",
      value: best.species,
      priority: 7,
    });
  }

  // --- Best weather ---
  if (weatherBreakdown.length > 0) {
    const best = weatherBreakdown[0];
    const pct = Math.round((best.count / total) * 100);
    if (pct >= 30) {
      insights.push({
        id: "best-weather",
        title: "Preferred conditions",
        description: `${pct}% of catches in ${best.condition.toLowerCase()} weather`,
        category: "technique",
        value: best.condition,
        priority: 6,
      });
    }
  }

  // --- Big fish territory ---
  // Find the spot with the best average fish size (minimum 3 catches with size data).
  const bestSizeSpot = locationPerformance
    .filter((loc) => loc.avgLength !== null && loc.catchCount >= 3)
    .sort((a, b) => (b.avgLength ?? 0) - (a.avgLength ?? 0))[0];
  if (bestSizeSpot?.avgLength) {
    insights.push({
      id: "best-size-location",
      title: "Big fish territory",
      description: `Avg ${bestSizeSpot.avgLength.toFixed(0)} cm per catch`,
      category: "location",
      value: bestSizeSpot.location,
      priority: 7,
    });
  }

  // --- Gaining momentum (3-month rolling comparison) ---
  // Shows when the last 3 months outpace the prior 3 months by a meaningful margin.
  if (monthlyActivity.length >= 6) {
    const last3 = monthlyActivity.slice(-3).reduce((s, m) => s + m.count, 0);
    const prev3 = monthlyActivity.slice(-6, -3).reduce((s, m) => s + m.count, 0);
    const gain = last3 - prev3;
    if (gain >= 3 && prev3 > 0) {
      insights.push({
        id: "trend-quarter-up",
        title: "Gaining momentum",
        description: `${gain} more catch${gain !== 1 ? "es" : ""} vs. the prior 3 months`,
        category: "trend",
        value: `+${gain}`,
        priority: 8,
      });
    }
  }

  return insights.sort((a, b) => b.priority - a.priority).slice(0, 6);
}

export const INSIGHT_CATEGORY_COLORS: Record<InsightCategory, string> = {
  timing: "#38bdf8",
  location: "#4ade80",
  technique: "#c084fc",
  species: "#fb923c",
  trend: "#facc15",
  record: "#f43f5e",
};

export const INSIGHT_CATEGORY_LABELS: Record<InsightCategory, string> = {
  timing: "Timing",
  location: "Location",
  technique: "Technique",
  species: "Species",
  trend: "Trend",
  record: "Record",
};
