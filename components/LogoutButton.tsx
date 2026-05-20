import { Pressable, Text, StyleSheet } from "react-native";
import { supabase } from "@/lib/supabase";

export default function LogoutButton() {
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    // Navigation is handled by the SIGNED_OUT listener in app/_layout.tsx.
    // No router.replace here to avoid two competing navigation calls.
    // navigation handled by SIGNED_OUT listener in app/_layout.tsx
  };

  return (
    <Pressable style={styles.button} onPress={handleLogout}>
      <Text style={styles.text}>Log Out</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "red",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  text: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },
});
