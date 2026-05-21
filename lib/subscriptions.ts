/**
 * Subscription service layer — the single place RevenueCat is imported.
 *
 * Components and providers interact with app-level types only (isPro,
 * SubscriptionStatus, SubscriptionPlan) and never import react-native-purchases
 * or react-native-purchases-ui directly. All SDK calls live in this file.
 *
 * Setup:
 *   1. npx expo install react-native-purchases react-native-purchases-ui
 *   2. expo run:ios / expo run:android  (native rebuild required)
 *   3. Set env vars:
 *        EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_...
 *        EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=test_gCJztfhDfFAODZuWXqWeiBccWSm
 *   4. In RevenueCat dashboard:
 *        - Entitlement identifier: "FishForge Pro"
 *        - Packages: "monthly" (Monthly type) and "yearly" (Annual type)
 *        - app_user_id set to Supabase user UUID via Purchases.logIn()
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

// ─── Import guards ────────────────────────────────────────────────────────────
// Both packages are native modules. Wrap imports so this file can be required
// in environments where native modules are unavailable (Expo Go, web).
// Every call site checks isConfigured() / isUIAvailable() before using.

let Purchases: typeof import("react-native-purchases").default | null = null;
let LOG_LEVEL: typeof import("react-native-purchases").LOG_LEVEL | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pkg = require("react-native-purchases");
  Purchases = pkg.default ?? pkg.Purchases;
  LOG_LEVEL = pkg.LOG_LEVEL;
} catch {
  // SDK not installed — all purchase functions degrade gracefully.
}

let RevenueCatUI: typeof import("react-native-purchases-ui").default | null = null;
let PAYWALL_RESULT: typeof import("react-native-purchases-ui").PAYWALL_RESULT | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const uiPkg = require("react-native-purchases-ui");
  RevenueCatUI = uiPkg.default ?? uiPkg.RevenueCatUI;
  PAYWALL_RESULT = uiPkg.PAYWALL_RESULT;
} catch {
  // UI package not installed — paywall / customer center degrade gracefully.
}

// ─── App-level types (never expose RC types outside this file) ────────────────

export type SubscriptionTier = "free" | "pro";

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  isPro: boolean;
  expiresAt: Date | null;
  /** true when Pro has no expiration date (lifetime / grandfathered) */
  isLifetime: boolean;
  provider: string | null;
}

export interface PurchaseResult {
  success: boolean;
  error?: "cancelled" | "network" | "unknown";
}

export interface RestoreResult {
  success: boolean;
  isPro: boolean;
  error?: string;
}

/** Result returned from the native RC paywall modal. */
export interface PaywallResult {
  /** true when the user purchased or restored a Pro subscription. */
  activated: boolean;
  outcome: "purchased" | "restored" | "cancelled" | "not_presented" | "error";
}

/** App-layer representation of a single purchasable plan. */
export interface SubscriptionPlan {
  id: "monthly" | "annual";
  title: string;
  priceString: string;
  /** e.g. "save 33%" — only on annual. */
  savingsLabel?: string;
  /** e.g. "7-day free trial" — shown when an intro price is available. */
  trialString?: string;
}

/** Both plans resolved from RC (or hardcoded fallback). */
export interface SubscriptionOfferings {
  monthly: SubscriptionPlan | null;
  annual: SubscriptionPlan | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Entitlement identifier — must match exactly what is set in the RevenueCat dashboard.
 * Dashboard path: Entitlements → identifier field.
 */
const PRO_ENTITLEMENT = "FishForge Pro";

/**
 * Package identifiers as configured in the RevenueCat dashboard.
 * These are the custom identifiers under the current offering's packages.
 */
export const PRODUCT_IDS = {
  monthly: "monthly",
  annual: "yearly",
} as const;

/** Fallback prices used until live RC offerings are loaded. */
export const PRODUCT_PRICES = {
  monthly: "$4.99/month",
  annual: "$39.99/year",
  annualSavings: "save 33%",
} as const;

// ─── Internal state ───────────────────────────────────────────────────────────

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "";
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";
const CACHE_KEY = "fishforge:entitlement:v1";

let sdkInitialized = false;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function isConfigured(): boolean {
  if (!Purchases) return false;
  return Platform.OS === "ios" ? !!IOS_KEY : !!ANDROID_KEY;
}

function isUIAvailable(): boolean {
  return RevenueCatUI !== null;
}

// Translates an RC CustomerInfo object into our app-level SubscriptionStatus.
// Kept internal — callers never see RC types.
function statusFromCustomerInfo(info: {
  entitlements: {
    active: Record<string, { expirationDate: string | null } | undefined>;
  };
}): SubscriptionStatus {
  const active = info.entitlements.active[PRO_ENTITLEMENT];
  const isPro = active !== undefined;
  const expiresAt = active?.expirationDate ? new Date(active.expirationDate) : null;
  return {
    tier: isPro ? "pro" : "free",
    isPro,
    expiresAt,
    isLifetime: isPro && expiresAt === null,
    provider: isPro ? "revenuecat" : null,
  };
}

// Find a package from RC offerings by our custom identifier, falling back to
// the RC standard package type property (.monthly / .annual).
function resolvePackage(
  // deno-lint-ignore no-explicit-any
  offerings: any,
  plan: "monthly" | "annual"
): unknown | null {
  if (!offerings?.current) return null;
  const current = offerings.current;
  const customId = plan === "monthly" ? PRODUCT_IDS.monthly : PRODUCT_IDS.annual;

  // Prefer the standard RC package-type accessor first, then fall back to
  // searching availablePackages by our custom identifier.
  const stdPkg = plan === "monthly" ? current.monthly : current.annual;
  if (stdPkg) return stdPkg;

  return (
    (current.availablePackages as Array<{ identifier: string }> | undefined)?.find(
      (p) => p.identifier === customId
    ) ?? null
  );
}

async function cacheStatus(status: SubscriptionStatus): Promise<void> {
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        ...status,
        expiresAt: status.expiresAt?.toISOString() ?? null,
        cachedAt: Date.now(),
      })
    );
  } catch {}
}

async function readCachedStatus(): Promise<SubscriptionStatus | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      tier: SubscriptionTier;
      isPro: boolean;
      expiresAt: string | null;
      isLifetime: boolean;
      provider: string | null;
    };

    const expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt) : null;
    // Honour expiration even in cache — don't grant stale Pro access offline.
    const isExpired = expiresAt !== null && expiresAt < new Date();
    if (isExpired && parsed.isPro) {
      return { tier: "free", isPro: false, expiresAt, isLifetime: false, provider: parsed.provider };
    }

    return {
      tier: parsed.tier,
      isPro: parsed.isPro,
      expiresAt,
      isLifetime: parsed.isLifetime,
      provider: parsed.provider,
    };
  } catch {
    return null;
  }
}

async function clearCachedStatus(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {}
}

// ─── SDK lifecycle ────────────────────────────────────────────────────────────

/**
 * Initialise the RevenueCat SDK. Call once at app startup (before any user
 * identification). Idempotent — safe to call multiple times.
 */
export function initSubscriptionSDK(): void {
  if (!isConfigured() || sdkInitialized || !Purchases || !LOG_LEVEL) return;
  const apiKey = Platform.OS === "ios" ? IOS_KEY : ANDROID_KEY;
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey });
  sdkInitialized = true;
  if (__DEV__) console.log("[subscriptions] RC SDK initialized");
}

/**
 * Identify the logged-in user with RevenueCat.
 * Call after login and whenever the user ID becomes available.
 * Idempotent — safe to call on every session restore.
 */
export async function identifySubscriptionUser(userId: string): Promise<void> {
  if (!isConfigured() || !Purchases) return;
  try {
    await Purchases.logIn(userId);
    if (__DEV__) console.log("[subscriptions] RC user identified:", userId.slice(0, 8));
  } catch (err) {
    if (__DEV__) console.warn("[subscriptions] RC logIn failed:", err);
  }
}

/**
 * Disassociate the current user from RevenueCat. Call on logout.
 * Also clears the local entitlement cache so the next user starts fresh.
 */
export async function resetSubscriptionUser(): Promise<void> {
  if (Purchases && isConfigured()) {
    try {
      await Purchases.logOut();
    } catch (err) {
      if (__DEV__) console.warn("[subscriptions] RC logOut failed:", err);
    }
  }
  await clearCachedStatus();
}

/**
 * Register a callback that fires whenever RevenueCat detects an entitlement
 * change (purchase, renewal, revocation, billing issue resolution, etc.).
 *
 * Returns a cleanup function — call it when the component/provider unmounts.
 */
export function addStatusListener(
  userId: string | null,
  onUpdate: (status: SubscriptionStatus) => void
): () => void {
  if (!isConfigured() || !Purchases) return () => {};

  const handler = (info: Parameters<typeof statusFromCustomerInfo>[0]) => {
    const status = statusFromCustomerInfo(info);
    onUpdate(status);
    void cacheStatus(status);
    if (userId) {
      syncProStatusToSupabase(userId, status.isPro, {
        provider: status.isPro ? "revenuecat" : undefined,
        expiresAt: status.expiresAt,
      }).catch(() => {});
    }
  };

  Purchases.addCustomerInfoUpdateListener(handler);
  return () => {
    Purchases?.removeCustomerInfoUpdateListener(handler);
  };
}

// ─── Entitlement fetching ─────────────────────────────────────────────────────

/**
 * Fetch the current subscription status for a user.
 *
 * Resolution order:
 *   1. RevenueCat — authoritative, real-time
 *   2. Supabase profiles table — server-side cache (online only)
 *   3. AsyncStorage — offline fallback, expiration-aware
 *   4. Free tier — safe default
 */
export async function fetchSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  // 1. RevenueCat — authoritative
  if (isConfigured() && Purchases) {
    try {
      const info = await Purchases.getCustomerInfo();
      const status = statusFromCustomerInfo(info);
      void cacheStatus(status);
      syncProStatusToSupabase(userId, status.isPro, {
        provider: status.isPro ? "revenuecat" : undefined,
        expiresAt: status.expiresAt,
      }).catch(() => {});
      return status;
    } catch {}
  }

  // 2. Supabase — server-side cache
  try {
    const { data } = await supabase
      .from("profiles")
      .select("is_pro, subscription_tier, subscription_expires_at, subscription_provider")
      .eq("id", userId)
      .single();

    if (data) {
      const isPro = !!data.is_pro;
      const expiresAt = data.subscription_expires_at
        ? new Date(data.subscription_expires_at)
        : null;
      const resolvedIsPro = isPro && (expiresAt === null || expiresAt >= new Date());
      const status: SubscriptionStatus = {
        tier: resolvedIsPro ? "pro" : "free",
        isPro: resolvedIsPro,
        expiresAt,
        isLifetime: resolvedIsPro && expiresAt === null,
        provider: (data.subscription_provider as string | null) ?? null,
      };
      void cacheStatus(status);
      return status;
    }
  } catch {}

  // 3. AsyncStorage — offline fallback
  const cached = await readCachedStatus();
  if (cached) return cached;

  // 4. Safe default
  return { tier: "free", isPro: false, expiresAt: null, isLifetime: false, provider: null };
}

// ─── Offerings (live prices) ──────────────────────────────────────────────────

/**
 * Fetch live subscription plans from RevenueCat.
 * Looks up packages by the custom identifiers "monthly" and "yearly" configured
 * in the RC dashboard, falling back to the standard package-type accessors.
 * Returns null when RC is unavailable; callers fall back to PRODUCT_PRICES.
 */
export async function getSubscriptionOfferings(): Promise<SubscriptionOfferings | null> {
  if (!isConfigured() || !Purchases) return null;

  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return null;

    const toPlan = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pkg: any,
      id: "monthly" | "annual"
    ): SubscriptionPlan | null => {
      if (!pkg) return null;
      const introPrice = pkg.product?.introPrice;
      const trialString =
        introPrice?.periodNumberOfUnits
          ? `${introPrice.periodNumberOfUnits}-${introPrice.periodUnit?.toLowerCase()} free trial`
          : undefined;
      return {
        id,
        title: id === "monthly" ? "Monthly" : "Annual",
        priceString: pkg.product?.priceString ?? (id === "monthly" ? PRODUCT_PRICES.monthly : PRODUCT_PRICES.annual),
        savingsLabel: id === "annual" ? PRODUCT_PRICES.annualSavings : undefined,
        trialString,
      };
    };

    // Resolve each plan: check standard RC type first, then custom identifier.
    const monthlyPkg = resolvePackage(offerings, "monthly");
    const annualPkg = resolvePackage(offerings, "annual");

    return {
      monthly: toPlan(monthlyPkg, "monthly"),
      annual: toPlan(annualPkg, "annual"),
    };
  } catch {
    return null;
  }
}

// ─── Native paywall + customer center ────────────────────────────────────────

/**
 * Present the RevenueCat native paywall modal.
 * Uses `presentPaywallIfNeeded` — the modal is skipped if the user already
 * holds the "FishForge Pro" entitlement, preventing accidental re-purchase.
 *
 * The paywall UI is configured entirely in the RevenueCat dashboard and can
 * be updated without releasing a new app version.
 */
export async function presentPaywall(): Promise<PaywallResult> {
  if (!isUIAvailable() || !RevenueCatUI) {
    if (__DEV__) console.warn("[subscriptions] react-native-purchases-ui not available");
    return { activated: false, outcome: "error" };
  }

  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: PRO_ENTITLEMENT,
    });

    // Map RC's PAYWALL_RESULT enum to our app-level PaywallResult type.
    // PAYWALL_RESULT values: PURCHASED, RESTORED, CANCELLED, NOT_PRESENTED, ERROR
    const resultStr = String(result);
    if (resultStr === "PURCHASED") return { activated: true, outcome: "purchased" };
    if (resultStr === "RESTORED") return { activated: true, outcome: "restored" };
    if (resultStr === "NOT_PRESENTED") return { activated: false, outcome: "not_presented" };
    if (resultStr === "ERROR") return { activated: false, outcome: "error" };
    return { activated: false, outcome: "cancelled" };
  } catch (err) {
    if (__DEV__) console.warn("[subscriptions] presentPaywall error:", err);
    return { activated: false, outcome: "error" };
  }
}

/**
 * Present the RevenueCat Customer Center modal.
 * Handles subscription management: cancel, refund requests (Android),
 * billing issue resolution, and restore purchases — all without custom UI code.
 *
 * Show this to Pro users as "Manage Subscription".
 */
export async function presentCustomerCenter(): Promise<void> {
  if (!isUIAvailable() || !RevenueCatUI) {
    if (__DEV__) console.warn("[subscriptions] react-native-purchases-ui not available");
    return;
  }
  try {
    await RevenueCatUI.presentCustomerCenter();
  } catch (err) {
    if (__DEV__) console.warn("[subscriptions] presentCustomerCenter error:", err);
  }
}

// ─── Supabase sync ────────────────────────────────────────────────────────────

/**
 * Write the resolved Pro entitlement back to the Supabase profiles table.
 * The RevenueCat webhook Edge Function is the primary server-side sync path;
 * this client-side call provides a redundancy layer after purchases and restores.
 */
export async function syncProStatusToSupabase(
  userId: string,
  isPro: boolean,
  opts?: { provider?: string; expiresAt?: Date | null }
): Promise<void> {
  const patch: Record<string, unknown> = {
    is_pro: isPro,
    subscription_tier: isPro ? "pro" : "free",
  };
  if (opts?.provider !== undefined) patch.subscription_provider = opts.provider;
  if (opts?.expiresAt !== undefined) {
    patch.subscription_expires_at = opts.expiresAt ? opts.expiresAt.toISOString() : null;
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw new Error(error.message);
}

// ─── Programmatic purchase flows (fallback / direct) ─────────────────────────
// The preferred path is presentPaywall() above. These remain available for
// direct/programmatic purchases if needed (e.g. from a custom UI in the future).

/**
 * Programmatically initiate a Pro subscription purchase for the given plan.
 * Prefers the RC native paywall (presentPaywall) for the user-facing flow.
 */
export async function purchaseProSubscription(
  plan: "monthly" | "annual" = "annual"
): Promise<PurchaseResult> {
  if (!isConfigured() || !Purchases) {
    return { success: false, error: "unknown" };
  }

  try {
    const offerings = await Purchases.getOfferings();
    const pkg = resolvePackage(offerings, plan);

    if (!pkg) {
      if (__DEV__) console.warn("[subscriptions] Package not found for plan:", plan);
      return { success: false, error: "unknown" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { customerInfo } = await Purchases.purchasePackage(pkg as any);
    const isPro = PRO_ENTITLEMENT in customerInfo.entitlements.active;
    return { success: isPro };
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "userCancelled" in err &&
      (err as { userCancelled: boolean }).userCancelled
    ) {
      return { success: false, error: "cancelled" };
    }
    if (__DEV__) console.warn("[subscriptions] purchasePackage error:", err);
    return { success: false, error: "unknown" };
  }
}

/**
 * Restore previous purchases (required by App Store / Google Play guidelines).
 * Prefer Customer Center (presentCustomerCenter) for the user-facing flow.
 */
export async function restorePurchases(): Promise<RestoreResult> {
  if (!isConfigured() || !Purchases) {
    return { success: false, isPro: false, error: "not_configured" };
  }

  try {
    const info = await Purchases.restorePurchases();
    const isPro = PRO_ENTITLEMENT in info.entitlements.active;
    return { success: true, isPro };
  } catch {
    return { success: false, isPro: false, error: "network" };
  }
}

// ─── Dev utilities (stripped from production builds via __DEV__ guard) ────────

/** Force a Pro/free state for QA testing. Bypasses RevenueCat. No-op in prod. */
export async function debugForceStatus(userId: string, isPro: boolean): Promise<void> {
  if (!__DEV__) return;
  const expiresAt = isPro ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null;
  const status: SubscriptionStatus = {
    tier: isPro ? "pro" : "free",
    isPro,
    expiresAt,
    isLifetime: false,
    provider: "debug",
  };
  await cacheStatus(status);
  await syncProStatusToSupabase(userId, isPro, { provider: "debug", expiresAt });
}

/** Clear the local AsyncStorage entitlement cache. Dev only. */
export async function debugClearCache(): Promise<void> {
  if (!__DEV__) return;
  await clearCachedStatus();
}

/** Dump raw RC CustomerInfo as JSON for inspection. Dev only. */
export async function debugGetRCCustomerInfo(): Promise<string> {
  if (!__DEV__) return "debug only";
  if (!isConfigured() || !Purchases) return "SDK not configured";
  try {
    const info = await Purchases.getCustomerInfo();
    return JSON.stringify(info, null, 2);
  } catch (err) {
    return `Error: ${String(err)}`;
  }
}
