import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { WifiOff } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function OfflineBanner() {
  const isOnline = useNetworkStatus();
  const insets = useSafeAreaInsets();

  // null = unknown (first probe pending) — don't flash the banner on cold start
  if (isOnline !== false) return null;

  return (
    <View style={[styles.banner, { top: insets.top + 8 }]} pointerEvents="none">
      <WifiOff size={12} color="#fff" strokeWidth={2.2} />
      <Text style={styles.label}>No connection — catches will sync when back online</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    backgroundColor: "rgba(30,30,34,0.92)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  label: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
});
