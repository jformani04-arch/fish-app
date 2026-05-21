/**
 * Onboarding + feature-discovery state management.
 *
 * Persists state in AsyncStorage so flags survive app restarts.
 * All keys are versioned so a future schema change can reset state cleanly.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_ONBOARDING = "@fishforge:onboarding:v1";
const KEY_HINTS = "@fishforge:hints:v1";

// ─── Onboarding ───────────────────────────────────────────────────────────────

/** Returns true if the user has already completed (or skipped) onboarding. */
export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(KEY_ONBOARDING);
    return value === "true";
  } catch {
    return false;
  }
}

/** Mark onboarding as done. Idempotent. */
export async function markOnboardingComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_ONBOARDING, "true");
  } catch {}
}

/** Reset onboarding state (dev/QA only). */
export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY_ONBOARDING);
  } catch {}
}

// ─── Feature-discovery hints ──────────────────────────────────────────────────

/**
 * Well-known hint keys used throughout the app.
 * Add a new entry here whenever a new hint is introduced.
 */
export const HINT_KEYS = {
  MAP_LAYERS: "map_layers",
  MAP_HEATMAP: "map_heatmap",
  MAP_SPOTS: "map_spots",
  ANALYTICS_FILTER: "analytics_filter",
  HOME_SCAN: "home_scan",
} as const;

export type HintKey = (typeof HINT_KEYS)[keyof typeof HINT_KEYS];

type HintStore = Record<string, boolean>;

async function readHintStore(): Promise<HintStore> {
  try {
    const raw = await AsyncStorage.getItem(KEY_HINTS);
    return raw ? (JSON.parse(raw) as HintStore) : {};
  } catch {
    return {};
  }
}

async function writeHintStore(store: HintStore): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_HINTS, JSON.stringify(store));
  } catch {}
}

/** Returns true when the hint has already been dismissed. */
export async function hasSeenHint(key: HintKey): Promise<boolean> {
  const store = await readHintStore();
  return store[key] === true;
}

/** Permanently dismiss a hint. */
export async function dismissHint(key: HintKey): Promise<void> {
  const store = await readHintStore();
  store[key] = true;
  await writeHintStore(store);
}

/** Reset all dismissed hints (dev/QA only). */
export async function resetHints(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY_HINTS);
  } catch {}
}

// ─── Composite reset (dev panel) ─────────────────────────────────────────────

/** Reset all onboarding + hint state. Call from debug panel only. */
export async function resetAllOnboardingState(): Promise<void> {
  await resetOnboarding();
  await resetHints();
}
