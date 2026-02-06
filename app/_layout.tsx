import { Stack } from "expo-router";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";

export default function RootLayout() {
  useEffect(() => {
    // Check current session on mount
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/(tabs)");
      } else {
        router.replace("/");
      }
    });

    // Subscribe to auth changes (Google / email login)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace("/(tabs)");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
