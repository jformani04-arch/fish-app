import { useSubscription } from "@/auth/SubscriptionProvider";
import { COLORS } from "@/lib/colors";
import { PRODUCT_PRICES } from "@/lib/subscriptions";
import { router } from "expo-router";
import {
  BarChart2,
  CheckCircle2,
  ChevronLeft,
  Crown,
  Flame,
  Lightbulb,
  MapPin,
  RotateCcw,
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
  const { isPro, purchasePro, restore, loading } = useSubscription();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handleSubscribe = useCallback(async () => {
    setPurchasing(true);
    try {
      const result = await purchasePro();
      if (result.success) {
        Alert.alert("Welcome to Pro!", "Your FishForge Pro subscription is now active.");
        router.back();
      } else if (result.error === "not_configured") {
        Alert.alert(
          "Coming Soon",
          "In-app purchases are being set up. Check back soon for the full subscription experience.",
          [{ text: "OK" }]
        );
      } else if (result.error !== "cancelled") {
        Alert.alert("Something went wrong", "Please try again or contact support.");
      }
    } finally {
      setPurchasing(false);
    }
  }, [purchasePro]);

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    try {
      const result = await restore();
      if (result.isPro) {
        Alert.alert("Purchases Restored", "Your Pro subscription has been restored.");
        router.back();
      } else {
        Alert.alert(
          "No Purchases Found",
          result.error === "not_configured"
            ? "In-app purchases are being set up. Check back soon."
            : "We couldn't find any previous purchases for this account."
        );
      }
    } finally {
      setRestoring(false);
    }
  }, [restore]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
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

        {/* Pricing */}
        {!isPro && (
          <View style={styles.pricingCard}>
            <View style={styles.pricingRow}>
              <View style={styles.pricingOption}>
                <Text style={styles.pricingAmount}>$4.99</Text>
                <Text style={styles.pricingPeriod}>per month</Text>
              </View>
              <View style={styles.pricingDivider} />
              <View style={styles.pricingOption}>
                <View style={styles.pricingAnnualRow}>
                  <Text style={styles.pricingAmount}>$39.99</Text>
                  <View style={styles.savingsBadge}>
                    <Text style={styles.savingsText}>{PRODUCT_PRICES.annualSavings}</Text>
                  </View>
                </View>
                <Text style={styles.pricingPeriod}>per year</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Fixed bottom CTA */}
      {!isPro && (
        <View style={styles.bottomCTA}>
          <Pressable
            style={({ pressed }) => [
              styles.subscribeBtn,
              (purchasing || loading) && styles.subscribeBtnDisabled,
              pressed && !purchasing && !loading && styles.pressed,
            ]}
            onPress={handleSubscribe}
            disabled={purchasing || loading}
          >
            {purchasing ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <>
                <Crown size={16} color="#000" strokeWidth={2.2} />
                <Text style={styles.subscribeBtnText}>Subscribe to Pro</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={styles.restoreBtn}
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
            Subscriptions auto-renew unless cancelled 24h before period end.{"\n"}
            Manage in App Store / Google Play Settings.
          </Text>
        </View>
      )}

      {isPro && (
        <View style={styles.bottomCTA}>
          <Pressable style={[styles.subscribeBtn, styles.subscribeBtnPro]} onPress={() => router.back()}>
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
  scrollContent: { paddingHorizontal: 24, paddingBottom: 24 },

  navRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "rgba(221,220,219,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.65,
  },

  hero: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 10,
  },
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
  heroTitle: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  heroSub: {
    color: COLORS.textSecondary,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
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

  featureList: {
    gap: 2,
    marginBottom: 24,
  },
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

  pricingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    padding: 20,
    marginBottom: 16,
  },
  pricingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  pricingOption: { alignItems: "center", gap: 4, flex: 1 },
  pricingDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  pricingAmount: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  pricingPeriod: { color: COLORS.textSecondary, fontSize: 12 },
  pricingAnnualRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  savingsBadge: {
    backgroundColor: "rgba(74,222,128,0.15)",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  savingsText: { color: "#4ade80", fontSize: 10, fontWeight: "700" },

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
