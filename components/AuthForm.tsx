import { signInWithGoogle } from "@/auth/google";
import { router } from "expo-router";
import { useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { COLORS } from "@/lib/colors";

const google_icon = require("@/assets/images/google_icon.png");

type AuthMode = "login" | "register";

type AuthFormProps = {
  mode: AuthMode;
};

export default function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isLogin = mode === "login";

  return (
    <View style={styles.card}>
      <TextInput
        placeholder="hello@company.com"
        placeholderTextColor={COLORS.textSecondary}
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        placeholder="Your Password"
        placeholderTextColor={COLORS.textSecondary}
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />

      {isLogin && (
        <Text
          onPress={() => router.push("/forgot_password")}
          style={styles.forgotPassword}
        >
          Forgot Password?
        </Text>
      )}

      <Pressable
        style={[styles.button, loading && { opacity: 0.7 }]}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading
            ? "LOADING..."
            : isLogin
            ? "LOGIN"
            : "REGISTER"}
        </Text>
      </Pressable>

      <View style={styles.orContainer}>
        <View style={styles.line} />
        <Text style={styles.orText}>OR</Text>
        <View style={styles.line} />
      </View>

      <Pressable
        style={styles.googleButton}
        onPress={signInWithGoogle}
      >
        <Image source={google_icon} style={styles.googleIcon} />
        <Text style={styles.googleText}>
          {isLogin ? "Sign in with Google" : "Sign up with Google"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    padding: 20,
  },

  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    color: COLORS.text,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
    fontSize: 16,
  },

  forgotPassword: {
    color: COLORS.text,
    marginBottom: 12,
  },

  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },

  buttonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1,
  },

  orContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  orText: {
    marginHorizontal: 12,
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 1,
  },

  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: 10,
    backgroundColor: "#000",
  },

  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },

  googleText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
