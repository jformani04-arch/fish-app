/**
 * Dev-only subscription debug panel.
 * Renders only when __DEV__ is true — production builds strip this entirely
 * via dead-code elimination.
 *
 * Usage: render anywhere inside SubscriptionProvider, e.g. at the bottom of pro.tsx.
 */

import { useAuth } from "@/auth/AuthProvider";
import { useSubscription } from "@/auth/SubscriptionProvider";
import { COLORS } from "@/lib/colors";
import {
  debugClearCache,
  debugForceStatus,
  debugGetRCCustomerInfo,
} from "@/lib/subscriptions";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export function DebugSubscriptionPanel() {
  if (!__DEV__) return null;

  return <DebugPanel />;
}

function DebugPanel() {
  const { user } = useAuth();
  const { isPro, tier, status, loading, refresh } = useSubscription();
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }, []);

  const forcePro = () =>
    run(async () => {
      if (!user) { Alert.alert("Not logged in"); return; }
      await debugForceStatus(user.id, true);
      await refresh();
    });

  const forceFree = () =>
    run(async () => {
      if (!user) { Alert.alert("Not logged in"); return; }
      await debugForceStatus(user.id, false);
      await refresh();
    });

  const clearCache = () =>
    run(async () => {
      await debugClearCache();
      await refresh();
      Alert.alert("Cache cleared", "Entitlement cache removed. Status re-fetched.");
    });

  const showRCInfo = () =>
    run(async () => {
      const info = await debugGetRCCustomerInfo();
      Alert.alert("RC CustomerInfo", info.slice(0, 800) + (info.length > 800 ? "\n…(truncated)" : ""));
    });

  const forceRefresh = () => run(refresh);

  const expiresLabel = status?.expiresAt
    ? status.expiresAt.toLocaleString()
    : status?.isLifetime
    ? "Lifetime"
    : "—";

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>DEV — Subscription Debug</Text>

      <View style={styles.statusRow}>
        <StatusPill label="isPro" value={String(isPro)} highlight={isPro} />
        <StatusPill label="tier" value={tier} />
        <StatusPill label="loading" value={String(loading)} />
      </View>
      <Text style={styles.meta}>provider: {status?.provider ?? "—"}</Text>
      <Text style={styles.meta}>expiresAt: {expiresLabel}</Text>
      <Text style={styles.meta}>userId: {user?.id?.slice(0, 12) ?? "—"}…</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.btnRow}>
        <DebugButton label="Force Pro" onPress={forcePro} color="#F4B942" busy={busy} />
        <DebugButton label="Force Free" onPress={forceFree} color="#f87171" busy={busy} />
        <DebugButton label="Refresh" onPress={forceRefresh} color="#60a5fa" busy={busy} />
        <DebugButton label="Clear Cache" onPress={clearCache} color="#a78bfa" busy={busy} />
        <DebugButton label="RC Info" onPress={showRCInfo} color="#34d399" busy={busy} />
      </ScrollView>
    </View>
  );
}

function StatusPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[styles.pill, highlight && styles.pillHighlight]}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={[styles.pillValue, highlight && styles.pillValueHighlight]}>{value}</Text>
    </View>
  );
}

function DebugButton({
  label,
  onPress,
  color,
  busy,
}: {
  label: string;
  onPress: () => void;
  color: string;
  busy: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.btn, { borderColor: color }, pressed && styles.btnPressed]}
      onPress={onPress}
      disabled={busy}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Text style={[styles.btnText, { color }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "rgba(255,80,80,0.07)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,80,80,0.25)",
    gap: 10,
  },
  heading: {
    color: "#f87171",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  pill: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
  pillHighlight: {
    backgroundColor: "rgba(244,185,66,0.12)",
  },
  pillLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  pillValue: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "700",
  },
  pillValueHighlight: {
    color: "#F4B942",
  },
  meta: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 17,
  },
  btnRow: {
    flexDirection: "row",
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPressed: { opacity: 0.6 },
  btnText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
