import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Camera } from "lucide-react-native";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

function handleImage(uri: string) {
  router.push({
    pathname: "/",
    params: { imageUri: uri },
  });
}

async function requestPermissions() {
  const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();

  const mediaPermission =
    await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (
    cameraPermission.status !== "granted" ||
    mediaPermission.status !== "granted"
  ) {
    Alert.alert(
      "Permissions required",
      "Camera and photo access are required to scan a fish.",
    );
    return false;
  }

  return true;
}

async function takePhoto() {
  const ok = await requestPermissions();
  if (!ok) return;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.9,
  });

  if (!result.canceled) {
    handleImage(result.assets[0].uri);
  }
}

async function pickFromLibrary() {
  const ok = await requestPermissions();
  if (!ok) return;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.9,
  });

  if (!result.canceled) {
    handleImage(result.assets[0].uri);
  }
}

function openScanOptions() {
  Alert.alert(
    "Scan a Fish",
    "Choose an option",
    [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Library", onPress: pickFromLibrary },
      { text: "Cancel", style: "cancel" },
    ],
    { cancelable: true },
  );
}

export default function ScanButton() {
  return (
    <>
      <Pressable onPress={openScanOptions} style={styles.primaryBubble}>
        <View style={styles.primaryIcon}>
          <Camera size={32} color="#DDDCDB" />
        </View>

        <Text style={styles.primaryTitle}>Scan a Fish</Text>
        <Text style={styles.primarySubtitle}>
          Identify species & log your catch
        </Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  primaryBubble: {
    backgroundColor: "#FD7B41",
    borderRadius: 28,
    alignItems: "center",
    padding: 28,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "white",
  },

  primaryIcon: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 18,
    marginBottom: 16,
  },

  primaryTitle: {
    fontSize: 20,
    color: "#DDDCDB",
    fontWeight: "600",
  },

  primarySubtitle: {
    color: "rgba(221,220,219,0.9)",
    fontSize: 14,
    marginTop: 4,
  },
});
