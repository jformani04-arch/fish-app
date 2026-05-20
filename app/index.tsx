import { useFonts } from "expo-font";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import {
  ImageBackground,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../lib/colors";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function App() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    "Playfair Display": require("../assets/fonts/PlayfairDisplay-Bold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ImageBackground
        source={require("../assets/images/splashScreenIcon.png")}
        style={styles.background}
        imageStyle={{ opacity: 0.5 }}
      >
        <View style={styles.content}>
          {/* Top Section */}
          <View style={styles.topSection}>
            <Text style={styles.appName}>FishForge</Text>

            <View style={styles.tagline}>
              <Text style={styles.taglineText}>Track catches</Text>
              <Text style={styles.taglineText}>Share spots</Text>
              <Text style={styles.taglineText}>Fish smarter</Text>
            </View>
          </View>

          {/* Bottom CTA Section */}
          <View style={styles.bottomSection}>
            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.8}
              onPress={() => router.push("/(auth)/register")}
              accessible
              accessibilityLabel="Get started with FishForge"
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>GET STARTED</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.8}
              onPress={() => router.push("/(auth)/login")}
              accessible
              accessibilityLabel="Sign in to your account"
              accessibilityRole="button"
            >
              <Text style={styles.secondaryButtonText}>SIGN IN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  background: {
    flex: 1,
    resizeMode: "cover",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 60,
    justifyContent: "space-between",
  },
  topSection: {
    alignItems: "center",
  },
  appName: {
    fontSize: 60,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Playfair Display",
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 40,
  },
  tagline: {
    alignItems: "center",
  },
  taglineText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: "400",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    lineHeight: 24,
    marginBottom: 4,
    fontFamily: "Inter",
  },
  bottomSection: {
    width: "100%",
  },
  primaryButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 9999,
    backgroundColor: COLORS.primary,
    marginBottom: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: 0.8,
    fontFamily: "Inter",
  },
  secondaryButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: "transparent",
    alignItems: "center",
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "400",
    letterSpacing: 0.8,
    fontFamily: "Inter",
  },
});
