import { useSubscription } from "@/auth/SubscriptionProvider";
import { DebugSubscriptionPanel } from "@/components/DebugSubscriptionPanel";
import { COLORS } from "@/lib/colors";
import { router } from "expo-router";
import {
  BarChart2,
  CheckCircle2,
  ChevronLeft,
  Crown,
  ExternalLink,
  Flame,
  Lightbulb,
  MapPin,
  RotateCcw,
  Settings,
  SlidersHorizontal,
} from "lucide-react-native";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRO_GOLD = "#F4B942";

const FEATURES = [
  {
    Icon: Flame,
    title: "Catch Heatmaps",
    description: "Visualize your catch density as a live heatmap overlay on the map.",
  },
  {
    Icon: SlidersHorizontal,
    title: "Advanced Analytics Filters",
    description: "Filter all analytics by species, season, lure, date range and more.",
  },
  {
    Icon: Lightbulb,
    title: "Full Fishing Intelligence",
    description: "Unlock all insight cards — best times, conditions, lures and trends.",
  },
  {
    Icon: BarChart2,
    title: "Premium Analytics",
    description: "Deeper trend analysis and monthly progress indicators.",
  },
  {
    Icon: MapPin,
    title: "Map Intelligence (coming soon)",
    description: "Spot scoring and density analytics for your fishing areas.",
  },
] as const;

export default function ProScreen() {
  const insets = useSafeAreaInsets();
  const { isPro, loading, presentPaywall, presentCustomerCenter, restore } =
    useSubscription();
  const [purchasing, setPurchasing] = useState(false);
  const [managing, setManaging] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // ── Subscribe — opens RC native paywall ────────────────────────────────────
  const handleSubscribe = useCallback(async () => {
    setPurchasing(true);
    try {
      const result = await presentPaywall();
      if (result.activated) {
        Alert.alert("Welcome to Pro!", "Your FishForge Pro subscription is now active.");
        router.back();
      } else if (result.outcome === "not_presented") {
        // No offerings configured in RC dashboard yet.
        Alert.alert(
          "Not Available Yet",
          "Subscriptions are being set up. Check back soon or contact support@fishforgeapp.com."
        );
      } else if (result.outcome === "error") {
        Alert.alert(
          "Something Went Wrong",
          "We couldn't open the subscription screen. Please try again or contact support@fishforgeapp.com."
        );
      }
      // "cancelled" outcome — user dismissed the paywall, no alert needed.
    } finally {
      setPurchasing(false);
    }
  }, [presentPaywall]);

  // ── Manage — opens RC Customer Center (Pro users) ─────────────────────────
  const handleManage = useCallback(async () => {
    setManaging(true);
    try {
      await presentCustomerCenter();
    } finally {
      setManaging(false);
    }
  }, [presentCustomerCenter]);

  // ── Restore — fallback for users who need it outside Customer Center ───────
  const handleRestore = useCallback(async () => {
    setRestoring(true);
    try {
      const result = await restore();
      if (result.isPro) {
        Alert.alert("Purchases Restored", "Your FishForge Pro subscription has been restored.");
        router.back();
      } else if (result.error === "not_configured") {
        Alert.alert("Not Available", "Subscription restore is being set up. Check back soon.");
      } else {
        Alert.alert(
          "No Purchases Found",
          "We couldn't find a previous Pro purchase linked to this account. Make sure you're signed in with the same account used to subscribe."
        );
      }
    } finally {
      setRestoring(false);
    }
  }, [restore]);

  const ctaDisabled = purchasing || managing || loading;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <View style={[styles.navRow, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            hitSlop={12}
          >
            <ChevronLeft size={22} color={COLORS.text} />
          </Pressable>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.crownWrap}>
            <Crown size={36} color={PRO_GOLD} strokeWidth={1.8} />
          </View>
          <Text style={styles.heroTitle}>FishForge Pro</Text>
          <Text style={styles.heroSub}>
            The most powerful fishing platform{"\n"}for serious anglers
          </Text>
          {isPro && (
            <View style={styles.activeBadge}>
              <CheckCircle2 size={14} color="#4ade80" strokeWidth={2.2} />
              <Text style={styles.activeBadgeText}>Active on your account</Text>
            </View>
          )}
        </View>

        {/* Feature list */}
        <View style={styles.featureList}>
          {FEATURES.map(({ Icon, title, description }) => (
            <View key={title} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Icon size={18} color={PRO_GOLD} strokeWidth={2} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureDesc}>{description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Pro user: subscription management section */}
        {isPro && (
          <View style={styles.manageSection}>
            <Pressable
              style={({ pressed }) => [styles.manageCard, pressed && styles.pressed]}
              onPress={handleManage}
              disabled={managing}
            >
              <View style={styles.manageCardLeft}>
                <View style={styles.manageIconWrap}>
                  <Settings size={16} color={COLORS.textSecondary} strokeWidth={2} />
                </View>
                <View>
                  <Text style={styles.manageCardTitle}>Manage Subscription</Text>
                  <Text style={styles.manageCardSub}>
                    Cancel, restore, or troubleshoot billing
                  </Text>
                </View>
              </View>
              {managing ? (
                <ActivityIndicator size="small" color={COLORS.textSecondary} />
              ) : (
                <ExternalLink size={15} color={COLORS.textSecondary} strokeWidth={1.8} />
              )}
            </Pressable>
          </View>
        )}

        {/* Dev debug panel (dev builds only) */}
        <DebugSubscriptionPanel />
      </ScrollView>

      {/* Bottom CTA — free users */}
      {!isPro && (
        <View style={styles.bottomCTA}>
          <Pressable
            style={({ pressed }) => [
              styles.subscribeBtn,
              ctaDisabled && styles.subscribeBtnDisabled,
              pressed && !ctaDisabled && styles.pressed,
            ]}
            onPress={handleSubscribe}
            disabled={ctaDisabled}
          >
            {purchasing ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <>
                <Crown size={16} color="#000" strokeWidth={2.2} />
                <Text style={styles.subscribeBtnText}>View Subscription Plans</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.restoreBtn, pressed && styles.pressed]}
            onPress={handleRestore}
            disabled={restoring || loading}
          >
            {restoring ? (
              <ActivityIndicator color={COLORS.textSecondary} size="small" />
            ) : (
              <>
                <RotateCcw size={13} color={COLORS.textSecondary} strokeWidth={2} />
                <Text style={styles.restoreBtnText}>Restore Purchases</Text>
              </>
            )}
          </Pressable>

          <Text style={styles.legalText}>
            Subscriptions auto-renew unless cancelled at least 24 hours before the
            end of the current period. Manage anytime in App Store or Google Play settings.
          </Text>
        </View>
      )}

      {/* Bottom CTA — Pro users */}
      {isPro && (
        <View style={styles.bottomCTA}>
          <Pressable
            style={[styles.subscribeBtn, styles.subscribeBtnPro]}
            onPress={() => router.back()}
          >
            <CheckCircle2 size={16} color="#000" strokeWidth={2.2} />
            <Text style={styles.subscribeBtnText}>You're on Pro</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 32 },

  navRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "rgba(221,220,219,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.65 },

  // Hero
  hero: { alignItems: "center", paddingVertical: 28, gap: 10 },
  crownWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "rgba(244,185,66,0.12)",
    borderWidth: 1,
    borderColor: "rgba(244,185,66,0.28)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heroTitle: { color: COLORS.text, fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
  heroSub: { color: COLORS.textSecondary, fontSize: 15, textAlign: "center", lineHeight: 22 },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(74,222,128,0.1)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  activeBadgeText: { color: "#4ade80", fontSize: 13, fontWeight: "600" },

  // Features
  featureList: { gap: 2, marginBottom: 24 },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(244,185,66,0.10)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  featureText: { flex: 1, gap: 3 },
  featureTitle: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
  featureDesc: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },

  // Manage subscription (Pro users)
  manageSection: { marginBottom: 8 },
  manageCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    padding: 16,
  },
  manageCardLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  manageIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  manageCardTitle: { color: COLORS.text, fontSize: 14, fontWeight: "700" },
  manageCardSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },

  // Bottom CTA
  bottomCTA: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    gap: 10,
    backgroundColor: COLORS.background,
  },
  subscribeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: PRO_GOLD,
    borderRadius: 16,
    paddingVertical: 16,
  },
  subscribeBtnPro: { backgroundColor: "#4ade80" },
  subscribeBtnDisabled: { opacity: 0.6 },
  subscribeBtnText: { color: "#000", fontWeight: "800", fontSize: 16 },
  restoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  restoreBtnText: { color: COLORS.textSecondary, fontSize: 13 },
  legalText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    textAlign: "center",
    lineHeight: 15,
    opacity: 0.7,
  },
});
