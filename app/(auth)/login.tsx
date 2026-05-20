import AuthForm from "@/components/AuthForm";
import { COLORS } from "@/lib/colors";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        hitSlop={8}
      >
        <ChevronLeft color={COLORS.text} size={22} strokeWidth={2} />
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>Log in to FishForge</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>
      </View>

      <AuthForm mode="login" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },

  header: {
    marginBottom: 32,
  },

  title: {
    color: COLORS.text,
    fontSize: 34,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },

  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: "center",
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "rgba(221,220,219,0.08)",
    borderWidth: 1,
    borderColor: "rgba(221,220,219,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  pressed: {
    opacity: 0.65,
  },
});
