import { useAuth } from "@/auth/AuthProvider";
import { useSubscription } from "@/auth/SubscriptionProvider";
import { ProBadge } from "@/components/ProBadge";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { COLORS } from "@/lib/colors";
import { CatchLog, getUserCatchLogs } from "@/lib/catches";
import {
  AnalyticsData,
  AnalyticsFilter,
  AnalyticsDateRange,
  BigCatch,
  EMPTY_FILTER,
  LocationPerformance,
  LureCount,
  LureSpeciesEffectiveness,
  MonthlyActivity,
  SeasonCount,
  SpeciesCount,
  TimeOfDayCount,
  TimeOfDayBySpecies,
  WeatherCount,
  computeAnalytics,
  filterCatches,
  isFilterActive,
} from "@/lib/analytics";
import {
  Insight,
  INSIGHT_CATEGORY_COLORS,
  INSIGHT_CATEGORY_LABELS,
  generateInsights,
} from "@/lib/insights";
import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  BarChart2,
  ChevronLeft,
  Clock,
  Fish,
  Flame,
  MapPin,
  Moon,
  Ruler,
  SlidersHorizontal,
  Star,
  Sun,
  Target,
  TrendingUp,
  Trophy,
  Weight,
  Wind,
  X,
} from "lucide-react-native";
import type { InsightCategory } from "@/lib/insights";

// ── Insight card icon map ────────────────────────────────────────────────────

const CATEGORY_ICON: Record<InsightCategory, React.ComponentType<{ size: number; color: string; strokeWidth?: number }>> = {
  timing: Clock,
  location: MapPin,
  technique: Target,
  species: Fish,
  trend: TrendingUp,
  record: Trophy,
};

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return <Text style={sc.sectionLabel}>{children}</Text>;
}

function StatCard({ value, label, sub }: { value: string | number; label: string; sub?: string }) {
  return (
    <View style={sc.statCard}>
      <Text style={sc.statValue}>{value}</Text>
      <Text style={sc.statLabel}>{label}</Text>
      {sub ? <Text style={sc.statSub}>{sub}</Text> : null}
    </View>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const color = INSIGHT_CATEGORY_COLORS[insight.category];
  const Icon = CATEGORY_ICON[insight.category];
  return (
    <View style={[sc.insightCard, { borderLeftColor: color }]}>
      <View style={sc.insightTop}>
        <View style={[sc.insightIconWrap, { backgroundColor: `${color}18` }]}>
          <Icon size={13} color={color} strokeWidth={2.2} />
        </View>
        <Text style={[sc.insightCategoryLabel, { color }]}>
          {INSIGHT_CATEGORY_LABELS[insight.category].toUpperCase()}
        </Text>
      </View>
      <Text style={sc.insightValue} numberOfLines={2}>
        {insight.value}
      </Text>
      <Text style={sc.insightTitle} numberOfLines={1}>
        {insight.title}
      </Text>
      <Text style={sc.insightDesc} numberOfLines={2}>
        {insight.description}
      </Text>
    </View>
  );
}

function ActiveFilterChips({
  filter,
  onClear,
  onRemove,
}: {
  filter: AnalyticsFilter;
  onClear: () => void;
  onRemove: (key: keyof AnalyticsFilter) => void;
}) {
  const DATE_LABELS: Record<AnalyticsDateRange, string> = {
    week: "Last 7 Days",
    month: "Last 30 Days",
    "3months": "Last 3 Months",
    year: "This Year",
  };
  const chips: { key: keyof AnalyticsFilter; label: string }[] = [];
  if (filter.dateRange) chips.push({ key: "dateRange", label: DATE_LABELS[filter.dateRange] });
  if (filter.species) chips.push({ key: "species", label: filter.species });
  if (filter.season) chips.push({ key: "season", label: filter.season });
  if (filter.lure) chips.push({ key: "lure", label: filter.lure });

  if (chips.length === 0) return null;

  return (
    <View style={sc.activeChipsRow}>
      {chips.map(({ key, label }) => (
        <Pressable key={key} style={sc.activeChip} onPress={() => onRemove(key)}>
          <Text style={sc.activeChipText}>{label}</Text>
          <X size={10} color={COLORS.primary} strokeWidth={2.5} />
        </Pressable>
      ))}
      {chips.length > 1 && (
        <Pressable style={sc.clearAllChip} onPress={onClear}>
          <Text style={sc.clearAllText}>Clear all</Text>
        </Pressable>
      )}
    </View>
  );
}

function HBar({ label, count, max, accent }: { label: string; count: number; max: number; accent?: string }) {
  const pct = max > 0 ? count / max : 0;
  const color = accent ?? COLORS.primary;
  return (
    <View style={sc.hbarRow}>
      <Text style={sc.hbarLabel} numberOfLines={1}>{label}</Text>
      <View style={sc.hbarTrack}>
        <View style={[sc.hbarFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={sc.hbarCount}>{count}</Text>
    </View>
  );
}

function MonthlyBars({ data }: { data: MonthlyActivity[] }) {
  const max = Math.max(...data.map((m) => m.count), 1);
  const recent = data[data.length - 1];
  const prev = data[data.length - 2];
  const diff = recent && prev ? recent.count - prev.count : 0;

  return (
    <View>
      <View style={sc.monthBarsArea}>
        {data.map((m, i) => {
          const isLatest = i === data.length - 1;
          const barH = Math.max((m.count / max) * 64, m.count > 0 ? 3 : 0);
          return (
            <View key={m.yearMonth} style={sc.monthCol}>
              <View
                style={[
                  sc.monthBar,
                  {
                    height: barH,
                    backgroundColor: m.count === 0
                      ? "rgba(255,255,255,0.07)"
                      : isLatest
                      ? COLORS.primary
                      : "rgba(253,123,65,0.55)",
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={sc.monthLabelsRow}>
        {data.map((m) => (
          <Text key={m.yearMonth} style={sc.monthLabel}>{m.label}</Text>
        ))}
      </View>
      {(recent?.count > 0 || (prev?.count ?? 0) > 0) ? (
        <View style={sc.monthTrendRow}>
          <Text style={sc.monthTrendCurrent}>
            {recent?.count ?? 0} this month
          </Text>
          {diff !== 0 && (
            <Text style={[sc.monthTrendDiff, { color: diff > 0 ? "#4ade80" : "#f87171" }]}>
              {diff > 0 ? `↑ ${diff}` : `↓ ${Math.abs(diff)}`} vs last month
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function SeasonRow({ data }: { data: SeasonCount[] }) {
  const max = Math.max(...data.map((s) => s.count), 1);
  const SEASON_COLORS: Record<string, string> = {
    Spring: "#4ade80",
    Summer: "#facc15",
    Fall: "#fb923c",
    Winter: "#93c5fd",
  };
  return (
    <View style={{ gap: 8 }}>
      {data.map((s) => (
        <HBar key={s.season} label={s.season} count={s.count} max={max} accent={SEASON_COLORS[s.season] ?? COLORS.primary} />
      ))}
    </View>
  );
}

function RecordCard({ catch: c, type }: { catch: BigCatch; type: "length" | "weight" }) {
  const metric = type === "length" ? c.lengthRaw : c.weightRaw;
  const Icon = type === "length" ? Ruler : Weight;
  return (
    <View style={sc.recordCard}>
      <View style={sc.recordIconWrap}>
        <Icon size={20} color={COLORS.primary} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={sc.recordSpecies} numberOfLines={1}>{c.species}</Text>
        <Text style={sc.recordMetric}>{metric || "—"}</Text>
        {c.location ? (
          <View style={sc.recordLocRow}>
            <MapPin size={10} color={COLORS.textSecondary} />
            <Text style={sc.recordLoc} numberOfLines={1}>{c.location}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <View style={sc.emptySection}>
      <Text style={sc.emptySectionText}>{message}</Text>
    </View>
  );
}

function LocationPerformanceCard({ loc }: { loc: LocationPerformance }) {
  return (
    <View style={sc.locPerfCard}>
      <View style={sc.locPerfTop}>
        <MapPin size={13} color={COLORS.primary} strokeWidth={2} />
        <Text style={sc.locPerfName} numberOfLines={1}>{loc.location}</Text>
        <View style={sc.locPerfBadge}>
          <Text style={sc.locPerfBadgeText}>{loc.catchCount}</Text>
        </View>
      </View>
      <View style={sc.locPerfStats}>
        {loc.avgLength != null && (
          <View style={sc.locPerfStat}>
            <Ruler size={10} color={COLORS.textSecondary} strokeWidth={2} />
            <Text style={sc.locPerfStatText}>{loc.avgLength.toFixed(1)} avg len</Text>
          </View>
        )}
        {loc.avgWeight != null && (
          <View style={sc.locPerfStat}>
            <Weight size={10} color={COLORS.textSecondary} strokeWidth={2} />
            <Text style={sc.locPerfStatText}>{loc.avgWeight.toFixed(2)} avg wt</Text>
          </View>
        )}
        {loc.topSpecies && (
          <View style={sc.locPerfStat}>
            <Fish size={10} color={COLORS.primary} strokeWidth={2} />
            <Text style={[sc.locPerfStatText, { color: COLORS.primary }]} numberOfLines={1}>{loc.topSpecies}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function LureEffectivenessCard({ item }: { item: LureSpeciesEffectiveness }) {
  return (
    <View style={sc.lureEffCard}>
      <View style={sc.lureEffTop}>
        <Target size={13} color="#c084fc" strokeWidth={2} />
        <Text style={sc.lureEffName} numberOfLines={1}>{item.lure}</Text>
        <Text style={sc.lureEffCount}>{item.totalCatches} catches</Text>
      </View>
      <View style={sc.lureEffSpecies}>
        {item.species.map((sp) => (
          <View key={sp.species} style={sc.lureEffSpeciesChip}>
            <Text style={sc.lureEffSpeciesText} numberOfLines={1}>{sp.species}</Text>
            <Text style={sc.lureEffSpeciesCount}>{sp.count}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SpeciesPeakCard({ item }: { item: TimeOfDayBySpecies }) {
  const max = Math.max(...item.periodCounts.map((p) => p.count), 1);
  return (
    <View style={sc.speciesPeakCard}>
      <View style={sc.speciesPeakTop}>
        <Fish size={13} color={COLORS.primary} strokeWidth={2} />
        <Text style={sc.speciesPeakName} numberOfLines={1}>{item.species}</Text>
        {item.bestPeriod ? (
          <View style={sc.speciesPeakBest}>
            <Text style={sc.speciesPeakBestText}>{item.bestPeriod}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ gap: 6, marginTop: 8 }}>
        {item.periodCounts.map((p) => (
          <HBar key={p.period} label={p.period} count={p.count} max={max} />
        ))}
      </View>
    </View>
  );
}

// ── Filter sheet ─────────────────────────────────────────────────────────────

const DATE_RANGE_OPTS: { value: AnalyticsDateRange | null; label: string }[] = [
  { value: null, label: "All Time" },
  { value: "week", label: "Last 7 Days" },
  { value: "month", label: "Last 30 Days" },
  { value: "3months", label: "Last 3 Months" },
  { value: "year", label: "This Year" },
];

const SEASON_OPTS = ["Spring", "Summer", "Fall", "Winter"];

function FilterSheet({
  filter,
  allCatches,
  onUpdate,
  onClose,
}: {
  filter: AnalyticsFilter;
  allCatches: CatchLog[];
  onUpdate: (patch: Partial<AnalyticsFilter>) => void;
  onClose: () => void;
}) {
  const species = useMemo(
    () => [...new Set(allCatches.map((c) => c.species).filter(Boolean))].sort(),
    [allCatches]
  );
  const lures = useMemo(
    () => [...new Set(allCatches.map((c) => c.lure).filter(Boolean))].sort(),
    [allCatches]
  );

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sc.sheetBackdrop} onPress={onClose} />
      <View style={sc.sheetContainer}>
        <View style={sc.sheetHandle} />
        <View style={sc.sheetHeader}>
          <Text style={sc.sheetTitle}>Filter Analytics</Text>
          <Pressable onPress={onClose} style={sc.sheetClose}>
            <X color={COLORS.textSecondary} size={18} strokeWidth={2} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Timeframe */}
          <Text style={sc.sheetSectionLabel}>Timeframe</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sc.filterChipRow}>
            {DATE_RANGE_OPTS.map((opt) => (
              <Pressable
                key={String(opt.value)}
                style={[sc.filterChip, filter.dateRange === opt.value && sc.filterChipActive]}
                onPress={() => onUpdate({ dateRange: opt.value })}
              >
                <Text style={[sc.filterChipText, filter.dateRange === opt.value && sc.filterChipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Season */}
          <Text style={[sc.sheetSectionLabel, { marginTop: 18 }]}>Season</Text>
          <View style={sc.filterChipRowWrap}>
            <Pressable
              style={[sc.filterChip, filter.season === null && sc.filterChipActive]}
              onPress={() => onUpdate({ season: null })}
            >
              <Text style={[sc.filterChipText, filter.season === null && sc.filterChipTextActive]}>All</Text>
            </Pressable>
            {SEASON_OPTS.map((s) => (
              <Pressable
                key={s}
                style={[sc.filterChip, filter.season === s && sc.filterChipActive]}
                onPress={() => onUpdate({ season: filter.season === s ? null : s })}
              >
                <Text style={[sc.filterChipText, filter.season === s && sc.filterChipTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>

          {/* Species */}
          {species.length > 0 && (
            <>
              <Text style={[sc.sheetSectionLabel, { marginTop: 18 }]}>Species</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sc.filterChipRow}>
                <Pressable
                  style={[sc.filterChip, filter.species === null && sc.filterChipActive]}
                  onPress={() => onUpdate({ species: null })}
                >
                  <Text style={[sc.filterChipText, filter.species === null && sc.filterChipTextActive]}>All</Text>
                </Pressable>
                {species.map((sp) => (
                  <Pressable
                    key={sp}
                    style={[sc.filterChip, filter.species === sp && sc.filterChipActive]}
                    onPress={() => onUpdate({ species: filter.species === sp ? null : sp })}
                  >
                    <Text style={[sc.filterChipText, filter.species === sp && sc.filterChipTextActive]}>{sp}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          {/* Lure */}
          {lures.length > 1 && (
            <>
              <Text style={[sc.sheetSectionLabel, { marginTop: 18 }]}>Lure</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sc.filterChipRow}>
                <Pressable
                  style={[sc.filterChip, filter.lure === null && sc.filterChipActive]}
                  onPress={() => onUpdate({ lure: null })}
                >
                  <Text style={[sc.filterChipText, filter.lure === null && sc.filterChipTextActive]}>All</Text>
                </Pressable>
                {lures.map((l) => (
                  <Pressable
                    key={l}
                    style={[sc.filterChip, filter.lure === l && sc.filterChipActive]}
                    onPress={() => onUpdate({ lure: filter.lure === l ? null : l })}
                  >
                    <Text style={[sc.filterChipText, filter.lure === l && sc.filterChipTextActive]}>{l}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function Analytics() {
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const [allCatches, setAllCatches] = useState<CatchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<AnalyticsFilter>(EMPTY_FILTER);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const catches = await getUserCatchLogs(user.id);
    setAllCatches(catches);
  }, [user]);

  useEffect(() => {
    if (!isFocused) return;
    setLoading(true);
    setLoadError(false);
    load()
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [isFocused, load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setLoadError(false);
    await load().catch(() => setLoadError(true));
    setRefreshing(false);
  }, [load]);

  const filteredCatches = useMemo(
    () => filterCatches(allCatches, filter),
    [allCatches, filter]
  );

  const data: AnalyticsData = useMemo(
    () => computeAnalytics(filteredCatches),
    [filteredCatches]
  );

  const insights: Insight[] = useMemo(() => generateInsights(data), [data]);

  const filterIsActive = isFilterActive(filter);

  const handleFilterUpdate = useCallback((patch: Partial<AnalyticsFilter>) => {
    setFilter((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleRemoveFilter = useCallback((key: keyof AnalyticsFilter) => {
    setFilter((prev) => ({ ...prev, [key]: null }));
  }, []);

  if (loading) {
    return (
      <View style={sc.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={sc.loadingText}>Crunching your data...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={sc.loadingContainer}>
        <BarChart2 size={40} color={COLORS.textSecondary} strokeWidth={1.5} />
        <Text style={sc.emptyStateTitle}>Couldn't load your data</Text>
        <Text style={sc.emptyStateText}>Check your connection and try again.</Text>
        <Pressable
          style={sc.emptyStateBtn}
          onPress={() => {
            setLoading(true);
            setLoadError(false);
            load()
              .catch(() => setLoadError(true))
              .finally(() => setLoading(false));
          }}
        >
          <Text style={sc.emptyStateBtnText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const { stats } = data;
  const hasAnyData = allCatches.length > 0;
  const hasFilteredData = filteredCatches.length > 0;

  const speciesMax = data.speciesBreakdown[0]?.count ?? 1;
  const lureMax = data.topLures[0]?.count ?? 1;
  const weatherMax = data.weatherBreakdown[0]?.count ?? 1;
  const todMax = Math.max(...data.timeOfDayBreakdown.map((x) => x.count), 1);

  const daysSub =
    stats.daysSinceLastCatch === 0
      ? "Today"
      : stats.daysSinceLastCatch === 1
      ? "Yesterday"
      : stats.daysSinceLastCatch != null
      ? `${stats.daysSinceLastCatch}d ago`
      : undefined;

  return (
    <>
      <ScrollView
        style={sc.container}
        contentContainerStyle={{ paddingBottom: 56 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Header */}
        <View style={[sc.header, { paddingTop: insets.top + 12 }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [sc.backBtn, pressed && sc.btnPressed]}
            hitSlop={12}
          >
            <ChevronLeft size={22} color={COLORS.text} />
          </Pressable>
          <Text style={sc.headerTitle}>Analytics</Text>
          <Pressable
            onPress={() => isPro ? setShowFilterSheet(true) : router.push("/pro")}
            style={({ pressed }) => [sc.filterBtn, filterIsActive && sc.filterBtnActive, pressed && sc.btnPressed]}
            hitSlop={8}
          >
            <SlidersHorizontal
              size={16}
              color={filterIsActive ? COLORS.primary : COLORS.textSecondary}
              strokeWidth={2.2}
            />
            {filterIsActive && <View style={sc.filterDot} />}
            {!isPro && (
              <View style={sc.filterProBadge}>
                <ProBadge size="xs" />
              </View>
            )}
          </Pressable>
        </View>

        {/* Active filter chips */}
        <ActiveFilterChips
          filter={filter}
          onClear={() => setFilter(EMPTY_FILTER)}
          onRemove={handleRemoveFilter}
        />

        {!hasAnyData ? (
          <View style={sc.emptyState}>
            <View style={sc.emptyIconWrap}>
              <BarChart2 size={40} color={COLORS.textSecondary} strokeWidth={1.5} />
            </View>
            <Text style={sc.emptyStateTitle}>Your insights are waiting</Text>
            <Text style={sc.emptyStateText}>
              Log your first catch and FishForge will start surfacing patterns — best times, top lures, and your most productive spots.
            </Text>
            <Pressable style={sc.emptyStateBtn} onPress={() => router.push("/log" as never)}>
              <Text style={sc.emptyStateBtnText}>Log First Catch</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* ── Insights ── */}
            {insights.length > 0 && (
              <>
                <SectionLabel>Intelligence</SectionLabel>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={sc.insightsScroll}
                  style={{ marginBottom: 16 }}
                >
                  {(isPro ? insights : insights.slice(0, 2)).map((insight) => (
                    <InsightCard key={insight.id} insight={insight} />
                  ))}
                  {!isPro && insights.length > 2 && (
                    <View style={sc.insightsUpgradeCard}>
                      <UpgradePrompt
                        compact
                        title="Unlock all insights"
                        description="See all intelligence cards with Pro"
                      />
                    </View>
                  )}
                </ScrollView>
              </>
            )}

            {/* ── Overview ── */}
            <SectionLabel>Overview</SectionLabel>
            <View style={sc.statsGrid}>
              <StatCard
                value={filterIsActive ? filteredCatches.length : stats.totalCatches}
                label={filterIsActive ? "Filtered Catches" : "Total Catches"}
              />
              <StatCard value={stats.uniqueSpecies} label="Species" />
            </View>
            <View style={sc.statsGrid}>
              <StatCard value={stats.thisYearCatches} label="This Year" />
              <StatCard value={stats.thisMonthCatches} label="This Month" sub={daysSub} />
            </View>

            {(stats.topSpecies || stats.topLure) && !filterIsActive ? (
              <View style={sc.highlightRow}>
                {stats.topSpecies ? (
                  <View style={sc.highlightChip}>
                    <Fish size={13} color={COLORS.primary} strokeWidth={2} />
                    <Text style={sc.highlightText} numberOfLines={1}>{stats.topSpecies}</Text>
                    <Text style={sc.highlightMeta}>top species</Text>
                  </View>
                ) : null}
                {stats.topLure ? (
                  <View style={sc.highlightChip}>
                    <Target size={13} color={COLORS.primary} strokeWidth={2} />
                    <Text style={sc.highlightText} numberOfLines={1}>{stats.topLure}</Text>
                    <Text style={sc.highlightMeta}>top lure</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {!hasFilteredData && filterIsActive ? (
              <View style={sc.noResultsCard}>
                <Star size={28} color={COLORS.textSecondary} strokeWidth={1.5} />
                <Text style={sc.noResultsText}>No catches match your current filters.</Text>
                <Pressable style={sc.noResultsBtn} onPress={() => setFilter(EMPTY_FILTER)}>
                  <Text style={sc.noResultsBtnText}>Clear Filters</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {/* ── Monthly Activity ── */}
                <SectionLabel>Monthly Activity</SectionLabel>
                <View style={sc.card}>
                  <MonthlyBars data={data.monthlyActivity} />
                </View>

                {/* ── Species ── */}
                <SectionLabel>Species Breakdown</SectionLabel>
                <View style={sc.card}>
                  {data.speciesBreakdown.length > 0 ? (
                    <View style={{ gap: 10 }}>
                      {data.speciesBreakdown.map((s: SpeciesCount) => (
                        <HBar key={s.species} label={s.species} count={s.count} max={speciesMax} />
                      ))}
                    </View>
                  ) : (
                    <EmptySection message="No species data yet." />
                  )}
                </View>

                {/* ── Lures ── */}
                <SectionLabel>Top Lures</SectionLabel>
                <View style={sc.card}>
                  {data.topLures.length > 0 ? (
                    <View style={{ gap: 10 }}>
                      {data.topLures.map((l: LureCount) => (
                        <HBar key={l.lure} label={l.lure} count={l.count} max={lureMax} accent="#c084fc" />
                      ))}
                    </View>
                  ) : (
                    <EmptySection message="No lure data recorded yet." />
                  )}
                </View>

                {/* ── Locations ── */}
                <SectionLabel>Top Locations</SectionLabel>
                <View style={sc.card}>
                  {data.topLocations.length > 0 ? (
                    <View style={{ gap: 10 }}>
                      {data.topLocations.map((loc, i) => (
                        <View key={loc.location} style={sc.locationRow}>
                          <Text style={sc.locationRank}>#{i + 1}</Text>
                          <MapPin size={13} color={COLORS.primary} strokeWidth={2} />
                          <Text style={sc.locationName} numberOfLines={1}>{loc.location}</Text>
                          <View style={sc.locationBadge}>
                            <Text style={sc.locationBadgeText}>{loc.count}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <EmptySection message="No location data recorded yet." />
                  )}
                </View>

                {/* ── When You Fish ── */}
                <SectionLabel>When You Fish</SectionLabel>
                <View style={sc.twoCol}>
                  <View style={[sc.card, { flex: 1 }]}>
                    <View style={sc.cardInnerHeader}>
                      <Sun size={14} color={COLORS.primary} strokeWidth={2} />
                      <Text style={sc.cardInnerTitle}>Time of Day</Text>
                    </View>
                    {data.timeOfDayBreakdown.length > 0 ? (
                      <View style={{ gap: 8, marginTop: 10 }}>
                        {data.timeOfDayBreakdown.map((t: TimeOfDayCount) => (
                          <HBar key={t.period} label={t.period} count={t.count} max={todMax} />
                        ))}
                      </View>
                    ) : (
                      <EmptySection message="No data" />
                    )}
                  </View>
                  <View style={[sc.card, { flex: 1 }]}>
                    <View style={sc.cardInnerHeader}>
                      <Moon size={14} color={COLORS.primary} strokeWidth={2} />
                      <Text style={sc.cardInnerTitle}>Season</Text>
                    </View>
                    {data.seasonBreakdown.length > 0 ? (
                      <View style={{ marginTop: 10 }}>
                        <SeasonRow data={data.seasonBreakdown} />
                      </View>
                    ) : (
                      <EmptySection message="No data" />
                    )}
                  </View>
                </View>

                {/* ── Weather ── */}
                {data.weatherBreakdown.length > 0 ? (
                  <>
                    <SectionLabel>Weather Conditions</SectionLabel>
                    <View style={sc.card}>
                      <View style={sc.cardInnerHeader}>
                        <Wind size={14} color={COLORS.primary} strokeWidth={2} />
                        <Text style={sc.cardInnerTitle}>Catches by condition</Text>
                      </View>
                      <View style={{ gap: 10, marginTop: 10 }}>
                        {data.weatherBreakdown.map((w: WeatherCount) => (
                          <HBar key={w.condition} label={w.condition} count={w.count} max={weatherMax} accent="#67e8f9" />
                        ))}
                      </View>
                    </View>
                  </>
                ) : null}

                {/* ── Records ── */}
                {(data.biggestByLength || data.biggestByWeight) ? (
                  <>
                    <SectionLabel>Personal Records</SectionLabel>
                    <View style={sc.card}>
                      <View style={sc.cardInnerHeader}>
                        <Trophy size={14} color={COLORS.primary} strokeWidth={2} />
                        <Text style={sc.cardInnerTitle}>Best catches</Text>
                      </View>
                      <View style={{ gap: 10, marginTop: 10 }}>
                        {data.biggestByLength ? (
                          <RecordCard catch={data.biggestByLength} type="length" />
                        ) : null}
                        {data.biggestByWeight && data.biggestByWeight.id !== data.biggestByLength?.id ? (
                          <RecordCard catch={data.biggestByWeight} type="weight" />
                        ) : null}
                      </View>
                    </View>
                  </>
                ) : null}

                {/* ── Location Intelligence (Pro) ── */}
                {data.locationPerformance.length > 0 && (
                  <>
                    <SectionLabel>Location Intelligence</SectionLabel>
                    {isPro ? (
                      <View style={sc.card}>
                        <View style={sc.cardInnerHeader}>
                          <MapPin size={14} color={COLORS.primary} strokeWidth={2} />
                          <Text style={sc.cardInnerTitle}>Performance by spot</Text>
                        </View>
                        <View style={{ gap: 10, marginTop: 10 }}>
                          {data.locationPerformance.map((loc) => (
                            <LocationPerformanceCard key={loc.location} loc={loc} />
                          ))}
                        </View>
                      </View>
                    ) : (
                      <View style={sc.proGateCard}>
                        <UpgradePrompt
                          compact
                          title="Location Intelligence"
                          description="See avg size, top species, and performance data for each spot"
                        />
                      </View>
                    )}
                  </>
                )}

                {/* ── Lure × Species Effectiveness (Pro) ── */}
                {data.lureEffectiveness.length > 0 && (
                  <>
                    <SectionLabel>Lure Effectiveness</SectionLabel>
                    {isPro ? (
                      <View style={sc.card}>
                        <View style={sc.cardInnerHeader}>
                          <Target size={14} color="#c084fc" strokeWidth={2} />
                          <Text style={sc.cardInnerTitle}>Species breakdown by lure</Text>
                        </View>
                        <View style={{ gap: 10, marginTop: 10 }}>
                          {data.lureEffectiveness.map((item) => (
                            <LureEffectivenessCard key={item.lure} item={item} />
                          ))}
                        </View>
                      </View>
                    ) : (
                      <View style={sc.proGateCard}>
                        <UpgradePrompt
                          compact
                          title="Lure Intelligence"
                          description="See which species respond to each lure in your history"
                        />
                      </View>
                    )}
                  </>
                )}

                {/* ── Peak Times by Species (Pro) ── */}
                {data.topSpeciesByTimeOfDay.length > 0 && (
                  <>
                    <SectionLabel>Peak Times by Species</SectionLabel>
                    {isPro ? (
                      <View style={sc.card}>
                        <View style={sc.cardInnerHeader}>
                          <Clock size={14} color={COLORS.primary} strokeWidth={2} />
                          <Text style={sc.cardInnerTitle}>When each species bites</Text>
                        </View>
                        <View style={{ gap: 14, marginTop: 10 }}>
                          {data.topSpeciesByTimeOfDay.map((item) => (
                            <SpeciesPeakCard key={item.species} item={item} />
                          ))}
                        </View>
                      </View>
                    ) : (
                      <View style={sc.proGateCard}>
                        <UpgradePrompt
                          compact
                          title="Peak Time Analysis"
                          description="See when each species is most active based on your catch history"
                        />
                      </View>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {showFilterSheet && (
        <FilterSheet
          filter={filter}
          allCatches={allCatches}
          onUpdate={handleFilterUpdate}
          onClose={() => setShowFilterSheet(false)}
        />
      )}
    </>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: { color: COLORS.textSecondary, fontSize: 14 },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
  },

  header: {
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "rgba(221,220,219,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnPressed: {
    opacity: 0.65,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "rgba(221,220,219,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtnActive: {
    backgroundColor: "rgba(253,123,65,0.12)",
    borderWidth: 1,
    borderColor: "rgba(253,123,65,0.35)",
  },
  filterDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  filterProBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
  },

  insightsUpgradeCard: {
    width: 200,
    justifyContent: "center",
  },

  // Active filter chips
  activeChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(253,123,65,0.12)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(253,123,65,0.3)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  activeChipText: { color: COLORS.primary, fontSize: 12, fontWeight: "600" },
  clearAllChip: {
    backgroundColor: "rgba(221,220,219,0.08)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(221,220,219,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  clearAllText: { color: COLORS.textSecondary, fontSize: 12 },

  // Empty state
  emptyState: {
    marginTop: 60,
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  emptyStateTitle: { color: COLORS.text, fontSize: 20, fontWeight: "700" },
  emptyStateText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
  emptyStateBtn: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  emptyStateBtnText: { color: "#000", fontWeight: "700", fontSize: 14 },

  // No results (filtered empty)
  noResultsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    padding: 28,
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  noResultsText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  noResultsBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 4,
  },
  noResultsBtnText: { color: "#000", fontWeight: "700", fontSize: 13 },

  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    fontWeight: "600",
    marginBottom: 10,
    marginTop: 6,
  },

  // Insight cards
  insightsScroll: { gap: 10, paddingRight: 20, paddingBottom: 2 },
  insightCard: {
    width: 158,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderLeftWidth: 3,
    padding: 14,
    gap: 4,
  },
  insightTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  insightIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  insightCategoryLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  insightValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  insightTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
  },
  insightDesc: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },

  // Stat cards
  statsGrid: { flexDirection: "row", gap: 10, marginBottom: 10 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    padding: 16,
  },
  statValue: { color: COLORS.text, fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  statLabel: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  statSub: { color: COLORS.primary, fontSize: 11, marginTop: 2, fontWeight: "600" },

  // Highlight chips
  highlightRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  highlightChip: {
    flex: 1,
    backgroundColor: "rgba(253,123,65,0.10)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(253,123,65,0.25)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  highlightText: { color: COLORS.text, fontSize: 13, fontWeight: "600", flex: 1 },
  highlightMeta: { color: COLORS.textSecondary, fontSize: 10 },

  // Card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    padding: 16,
    marginBottom: 14,
  },
  cardInnerHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardInnerTitle: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "600" },
  twoCol: { flexDirection: "row", gap: 10, marginBottom: 0 },

  // Horizontal bar
  hbarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  hbarLabel: { color: COLORS.text, fontSize: 13, width: 90, flexShrink: 0 },
  hbarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 3,
    overflow: "hidden",
  },
  hbarFill: { height: 6, borderRadius: 3 },
  hbarCount: { color: COLORS.textSecondary, fontSize: 12, width: 24, textAlign: "right" },

  // Monthly bars
  monthBarsArea: {
    flexDirection: "row",
    height: 72,
    alignItems: "flex-end",
    gap: 3,
  },
  monthCol: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  monthBar: { width: "100%", borderRadius: 2 },
  monthLabelsRow: { flexDirection: "row", gap: 3, marginTop: 6 },
  monthLabel: { flex: 1, fontSize: 9, color: COLORS.textSecondary, textAlign: "center" },
  monthTrendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
  },
  monthTrendCurrent: { color: COLORS.textSecondary, fontSize: 12 },
  monthTrendDiff: { fontSize: 12, fontWeight: "700" },

  // Locations
  locationRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  locationRank: { color: COLORS.textSecondary, fontSize: 11, fontWeight: "700", width: 24 },
  locationName: { color: COLORS.text, fontSize: 13, flex: 1 },
  locationBadge: {
    backgroundColor: "rgba(253,123,65,0.15)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  locationBadgeText: { color: COLORS.primary, fontSize: 11, fontWeight: "700" },

  // Record card
  recordCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 12,
  },
  recordIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(253,123,65,0.12)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  recordSpecies: { color: COLORS.text, fontSize: 14, fontWeight: "700" },
  recordMetric: { color: COLORS.primary, fontSize: 13, fontWeight: "600", marginTop: 1 },
  recordLocRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  recordLoc: { color: COLORS.textSecondary, fontSize: 11, flexShrink: 1 },

  // Empty section
  emptySection: { paddingVertical: 8 },
  emptySectionText: { color: COLORS.textSecondary, fontSize: 13 },

  // Pro gate card
  proGateCard: {
    marginBottom: 14,
  },

  // Location performance card
  locPerfCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  locPerfTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locPerfName: { color: COLORS.text, fontSize: 13, fontWeight: "600", flex: 1 },
  locPerfBadge: {
    backgroundColor: "rgba(253,123,65,0.15)",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  locPerfBadgeText: { color: COLORS.primary, fontSize: 11, fontWeight: "700" },
  locPerfStats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  locPerfStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  locPerfStatText: { color: COLORS.textSecondary, fontSize: 11 },

  // Lure effectiveness card
  lureEffCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  lureEffTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lureEffName: { color: COLORS.text, fontSize: 13, fontWeight: "600", flex: 1 },
  lureEffCount: { color: COLORS.textSecondary, fontSize: 11 },
  lureEffSpecies: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  lureEffSpeciesChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(192,132,252,0.12)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(192,132,252,0.25)",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lureEffSpeciesText: { color: COLORS.text, fontSize: 11, fontWeight: "600" },
  lureEffSpeciesCount: { color: "#c084fc", fontSize: 10, fontWeight: "700" },

  // Species peak card
  speciesPeakCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 12,
  },
  speciesPeakTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  speciesPeakName: { color: COLORS.text, fontSize: 13, fontWeight: "600", flex: 1 },
  speciesPeakBest: {
    backgroundColor: "rgba(253,123,65,0.15)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  speciesPeakBestText: { color: COLORS.primary, fontSize: 10, fontWeight: "700" },

  // Filter sheet
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  sheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "75%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  sheetTitle: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: "700" },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(221,220,219,0.1)",
  },
  sheetSectionLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  filterChipRow: { gap: 8, paddingBottom: 4 },
  filterChipRowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 4 },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(221,220,219,0.06)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: "rgba(253,123,65,0.15)",
    borderColor: "rgba(253,123,65,0.45)",
  },
  filterChipText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "600" },
  filterChipTextActive: { color: COLORS.primary },
});
