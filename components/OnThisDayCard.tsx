/**
 * Home-screen memory card showing catches made on this calendar date in a prior year.
 * Only rendered when the user has historical data for today's date in past years.
 * Emotional/nostalgic tone — premium outdoor aesthetic.
 */

import { COLORS } from "@/lib/colors";
import { OnThisDayEntry } from "@/lib/retention";
import { Fish, MapPin } from "lucide-react-native";
import { Image, StyleSheet, Text, View, ViewStyle } from "react-native";

interface Props {
  entry: OnThisDayEntry;
  style?: ViewStyle;
}

const ACCENT = "#a78bfa"; // soft violet — memory / nostalgia

export function OnThisDayCard({ entry, style }: Props) {
  const { yearsAgo, catchCount, topSpecies, topLocation, imageUrl } = entry;

  const timeLabel = yearsAgo === 1 ? "1 year ago" : `${yearsAgo} years ago`;
  const catchLabel =
    catchCount === 1
      ? "1 catch"
      : `${catchCount} catches`;

  return (
    <View style={[styles.card, style]}>
      {/* Label row */}
      <View style={styles.labelRow}>
        <View style={[styles.labelDot, { backgroundColor: ACCENT }]} />
        <Text style={[styles.label, { color: ACCENT }]}>
          ON THIS DAY · {timeLabel.toUpperCase()}
        </Text>
      </View>

      {/* Content row */}
      <View style={styles.contentRow}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Fish size={20} color={ACCENT} strokeWidth={1.8} />
          </View>
        )}

        <View style={styles.textBlock}>
          {topSpecies ? (
            <Text style={styles.species} numberOfLines={1}>
              {topSpecies}
            </Text>
          ) : (
            <Text style={styles.species}>{catchLabel}</Text>
          )}

          {topLocation && (
            <View style={styles.locationRow}>
              <MapPin size={11} color={COLORS.textSecondary} strokeWidth={2} />
              <Text style={styles.location} numberOfLines={1}>
                {topLocation}
              </Text>
            </View>
          )}

          {topSpecies && catchCount > 1 && (
            <Text style={styles.extra}>
              +{catchCount - 1} more {catchCount - 1 === 1 ? "catch" : "catches"} that day
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: `${ACCENT}20`,
    padding: 16,
    gap: 12,
  },

  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  labelDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },

  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    flexShrink: 0,
  },
  thumbPlaceholder: {
    backgroundColor: `${ACCENT}12`,
    borderWidth: 1,
    borderColor: `${ACCENT}20`,
    alignItems: "center",
    justifyContent: "center",
  },

  textBlock: {
    flex: 1,
    gap: 4,
  },
  species: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  location: {
    color: COLORS.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  extra: {
    color: COLORS.textSecondary,
    fontSize: 12,
    opacity: 0.7,
  },
});
