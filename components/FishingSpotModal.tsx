import { COLORS } from "@/lib/colors";
import {
  createFishingSpot,
  deleteFishingSpot,
  FishingSpot,
  FishingSpotVisibility,
  updateFishingSpot,
} from "@/lib/fishingSpots";
import { Trash2, X } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface AddProps {
  mode: "add";
  latitude: number;
  longitude: number;
  onSave: (spot: FishingSpot) => void;
  onClose: () => void;
}

interface EditProps {
  mode: "edit";
  spot: FishingSpot;
  onSave: (spot: FishingSpot) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

type Props = AddProps | EditProps;

const VISIBILITY_OPTIONS: {
  value: FishingSpotVisibility;
  label: string;
  description: string;
}[] = [
  { value: "private", label: "Private", description: "Only you can see this spot" },
  { value: "friends", label: "Friends", description: "Visible to your friends" },
  { value: "public", label: "Public", description: "Visible to everyone" },
];

export default function FishingSpotModal(props: Props) {
  const insets = useSafeAreaInsets();
  const isEdit = props.mode === "edit";

  const [name, setName] = useState(isEdit ? props.spot.name : "");
  const [notes, setNotes] = useState(isEdit ? (props.spot.notes ?? "") : "");
  const [visibility, setVisibility] = useState<FishingSpotVisibility>(
    isEdit ? props.spot.visibility : "private"
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Spot name is required.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (isEdit) {
        await updateFishingSpot(props.spot.id, {
          name: name.trim(),
          notes: notes.trim() || null,
          visibility,
        });
        props.onSave({
          ...props.spot,
          name: name.trim(),
          notes: notes.trim() || null,
          visibility,
        });
      } else {
        const spot = await createFishingSpot({
          name: name.trim(),
          notes: notes.trim() || null,
          latitude: (props as AddProps).latitude,
          longitude: (props as AddProps).longitude,
          visibility,
        });
        props.onSave(spot);
      }
    } catch {
      setError("Failed to save spot. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit) return;
    setDeleting(true);
    try {
      await deleteFishingSpot(props.spot.id);
      (props as EditProps).onDelete(props.spot.id);
    } catch {
      setError("Failed to delete spot.");
      setDeleting(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>
          <Pressable onPress={props.onClose} style={styles.iconButton}>
            <X color={COLORS.text} size={20} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.title}>{isEdit ? "Edit Spot" : "Save Fishing Spot"}</Text>
          {isEdit ? (
            <Pressable
              onPress={handleDelete}
              style={styles.deleteButton}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <Trash2 color="#EF4444" size={18} strokeWidth={2} />
              )}
            </Pressable>
          ) : (
            <View style={styles.iconButton} />
          )}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.field}>
            <Text style={styles.label}>Spot Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Secret Bass Hole"
              placeholderTextColor={COLORS.textSecondary}
              maxLength={80}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Best at dawn, try spinner bait near the reeds..."
              placeholderTextColor={COLORS.textSecondary}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Visibility</Text>
            <View style={styles.visibilityGroup}>
              {VISIBILITY_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.visibilityOption,
                    visibility === opt.value && styles.visibilityOptionActive,
                  ]}
                  onPress={() => setVisibility(opt.value)}
                >
                  <Text
                    style={[
                      styles.visibilityLabel,
                      visibility === opt.value && styles.visibilityLabelActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <Text style={styles.visibilityDesc}>{opt.description}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          {!isEdit && (
            <Text style={styles.coordsText}>
              {(props as AddProps).latitude.toFixed(5)},{" "}
              {(props as AddProps).longitude.toFixed(5)}
            </Text>
          )}
        </ScrollView>

        <Pressable
          style={[styles.saveButton, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.text} size="small" />
          ) : (
            <Text style={styles.saveText}>{isEdit ? "Save Changes" : "Save Spot"}</Text>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(221,220,219,0.1)",
  },
  deleteButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  title: {
    flex: 1,
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { gap: 18, paddingBottom: 12 },
  field: { gap: 8 },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "rgba(221,220,219,0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  visibilityGroup: { gap: 8 },
  visibilityOption: {
    backgroundColor: "rgba(221,220,219,0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 12,
  },
  visibilityOptionActive: {
    backgroundColor: "rgba(253,123,65,0.12)",
    borderColor: "rgba(253,123,65,0.4)",
  },
  visibilityLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  visibilityLabelActive: {
    color: COLORS.primary,
  },
  visibilityDesc: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    textAlign: "center",
  },
  coordsText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  saveText: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.3,
  },
});
