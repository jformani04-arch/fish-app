import { Pressable, Text, StyleSheet } from "react-native";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";

export default function LogoutButton() {
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      router.replace("/(auth)/login"); // redirect to login page
    } else {
      console.log("Logout error:", error.message);
    }
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
