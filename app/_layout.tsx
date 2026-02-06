import { Stack } from "expo-router";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";

export default function RootLayout() {
  useEffect(() => {
    // 1️⃣ Check session on app load
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/(tabs)/home");
      } else {
        router.replace("/");
      }
    });

    // 2️⃣ Listen for auth state changes
    const listener = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace("/(tabs)/home");
      } else {
        router.replace("/");
      }
    });

    return () => listener.data.subscription.unsubscribe();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
