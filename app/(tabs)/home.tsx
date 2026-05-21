import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { useFriends } from "@/auth/FriendsProvider";
import { useSubscription } from "@/auth/SubscriptionProvider";
import { ProBadge } from "@/components/ProBadge";
import { COLORS } from "@/lib/colors";
import { CatchLog, getCatchStats, getUserCatchLogs } from "@/lib/catches";
import { FeedItem, getFriendFeed } from "@/lib/friends";
import {
  getSeasonalSummary,
  getLatestNewMilestone,
  getOnThisDay,
} from "@/lib/retention";
import { SeasonSummaryCard } from "@/components/SeasonSummaryCard";
import { MilestoneCard } from "@/components/MilestoneCard";
import { OnThisDayCard } from "@/components/OnThisDayCard";
import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BarChart2,
  BookOpen,
  Calendar,
  Clock,
  Fish,
  LogOut,
  Map,
  MapPin,
  Ruler,
  Star,
  Users,
  Weight,
} from "lucide-react-native";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ScanButton from "../../components/ScanButton";
import Avatar from "@/components/Avatar";
import { OnboardingFlow } from "@/components/Onboarding/OnboardingFlow";
import { hasCompletedOnboarding } from "@/lib/onboarding";

export default function Home() {
  const { profile, loading } = useAuth();
  const { friends, pendingRequests } = useFriends();
  const { isPro } = useSubscription();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const [stats, setStats] = useState({ totalCatches: 0, speciesCount: 0 });
  const [catches, setCatches] = useState<CatchLog[]>([]);
  const [recentCatch, setRecentCatch] = useState<CatchLog | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    hasCompletedOnboarding().then((done) => {
      if (!done) setShowOnboarding(true);
    });
  }, []);


  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Sign Out Failed", error.message);
    } else {
      router.replace("/");
    }
  };

  const loadStats = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setStats({ totalCatches: 0, speciesCount: 0 });
      setRecentCatch(null);
      return;
    }
    const allCatches = await getUserCatchLogs(user.id);
    setStats(getCatchStats(allCatches));
    setCatches(allCatches);
    setRecentCatch(allCatches[0] ?? null);
  }, []);

  const loadFeed = useCallback(async () => {
    if (friends.length === 0) {
      setFeedItems([]);
      return;
    }
    setFeedLoading(true);
    try {
      const items = await getFriendFeed(friends.map((f) => f.id));
      setFeedItems(items);
    } catch {
      setFeedItems([]);
    } finally {
      setFeedLoading(false);
    }
  }, [friends]);

  useEffect(() => {
    if (!isFocused) return;

    const run = async () => {
      setStatsLoading(true);
      setStatsError(false);
      try {
        await loadStats();
      } catch {
        setStatsError(true);
      } finally {
        setStatsLoading(false);
      }
      loadFeed();
    };

    run();
  }, [isFocused, loadStats, loadFeed]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setStatsError(false);
    try {
      await Promise.all([
        loadStats().catch(() => setStatsError(true)),
        loadFeed(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [loadStats, loadFeed]);

  // Retention cards — derived synchronously from the already-loaded catches array.
  // Must be declared before any early return to satisfy Rules of Hooks.
  const seasonalSummary = useMemo(() => getSeasonalSummary(catches), [catches]);
  const latestMilestone = useMemo(() => getLatestNewMilestone(catches), [catches]);
  const onThisDay = useMemo(() => getOnThisDay(catches), [catches]);

  if (loading || statsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  const hasPendingRequests = pendingRequests.length > 0;
  const isFirstTimeUser = stats.totalCatches === 0 && !statsLoading;

  return (
    <>
    <OnboardingFlow
      visible={showOnboarding}
      onDone={() => setShowOnboarding(false)}
    />
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => router.push("/profile")}
            style={({ pressed }) => pressed && { opacity: 0.75 }}
          >
            <Avatar
              uri={profile?.avatar_url}
              username={profile?.username}
              size={44}
            />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>FishForge</Text>
            <Text style={styles.subtitle}>
              Welcome back
              {profile?.username ? `, ${profile.username}` : ""}!
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.signOutButton, pressed && { opacity: 0.65 }]}
          onPress={handleSignOut}
          hitSlop={8}
        >
          <LogOut size={20} color={COLORS.textSecondary} />
        </Pressable>
      </View>

      <ScanButton />

      <Text style={styles.sectionLabel}>Quick Actions</Text>
      <View style={styles.rowGrid}>
        <Pressable
          style={({ pressed }) => [styles.actionBubble, { flex: 1 }, pressed && styles.cardPressed]}
          onPress={() => router.push("/catches")}
        >
          <View style={styles.actionIconSmall}>
            <Fish color={COLORS.primary} size={26} strokeWidth={2} />
          </View>
          <Text style={styles.actionText}>View Catches</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.actionBubble, { flex: 1 }, pressed && styles.cardPressed]}
          onPress={() => router.push("/favorites")}
        >
          <View style={styles.actionIconSmall}>
            <Star color={COLORS.primary} size={26} strokeWidth={2} />
          </View>
          <Text style={styles.actionText}>Favorites</Text>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [styles.fullBubble, pressed && styles.cardPressed]}
        onPress={() => router.push("/articles")}
      >
        <View style={styles.fullBubbleIconWrap}>
          <BookOpen color={COLORS.primary} size={26} strokeWidth={2} />
        </View>
        <View style={styles.fullBubbleContent}>
          <Text style={styles.actionText}>Species Guide</Text>
          <Text style={styles.actionSubtext}>Browse and learn</Text>
        </View>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.fullBubble, pressed && styles.cardPressed]}
        onPress={() => router.push("/map")}
      >
        <View style={styles.fullBubbleIconWrap}>
          <Map size={24} color={COLORS.primary} strokeWidth={2} />
        </View>
        <View style={styles.fullBubbleContent}>
          <Text style={styles.actionText}>Catch Map</Text>
          <Text style={styles.actionSubtext}>View catches on a map</Text>
        </View>
      </Pressable>

      {/* Friends bubble with notification badge */}
      <Pressable
        style={({ pressed }) => [styles.fullBubble, pressed && styles.cardPressed]}
        onPress={() => router.push("/friends")}
      >
        <View style={[styles.fullBubbleIconWrap, styles.badgeWrap]}>
          <Users size={24} color={COLORS.primary} strokeWidth={2} />
          {hasPendingRequests && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>
                {pendingRequests.length > 9 ? "9+" : pendingRequests.length}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.fullBubbleContent}>
          <Text style={styles.actionText}>Friends</Text>
          <Text style={styles.actionSubtext}>
            {hasPendingRequests
              ? `${pendingRequests.length} pending request${pendingRequests.length > 1 ? "s" : ""}`
              : "Connect with other anglers"}
          </Text>
        </View>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.fullBubble, pressed && styles.cardPressed]}
        onPress={() => router.push("/analytics")}
      >
        <View style={styles.fullBubbleIconWrap}>
          <BarChart2 size={24} color={COLORS.primary} strokeWidth={2} />
        </View>
        <View style={styles.fullBubbleContent}>
          <View style={styles.analyticsLabelRow}>
            <Text style={styles.actionText}>Analytics</Text>
            {!isPro && <ProBadge size="xs" />}
          </View>
          <Text style={styles.actionSubtext}>Insights from your catches</Text>
        </View>
      </Pressable>

      {/* Your Stats */}
      <Text style={styles.sectionLabel}>Your Stats</Text>
      {statsError ? (
        <View style={styles.statsErrorCard}>
          <Text style={styles.statsErrorText}>Couldn't load stats — pull to refresh</Text>
        </View>
      ) : (
        <View style={styles.rowGrid}>
          <View style={styles.statBubble}>
            <View style={styles.row}>
              <View style={styles.statIcon}>
                <Fish color={COLORS.primary} size={24} strokeWidth={2} />
              </View>
              <Text style={styles.statLabel}>Total Catches</Text>
            </View>
            <Text style={styles.statValue}>{stats.totalCatches}</Text>
          </View>

          <View style={styles.statBubble}>
            <View style={styles.row}>
              <View style={styles.statIcon}>
                <Fish size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.statLabel}>Species</Text>
            </View>
            <Text style={styles.statValue}>{stats.speciesCount}</Text>
          </View>
        </View>
      )}

      {/* Season summary — only when ≥ 3 catches this season */}
      {seasonalSummary && (
        <SeasonSummaryCard
          summary={seasonalSummary}
          onPress={() => router.push("/analytics")}
          style={styles.retentionCard}
        />
      )}

      {/* Milestone — only when a threshold was crossed in the last 14 days */}
      {latestMilestone && (
        <MilestoneCard milestone={latestMilestone} style={styles.retentionCard} />
      )}

      {/* Recent Activity */}
      <Text style={styles.sectionLabel}>Recent Activity</Text>
      <View style={styles.activityBubble}>
        <View style={styles.row}>
          <View style={styles.activityIconWrap}>
            <Clock color={COLORS.primary} size={24} strokeWidth={2} />
          </View>
          <View style={styles.activityContent}>
            {recentCatch ? (
              <>
                <Text style={styles.activityTitle}>
                  Last catch: {recentCatch.species || "Unknown Species"}
                </Text>
                <View style={styles.activityMetaRow}>
                  <Ruler size={12} color={COLORS.primary} />
                  <Text style={styles.activityMetaText}>
                    {recentCatch.length || "-"}
                  </Text>
                  <Text style={styles.activityMetaDot}>•</Text>
                  <Weight size={12} color={COLORS.primary} />
                  <Text style={styles.activityMetaText}>
                    {recentCatch.weight || "-"}
                  </Text>
                </View>
                <View style={styles.activityMetaRow}>
                  <MapPin size={12} color={COLORS.primary} />
                  <Text style={styles.activityMetaText} numberOfLines={1}>
                    {recentCatch.location || "Unknown location"}
                  </Text>
                  <Text style={styles.activityMetaDot}>•</Text>
                  <Calendar size={12} color={COLORS.primary} />
                  <Text style={styles.activityMetaText} numberOfLines={1}>
                    {recentCatch.date || "No date"}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.activityTitle}>No recent activity</Text>
                <Text style={styles.activitySub}>
                  Start by scanning your first catch
                </Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* On this day — only when prior-year catches exist on today's calendar date */}
      {onThisDay && (
        <OnThisDayCard entry={onThisDay} style={styles.retentionCard} />
      )}

      {/* First-run journey card */}
      {isFirstTimeUser && (
        <Pressable
          style={({ pressed }) => [styles.journeyCard, pressed && styles.cardPressed]}
          onPress={() => router.push("/log" as never)}
        >
          <View style={styles.journeyIconWrap}>
            <Fish size={22} color={COLORS.primary} strokeWidth={1.8} />
          </View>
          <View style={styles.journeyContent}>
            <Text style={styles.journeyTitle}>Start your fishing history</Text>
            <Text style={styles.journeySub}>
              Log your first catch to unlock analytics, insights, and your fishing map.
            </Text>
          </View>
        </Pressable>
      )}

      {/* Friends Feed */}
      <Text style={styles.sectionLabel}>Friends Feed</Text>

      {feedLoading ? (
        <View style={styles.feedEmptyCard}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.feedEmptyText}>Loading feed...</Text>
        </View>
      ) : friends.length === 0 ? (
        <View style={styles.feedEmptyCard}>
          <View style={styles.feedEmptyIconWrap}>
            <Users size={28} color={COLORS.textSecondary} strokeWidth={1.5} />
          </View>
          <Text style={styles.feedEmptyTitle}>No friends yet</Text>
          <Text style={styles.feedEmptyText}>
            Add friends to see their catches here.
          </Text>
          <Pressable
            style={styles.feedEmptyAction}
            onPress={() => router.push("/friends")}
          >
            <Text style={styles.feedEmptyActionText}>Find Anglers</Text>
          </Pressable>
        </View>
      ) : feedItems.length === 0 ? (
        <View style={styles.feedEmptyCard}>
          <View style={styles.feedEmptyIconWrap}>
            <Fish size={28} color={COLORS.textSecondary} strokeWidth={1.5} />
          </View>
          <Text style={styles.feedEmptyTitle}>Nothing yet</Text>
          <Text style={styles.feedEmptyText}>
            Your friends haven&apos;t logged any public catches yet.
          </Text>
        </View>
      ) : (
        <View style={styles.feedList}>
          {feedItems.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.feedCard, pressed && styles.cardPressed]}
              onPress={() => router.push(`/user/${item.userId}`)}
            >
              {/* Angler row */}
              <View style={styles.feedAnglerRow}>
                <Avatar uri={item.avatarUrl} username={item.username} size={32} />
                <Text style={styles.feedAnglerName}>{item.username}</Text>
                <Text style={styles.feedDate}>{item.date}</Text>
              </View>

              {/* Catch content */}
              <View style={styles.feedCatchRow}>
                {!!item.imageUrl && (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.feedThumb}
                  />
                )}
                <View style={styles.feedCatchContent}>
                  <Text style={styles.feedSpecies} numberOfLines={1}>
                    {item.species || "Unknown Species"}
                  </Text>
                  {(!!item.length || !!item.weight) && (
                    <Text style={styles.feedMeta}>
                      {[item.length, item.weight].filter(Boolean).join(" • ")}
                    </Text>
                  )}
                  {!!item.location && (
                    <View style={styles.feedLocationRow}>
                      <MapPin size={11} color={COLORS.textSecondary} />
                      <Text style={styles.feedLocation} numberOfLines={1}>
                        {item.location}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  cardPressed: {
    opacity: 0.72,
  },
  retentionCard: {
    marginHorizontal: 16,
    marginBottom: 12,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },

  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
  },

  header: {
    paddingBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontSize: 32,
    color: COLORS.text,
    fontWeight: "700",
    letterSpacing: -1,
  },

  subtitle: {
    color: COLORS.primary,
    fontSize: 14,
    marginTop: 4,
  },

  signOutButton: {
    padding: 12,
    borderRadius: 999,
    backgroundColor: "rgba(221,220,219,0.1)",
    borderWidth: 1,
    borderColor: "rgba(221,220,219,0.2)",
  },

  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    fontWeight: "600",
    marginBottom: 10,
    marginTop: 4,
  },

  rowGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
  },

  actionBubble: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: "center",
    gap: 8,
  },

  actionIconSmall: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(253,123,65,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullBubble: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  fullBubbleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(253,123,65,0.12)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  fullBubbleContent: {
    flex: 1,
  },
  analyticsLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  badgeWrap: {
    position: "relative",
  },
  notifBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#ef4444",
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },

  actionText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },

  actionSubtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  statsErrorCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  statsErrorText: {
    color: "#fca5a5",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  statBubble: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    flex: 1,
  },

  statIcon: {
    marginRight: 8,
  },

  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  statValue: {
    fontSize: 26,
    color: COLORS.text,
    fontWeight: "700",
    marginTop: 8,
  },

  activityBubble: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    marginBottom: 12,
  },

  activityTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },

  activitySub: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  activityMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 5,
  },
  activityMetaText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    flexShrink: 1,
  },
  activityMetaDot: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  activityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(253,123,65,0.12)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  activityContent: {
    flex: 1,
  },

  // Feed
  feedEmptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 4,
  },
  feedEmptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  feedEmptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  feedEmptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  feedEmptyAction: {
    marginTop: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  feedEmptyActionText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 13,
  },
  feedList: {
    gap: 10,
  },
  feedCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  feedAnglerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  feedAnglerName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  feedDate: {
    color: COLORS.textSecondary,
    fontSize: 11,
    flexShrink: 0,
  },
  feedCatchRow: {
    flexDirection: "row",
    gap: 12,
  },
  feedThumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    resizeMode: "cover",
  },
  feedCatchContent: {
    flex: 1,
    gap: 4,
    justifyContent: "center",
  },
  feedSpecies: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },
  feedMeta: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  feedLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  feedLocation: {
    color: COLORS.textSecondary,
    fontSize: 11,
    flexShrink: 1,
  },

  // First-run journey card
  journeyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(253,123,65,0.07)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(253,123,65,0.22)",
    padding: 16,
    marginBottom: 20,
  },
  journeyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(253,123,65,0.14)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  journeyContent: {
    flex: 1,
    gap: 4,
  },
  journeyTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  journeySub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
});
