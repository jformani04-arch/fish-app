/**
 * First-time onboarding flow.
 *
 * A full-screen modal shown once to new users after sign-in.
 * Skippable at any step. Completion is persisted via lib/onboarding.ts.
 * 5 slides introducing: FishForge → Catch Logging → Maps → Analytics → Pro.
 */

import { COLORS } from "@/lib/colors";
import { markOnboardingComplete } from "@/lib/onboarding";
import {
  BarChart2,
  ChevronRight,
  Crown,
  Fish,
  Flame,
  Map,
  X,
} from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Slide definitions ────────────────────────────────────────────────────────

interface Slide {
  key: string;
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  iconColor: string;
  iconBg: string;
  accentColor: string;
  title: string;
  body: string;
  tag?: string;
}

const SLIDES: Slide[] = [
  {
    key: "welcome",
    Icon: Fish,
    iconColor: COLORS.primary,
    iconBg: "rgba(253,123,65,0.13)",
    accentColor: COLORS.primary,
    title: "Welcome to FishForge",
    body: "Your personal fishing intelligence platform. Track every catch, discover your patterns, and fish smarter — all in one place.",
  },
  {
    key: "logging",
    Icon: Fish,
    iconColor: "#38bdf8",
    iconBg: "rgba(56,189,248,0.13)",
    accentColor: "#38bdf8",
    title: "Log Every Catch",
    tag: "Catch Logging",
    body: "Tap the orange button on the home screen to log any catch. Add species, lure, depth, weather, and location — FishForge builds your fishing history automatically.",
  },
  {
    key: "maps",
    Icon: Map,
    iconColor: "#4ade80",
    iconBg: "rgba(74,222,128,0.13)",
    accentColor: "#4ade80",
    title: "Your Fishing Map",
    tag: "Maps & Spots",
    body: "Every catch with a location pins to your personal map. Save secret spots, switch to satellite view, and explore your catch history spatially.",
  },
  {
    key: "analytics",
    Icon: BarChart2,
    iconColor: "#c084fc",
    iconBg: "rgba(192,132,252,0.13)",
    accentColor: "#c084fc",
    title: "Discover Your Patterns",
    tag: "Fishing Intelligence",
    body: "FishForge surfaces insights from your data — your best time of day, top lures, favorite spots, and how your fishing changes across seasons.",
  },
  {
    key: "pro",
    Icon: Crown,
    iconColor: "#F4B942",
    iconBg: "rgba(244,185,66,0.13)",
    accentColor: "#F4B942",
    title: "Go Further with Pro",
    tag: "FishForge Pro",
    body: "Unlock catch heatmaps, advanced analytics filters, and full fishing intelligence. Start free — upgrade whenever you're ready.",
    isLast: true,
  } as Slide & { isLast: boolean },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onDone: () => void;
}

export function OnboardingFlow({ visible, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const finish = useCallback(async () => {
    await markOnboardingComplete();
    onDone();
  }, [onDone]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      setCurrentIndex(idx);
    },
    []
  );

  const goNext = useCallback(() => {
    if (currentIndex >= SLIDES.length - 1) {
      void finish();
      return;
    }
    listRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
  }, [currentIndex, finish]);

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      presentationStyle="fullScreen"
    >
      <View style={[styles.root, { paddingBottom: insets.bottom }]}>
        {/* Skip button */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable
            style={({ pressed }) => [styles.skipBtn, pressed && styles.pressed]}
            onPress={finish}
            hitSlop={12}
          >
            <X size={18} color={COLORS.textSecondary} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Slides */}
        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(s) => s.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          renderItem={({ item }) => <SlideView slide={item} />}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
        />

        {/* Bottom controls */}
        <View style={styles.bottomBar}>
          {/* Dot indicators */}
          <View style={styles.dots}>
            {SLIDES.map((s, i) => (
              <View
                key={s.key}
                style={[
                  styles.dot,
                  i === currentIndex && styles.dotActive,
                  i === currentIndex && { backgroundColor: SLIDES[currentIndex].accentColor },
                ]}
              />
            ))}
          </View>

          {/* Primary CTA */}
          <Pressable
            style={({ pressed }) => [
              styles.nextBtn,
              { backgroundColor: SLIDES[currentIndex].accentColor },
              pressed && styles.pressed,
            ]}
            onPress={goNext}
          >
            {isLast ? (
              <Text style={styles.nextBtnText}>Start Exploring</Text>
            ) : (
              <>
                <Text style={styles.nextBtnText}>Next</Text>
                <ChevronRight size={16} color="#000" strokeWidth={2.5} />
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Individual slide ─────────────────────────────────────────────────────────

function SlideView({ slide }: { slide: Slide }) {
  const { Icon, iconColor, iconBg, accentColor, title, body, tag } = slide;

  return (
    <View style={styles.slide}>
      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: iconBg, borderColor: `${accentColor}33` }]}>
        <Icon size={44} color={iconColor} strokeWidth={1.6} />
      </View>

      {/* Feature tag pill */}
      {tag && (
        <View style={[styles.tagPill, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}38` }]}>
          <Text style={[styles.tagText, { color: accentColor }]}>{tag}</Text>
        </View>
      )}

      <Text style={styles.slideTitle}>{title}</Text>
      <Text style={styles.slideBody}>{body}</Text>

      {/* Pro slide: extra feature bullets */}
      {slide.key === "pro" && <ProBullets />}
    </View>
  );
}

function ProBullets() {
  const bullets = [
    { Icon: Flame, label: "Catch Heatmaps", color: "#f97316" },
    { Icon: BarChart2, label: "Advanced Analytics Filters", color: "#c084fc" },
    { Icon: Map, label: "Satellite Map View", color: "#4ade80" },
  ] as const;

  return (
    <View style={styles.proBullets}>
      {bullets.map(({ Icon, label, color }) => (
        <View key={label} style={styles.proBullet}>
          <View style={[styles.proBulletIcon, { backgroundColor: `${color}18` }]}>
            <Icon size={14} color={color} strokeWidth={2} />
          </View>
          <Text style={styles.proBulletText}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBar: {
    paddingHorizontal: 20,
    alignItems: "flex-end",
    paddingBottom: 8,
  },
  skipBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.65 },

  // Slide
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    gap: 16,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 28,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  tagPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  slideTitle: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
    textAlign: "center",
    lineHeight: 32,
  },
  slideBody: {
    color: COLORS.textSecondary,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 23,
  },

  // Pro bullets
  proBullets: {
    gap: 8,
    marginTop: 4,
    alignSelf: "stretch",
  },
  proBullet: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  proBulletIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  proBulletText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 20,
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  dotActive: {
    width: 20,
    borderRadius: 3,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 32,
    alignSelf: "stretch",
  },
  nextBtnText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 16,
  },
});
