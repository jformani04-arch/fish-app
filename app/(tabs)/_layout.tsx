import { Stack } from "expo-router";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";

export default function TabsLayout() {
  useEffect(() => {
    // Protect tabs: redirect to login if no session
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/(auth)/login");
      }
    });
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false, //disables swipe back on iOS
      }}
      initialRouteName="home" // first screen in tabs
    >
      <Stack.Screen name="home" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
