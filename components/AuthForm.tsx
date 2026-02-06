import { useState } from "react";
import { View, Text, TextInput, Pressable, Image, StyleSheet, Alert } from "react-native";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { signInWithGoogle } from "@/auth/google";
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

  const loginWithEmail = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          const { data: usersData, error: fetchError } = await supabase
            .from("profiles") 
            .select("id, email, app_metadata")
            .eq("email", email)
            .single();

          if (!fetchError && usersData?.app_metadata?.provider === "google") {
            return {
              success: false,
              error:
                "This account was created with Google. Please use the Google login button.",
            };
          }
        }

        return { success: false, error: error.message };
      }

      if (data.session) {
        router.replace("/(tabs)/home"); // redirect after successful login
        return { success: true, session: data.session };
      }

      return { success: false, error: "Unknown login error" };
    } catch (err) {
      console.log("Unexpected login error:", err);
      return { success: false, error: "Unexpected error" };
    }
  };

  // Function to handle email/password registration
  const registerWithEmail = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        router.replace("/(tabs)/home"); // redirect after registration
        return { success: true, user: data.user };
      }

      return { success: false, error: "Unknown registration error" };
    } catch (err) {
      console.log("Unexpected registration error:", err);
      return { success: false, error: "Unexpected error" };
    }
  };

  // Unified handler for the button
  const handleSubmit = async () => {
    setLoading(true);
    let result;
    if (isLogin) {
      result = await loginWithEmail(email, password);
    } else {
      result = await registerWithEmail(email, password);
    }
    setLoading(false);

    if (!result.success && result.error) {
      Alert.alert("Error", result.error);
    }
  };

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
        onPress={handleSubmit}
      >
        <Text style={styles.buttonText}>
          {loading ? "LOADING..." : isLogin ? "LOGIN" : "REGISTER"}
        </Text>
      </Pressable>

      <View style={styles.orContainer}>
        <View style={styles.line} />
        <Text style={styles.orText}>OR</Text>
        <View style={styles.line} />
      </View>

      <Pressable style={styles.googleButton} onPress={signInWithGoogle}>
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
