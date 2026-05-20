import { COLORS } from "@/lib/colors";
import { router } from "expo-router";
import { Crown } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ProBadge } from "@/components/ProBadge";

interface UpgradePromptProps {
  title?: string;
  description?: string;
  compact?: boolean;
}

export function UpgradePrompt({
  title = "Upgrade to FishForge Pro",
  description = "Unlock heatmaps, advanced analytics filters, and full fishing intelligence.",
  compact = false,
}: UpgradePromptProps) {
  if (compact) {
    return (
      <Pressable
        style={({ pressed }) => [styles.compact, pressed && styles.pressed]}
        onPress={() => router.push("/pro")}
      >
        <View style={styles.compactLeft}>
          <Crown size={14} color="#F4B942" strokeWidth={2} />
          <Text style={styles.compactText}>{title}</Text>
        </View>
        <ProBadge size="xs" />
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.push("/pro")}
    >
      <View style={styles.iconWrap}>
        <Crown size={22} color="#F4B942" strokeWidth={2} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          <ProBadge size="sm" />
        </View>
        <Text style={styles.description}>{description}</Text>
      </View>
      <View style={styles.arrow}>
        <Text style={styles.arrowText}>→</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(244,185,66,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(244,185,66,0.28)",
    padding: 14,
  },
  pressed: {
    opacity: 0.72,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(244,185,66,0.12)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { color: COLORS.text, fontSize: 14, fontWeight: "700" },
  description: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17 },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "rgba(244,185,66,0.15)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  arrowText: { color: "#F4B942", fontSize: 14, fontWeight: "700" },

  compact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(244,185,66,0.07)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(244,185,66,0.22)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  compactLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  compactText: { color: COLORS.text, fontSize: 13, fontWeight: "600" },
});
