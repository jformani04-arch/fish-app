import AuthForm from "@/components/auth_card";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "@/lib/colors";

export default function LoginScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>←</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>Log in to Anglr</Text>
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  backText: {
    color: COLORS.text,
    fontSize: 18,
  },
});
