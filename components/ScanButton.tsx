import { COLORS } from "@/lib/colors";
import { router } from "expo-router";
import { Camera } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function ScanButton() {
  return (
    <Pressable
      onPress={() => router.push("/log/photoSelect")}
      style={({ pressed }) => [styles.primaryBubble, pressed && styles.pressed]}
    >
      <View style={styles.primaryIcon}>
        <Camera size={32} color="#fff" strokeWidth={2} />
      </View>
      <Text style={styles.primaryTitle}>Scan a Fish</Text>
      <Text style={styles.primarySubtitle}>
        Identify species &amp; log your catch
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryBubble: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  pressed: {
    opacity: 0.85,
  },
  primaryIcon: {
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.14)",
    padding: 16,
    marginBottom: 14,
  },
  primaryTitle: {
    fontSize: 19,
    color: "#fff",
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  primarySubtitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    marginTop: 4,
  },
});
