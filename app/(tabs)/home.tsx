import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import {
  Camera,
  Clock,
  Eye,
  Fish,
  Heart,
  Library,
  TrendingUp,
  User,
} from "lucide-react-native";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import ScanButton from "../../components/ScanButton"

export default function Home() {
  const { width } = useWindowDimensions();

  // Two-column card width calculation
  const H_PADDING = 48;
  const GAP = 16;
  const cardWidth = (width - H_PADDING - GAP) / 2;

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      router.replace("/");
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Anglr</Text>
          <Text style={styles.subtitle}>Welcome back, angler</Text>
        </View>

        <Pressable style={styles.profileButton} onPress={handleSignOut}>
          <User size={22} color="#B8B7B6" />
        </Pressable>
      </View>
      <ScanButton/>
      <Text style={styles.sectionLabel}>Quick Actions</Text>
      <View style={styles.rowGrid}>
        <Pressable style={[styles.actionBubble, { width: cardWidth }]}>
          <View style={styles.actionIcon}>
            <Eye size={20} color="#FD7B41" />
          </View>
          <Text style={styles.actionText}>View Catches</Text>
        </Pressable>

        <Pressable style={[styles.actionBubble, { width: cardWidth }]}>
          <View style={styles.actionIcon}>
            <Heart size={20} color="#FD7B41" />
          </View>
          <Text style={styles.actionText}>Favorites</Text>
        </Pressable>
      </View>
      <Pressable style={styles.fullBubble}>
        <View style={styles.row}>
          <View style={styles.actionIcon}>
            <Library size={20} color="#FD7B41" />
          </View>
          <View style={styles.fullBubbleContent}>
            <Text style={styles.actionText}>Species Guide</Text>
            <Text style={styles.actionSubtext}>Browse and learn</Text>
          </View>
        </View>
      </Pressable>
      <Text style={styles.sectionLabel}>Your Stats</Text>
      <View style={styles.rowGrid}>
        <View style={[styles.statBubble, { width: cardWidth }]}>
          <View style={styles.row}>
            <View style={styles.statIcon}>
              <TrendingUp size={14} color="#FD7B41" />
            </View>
            <Text style={styles.statLabel}>Total Catches</Text>
          </View>
          <Text style={styles.statValue}>0</Text>
        </View>

        <View style={[styles.statBubble, { width: cardWidth }]}>
          <View style={styles.row}>
            <View style={styles.statIcon}>
              <Fish size={14} color="#FD7B41" />
            </View>
            <Text style={styles.statLabel}>Species</Text>
          </View>
          <Text style={styles.statValue}>0</Text>
        </View>
      </View>
      <Text style={styles.sectionLabel}>Recent Activity</Text>
      <View style={styles.activityBubble}>
        <View style={styles.row}>
          <View style={styles.actionIcon}>
            <Clock size={18} color="#FD7B41" />
          </View>
          <View style={styles.activityContent}>
            <Text style={styles.activityTitle}>No recent activity</Text>
            <Text style={styles.activitySub}>
              Start by scanning your first catch
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#3C4044",
    paddingHorizontal: 24,
  },

  header: {
    paddingTop: 48,
    paddingBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: {
    fontSize: 32,
    color: "#DDDCDB",
    fontWeight: "700",
    letterSpacing: -1,
  },

  subtitle: {
    color: "#FD7B41",
    fontSize: 14,
    marginTop: 4,
  },

  profileButton: {
    padding: 12,
    borderRadius: 999,
    backgroundColor: "rgba(221,220,219,0.1)",
    borderWidth: 1,
    borderColor: "rgba(221,220,219,0.2)",
  },


  sectionLabel: {
    color: "#B8B7B6",
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 12,
  },

  rowGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  actionBubble: {
    backgroundColor: "rgba(221,220,219,0.08)",
    borderWidth: 1,
    borderColor: "white",
    borderRadius: 24,
    padding: 20,
  },

  fullBubble: {
    backgroundColor: "rgba(221,220,219,0.08)",
    borderWidth: 1,
    borderColor: "white",
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
  },

  actionIcon: {
    padding: 10,
    borderRadius: 999,
    backgroundColor: "rgba(253,123,65,0.2)",
    marginBottom: 8,
    alignSelf: "flex-start",
  },

  actionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#DDDCDB",
  },

  actionSubtext: {
    fontSize: 13,
    color: "#B8B7B6",
    marginTop: 2,
  },

  statBubble: {
    backgroundColor: "rgba(221,220,219,0.08)",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "white",
  },

  statIcon: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: "rgba(253,123,65,0.2)",
    marginRight: 8,
  },

  statLabel: {
    color: "#B8B7B6",
    fontSize: 13,
  },

  statValue: {
    fontSize: 28,
    color: "#DDDCDB",
    fontWeight: "700",
    marginTop: 8,
  },

  activityBubble: {
    backgroundColor: "rgba(221,220,219,0.08)",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "white",
  },

  activityTitle: {
    color: "#DDDCDB",
    fontSize: 15,
    fontWeight: "500",
  },

  activitySub: {
    color: "#B8B7B6",
    fontSize: 13,
    marginTop: 4,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  fullBubbleContent: {
    flex: 1,
  },

  activityContent: {
    flex: 1,
  },
});
