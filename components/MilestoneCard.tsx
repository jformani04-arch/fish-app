/**
 * Home-screen card celebrating a recently achieved milestone.
 * Only rendered when a catch or species threshold was crossed in the last 14 days.
 * Premium/outdoors aesthetic — celebratory but restrained.
 */

import { COLORS } from "@/lib/colors";
import { Milestone } from "@/lib/retention";
import { Award, Fish } from "lucide-react-native";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

interface Props {
  milestone: Milestone;
  style?: ViewStyle;
}

const GOLD = "#F4B942";

function formatDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

export function MilestoneCard({ milestone, style }: Props) {
  const { title, description, achievedAt, type } = milestone;

  return (
    <View style={[styles.card, style]}>
      {/* "New milestone" chip */}
      <View style={styles.chip}>
        <View style={styles.chipDot} />
        <Text style={styles.chipText}>NEW MILESTONE</Text>
      </View>

      {/* Content row */}
      <View style={styles.contentRow}>
        <View style={[styles.iconWrap, { backgroundColor: `${GOLD}15` }]}>
          {type === "species" ? (
            <Fish size={22} color={GOLD} strokeWidth={1.8} />
          ) : (
            <Award size={22} color={GOLD} strokeWidth={1.8} />
          )}
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          <Text style={styles.date}>Reached {formatDate(achievedAt)}</Text>
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
    borderColor: `${GOLD}28`,
    padding: 16,
    gap: 12,
  },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GOLD,
  },
  chipText: {
    color: GOLD,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  description: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  date: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
    opacity: 0.7,
  },
});
