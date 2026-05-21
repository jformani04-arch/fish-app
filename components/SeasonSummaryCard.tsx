/**
 * Home-screen card showing the user's performance in the current season.
 * Only rendered when the user has ≥ 3 catches this season.
 */

import { COLORS } from "@/lib/colors";
import { SEASON_COLORS, SeasonalSummary } from "@/lib/retention";
import { ChevronRight, Fish, Leaf, MapPin, Snowflake, Sun, Wind } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";

interface Props {
  summary: SeasonalSummary;
  onPress?: () => void;
  style?: ViewStyle;
}

const SEASON_ICONS = {
  Spring: Leaf,
  Summer: Sun,
  Fall: Wind,
  Winter: Snowflake,
} as const;

export function SeasonSummaryCard({ summary, onPress, style }: Props) {
  const { season, year, catchCount, uniqueSpecies, topSpecies, topLocation } = summary;
  const accent = SEASON_COLORS[season];
  const Icon = SEASON_ICONS[season];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { borderColor: `${accent}30` },
        style,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      {/* Header row */}
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `${accent}18` }]}>
          <Icon size={14} color={accent} strokeWidth={2.2} />
        </View>
        <Text style={[styles.seasonLabel, { color: accent }]}>
          {season.toUpperCase()} {year}
        </Text>
        {onPress && (
          <ChevronRight size={14} color={COLORS.textSecondary} strokeWidth={2} style={styles.chevron} />
        )}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{catchCount}</Text>
          <Text style={styles.statLabel}>catches</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{uniqueSpecies}</Text>
          <Text style={styles.statLabel}>{uniqueSpecies === 1 ? "species" : "species"}</Text>
        </View>
      </View>

      {/* Top species / location pills */}
      {(topSpecies || topLocation) && (
        <View style={styles.pillRow}>
          {topSpecies && (
            <View style={[styles.pill, { backgroundColor: `${accent}12`, borderColor: `${accent}25` }]}>
              <Fish size={10} color={accent} strokeWidth={2.2} />
              <Text style={[styles.pillText, { color: accent }]} numberOfLines={1}>
                {topSpecies}
              </Text>
            </View>
          )}
          {topLocation && (
            <View style={[styles.pill, styles.pillNeutral]}>
              <MapPin size={10} color={COLORS.textSecondary} strokeWidth={2.2} />
              <Text style={[styles.pillText, { color: COLORS.textSecondary }]} numberOfLines={1}>
                {topLocation}
              </Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  pressed: { opacity: 0.72 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  seasonLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  chevron: {
    marginLeft: "auto",
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  stat: {
    gap: 2,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  pillRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillNeutral: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.09)",
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
    maxWidth: 130,
  },
});
