/**
 * Subscription service layer.
 *
 * All RevenueCat (or native IAP) calls are isolated here.
 * The rest of the app imports only this module — never the SDK directly.
 *
 * To integrate RevenueCat:
 *   1. npm install react-native-purchases
 *   2. Run `expo run:ios` / `expo run:android` (native module)
 *   3. Replace the stub bodies below with Purchases SDK calls.
 *   4. Set EXPO_PUBLIC_REVENUECAT_IOS_KEY and EXPO_PUBLIC_REVENUECAT_ANDROID_KEY in .env
 */

import { supabase } from "@/lib/supabase";

export type SubscriptionTier = "free" | "pro";

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  isPro: boolean;
  expiresAt: Date | null;
  isLifetime: boolean;
  provider: string | null;
}

export interface PurchaseResult {
  success: boolean;
  error?: "not_configured" | "cancelled" | "network" | "unknown";
}

export interface RestoreResult {
  success: boolean;
  isPro: boolean;
  error?: string;
}

// Product identifiers — keep in sync with App Store Connect / Google Play Console.
export const PRODUCT_IDS = {
  monthly: "fishforge_pro_monthly",
  annual: "fishforge_pro_annual",
} as const;

// Displayed prices (used until RevenueCat returns live prices).
export const PRODUCT_PRICES = {
  monthly: "$4.99/month",
  annual: "$39.99/year",
  annualSavings: "save 33%",
} as const;

/**
 * Returns the current subscription status for a user.
 * Reads `is_pro` from the Supabase profiles table.
 * In production this should be reconciled with a RevenueCat customer info fetch.
 *
 * RevenueCat integration:
 *   const info = await Purchases.getCustomerInfo();
 *   const isPro = info.entitlements.active["pro"] !== undefined;
 */
export async function fetchSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_pro, subscription_tier, subscription_expires_at, subscription_provider")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return { tier: "free", isPro: false, expiresAt: null, isLifetime: false, provider: null };
  }

  const isPro = !!data.is_pro;
  const expiresAt = data.subscription_expires_at ? new Date(data.subscription_expires_at) : null;

  return {
    tier: isPro ? "pro" : "free",
    isPro,
    expiresAt,
    isLifetime: isPro && expiresAt === null,
    provider: (data.subscription_provider as string | null) ?? null,
  };
}

/**
 * Write the resolved Pro entitlement back to the Supabase profiles table.
 * Call this after a purchase, restore, or provider sync so server-side checks
 * (RLS, Edge Functions) always reflect the current entitlement state.
 *
 * RevenueCat integration: call this with isPro from customerInfo.entitlements.active["pro"]
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

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId);

  if (error) throw new Error(error.message);
}

/**
 * Initiates a Pro subscription purchase.
 * Currently a stub — returns not_configured until RevenueCat is wired up.
 *
 * RevenueCat integration:
 *   const offerings = await Purchases.getOfferings();
 *   const pkg = offerings.current?.monthly;
 *   if (!pkg) return { success: false, error: "unknown" };
 *   const { customerInfo } = await Purchases.purchasePackage(pkg);
 *   const isPro = customerInfo.entitlements.active["pro"] !== undefined;
 *   return { success: isPro };
 */
export async function purchaseProSubscription(_productId?: string): Promise<PurchaseResult> {
  // TODO: replace with Purchases.purchasePackage() when RevenueCat is configured.
  return { success: false, error: "not_configured" };
}

/**
 * Restores previous purchases (required by App Store guidelines).
 *
 * RevenueCat integration:
 *   const info = await Purchases.restorePurchases();
 *   const isPro = info.entitlements.active["pro"] !== undefined;
 *   return { success: true, isPro };
 */
export async function restorePurchases(): Promise<RestoreResult> {
  // TODO: replace with Purchases.restorePurchases() when RevenueCat is configured.
  return { success: false, isPro: false, error: "not_configured" };
}

/**
 * Initialise RevenueCat SDK at app startup.
 * Called once from the root layout before any purchase flows.
 *
 * RevenueCat integration:
 *   import Purchases, { LOG_LEVEL } from "react-native-purchases";
 *   Purchases.setLogLevel(LOG_LEVEL.DEBUG); // dev only
 *   if (Platform.OS === "ios") {
 *     Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY! });
 *   } else {
 *     Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY! });
 *   }
 *   if (userId) Purchases.logIn(userId);
 */
export function initSubscriptionSDK(_userId?: string): void {
  // TODO: initialise RevenueCat SDK here.
}
