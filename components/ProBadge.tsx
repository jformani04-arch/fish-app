import { StyleSheet, Text, View } from "react-native";

const PRO_GOLD = "#F4B942";

type Size = "xs" | "sm" | "md";

const SIZE_CONFIG: Record<Size, { fontSize: number; paddingH: number; paddingV: number; borderRadius: number }> = {
  xs: { fontSize: 7, paddingH: 3, paddingV: 1, borderRadius: 3 },
  sm: { fontSize: 9, paddingH: 5, paddingV: 2, borderRadius: 4 },
  md: { fontSize: 11, paddingH: 7, paddingV: 3, borderRadius: 5 },
};

export function ProBadge({ size = "sm" }: { size?: Size }) {
  const cfg = SIZE_CONFIG[size];
  return (
    <View
      style={[
        styles.badge,
        {
          paddingHorizontal: cfg.paddingH,
          paddingVertical: cfg.paddingV,
          borderRadius: cfg.borderRadius,
        },
      ]}
    >
      <Text style={[styles.text, { fontSize: cfg.fontSize }]}>PRO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: PRO_GOLD,
  },
  text: {
    color: "#000",
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
