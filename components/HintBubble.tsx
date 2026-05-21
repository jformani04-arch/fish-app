/**
 * Dismissible feature-discovery hint.
 *
 * Shows once per hint key, then disappears permanently via AsyncStorage.
 * Use wherever a first-time user might not discover a feature on their own.
 *
 * Usage:
 *   <HintBubble hintKey={HINT_KEYS.MAP_LAYERS} title="Map Layers" body="Tap to toggle..." />
 */

import { COLORS } from "@/lib/colors";
import { HintKey, dismissHint, hasSeenHint } from "@/lib/onboarding";
import { Info, X } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
  hintKey: HintKey;
  title: string;
  body: string;
  /** Accent color for the border and icon. Defaults to primary orange. */
  accentColor?: string;
  /** Additional container styles (e.g. margins for positioning). */
  style?: object;
}

export function HintBubble({
  hintKey,
  title,
  body,
  accentColor = COLORS.primary,
  style,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);

  // Check AsyncStorage once on mount — avoid flicker by only rendering after check.
  useEffect(() => {
    hasSeenHint(hintKey).then((seen) => {
      setVisible(!seen);
      setChecked(true);
    });
  }, [hintKey]);

  const handleDismiss = useCallback(async () => {
    setVisible(false);
    await dismissHint(hintKey);
  }, [hintKey]);

  // Don't render anything until the check resolves to avoid a flash.
  if (!checked || !visible) return null;

  const borderColor = `${accentColor}40`;
  const bgColor = `${accentColor}0D`;

  return (
    <View style={[styles.container, { borderColor, backgroundColor: bgColor }, style]}>
      <View style={styles.iconWrap}>
        <Info size={14} color={accentColor} strokeWidth={2.2} />
      </View>

      <View style={styles.text}>
        <Text style={[styles.title, { color: accentColor }]}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
        onPress={handleDismiss}
        hitSlop={10}
      >
        <X size={13} color={COLORS.textSecondary} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  iconWrap: {
    marginTop: 1,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  body: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  closeBtn: {
    marginTop: 1,
    flexShrink: 0,
  },
  pressed: { opacity: 0.6 },
});
