import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "@/auth/AuthProvider";
import {
  PaywallResult,
  PurchaseResult,
  RestoreResult,
  SubscriptionOfferings,
  SubscriptionStatus,
  SubscriptionTier,
  addStatusListener,
  fetchSubscriptionStatus,
  getSubscriptionOfferings,
  identifySubscriptionUser,
  initSubscriptionSDK,
  presentCustomerCenter as showCustomerCenter,
  presentPaywall as showPaywall,
  purchaseProSubscription,
  resetSubscriptionUser,
  restorePurchases,
  syncProStatusToSupabase,
} from "@/lib/subscriptions";

// ─── Context type ─────────────────────────────────────────────────────────────

type SubscriptionContextType = {
  isPro: boolean;
  tier: SubscriptionTier;
  status: SubscriptionStatus | null;
  loading: boolean;
  /** Live subscription plans from RevenueCat (null while loading or SDK unconfigured). */
  offerings: SubscriptionOfferings | null;
  /**
   * Present the RevenueCat native paywall.
   * Returns whether the user activated Pro (purchased or restored).
   * After activation, Supabase is synced and context is refreshed automatically.
   */
  presentPaywall: () => Promise<PaywallResult>;
  /**
   * Present the RevenueCat Customer Center modal.
   * Handles cancellations, refunds, billing issues, and restore without custom UI.
   * Call this for Pro users from a "Manage Subscription" action.
   */
  presentCustomerCenter: () => Promise<void>;
  /** Programmatic purchase for a specific plan (fallback / dev use). */
  purchasePro: (plan?: "monthly" | "annual") => Promise<PurchaseResult>;
  /** Programmatic restore (fallback). Prefer Customer Center for the user-facing flow. */
  restore: () => Promise<RestoreResult>;
  /** Re-fetch entitlement status from RevenueCat / Supabase. */
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

const FREE_STATUS: SubscriptionStatus = {
  tier: "free",
  isPro: false,
  expiresAt: null,
  isLifetime: false,
  provider: null,
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [offerings, setOfferings] = useState<SubscriptionOfferings | null>(null);
  const [loading, setLoading] = useState(true);

  // Stamp-based refresh: only the result matching the current stamp is applied.
  // This prevents a slow concurrent refresh from overwriting a newer result.
  const refreshStamp = useRef(0);

  // Stable ref so callbacks can read the current user without stale closures
  // or needing user in their dependency arrays.
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const refresh = useCallback(async () => {
    if (!userRef.current) {
      setStatus(FREE_STATUS);
      setLoading(false);
      return;
    }
    const stamp = ++refreshStamp.current;
    try {
      const s = await fetchSubscriptionStatus(userRef.current.id);
      if (stamp === refreshStamp.current) setStatus(s);
    } catch {
      if (stamp === refreshStamp.current) setStatus(FREE_STATUS);
    } finally {
      if (stamp === refreshStamp.current) setLoading(false);
    }
  }, []); // stable — reads user via ref

  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  // ── SDK initialisation (once on mount) ────────────────────────────────────
  useEffect(() => {
    initSubscriptionSDK();
    getSubscriptionOfferings().then(setOfferings).catch(() => {});
  }, []);

  // ── User identity + status fetch (on login / logout / account switch) ─────
  useEffect(() => {
    if (user) {
      identifySubscriptionUser(user.id).catch(() => {});
    } else {
      resetSubscriptionUser().catch(() => {});
      setStatus(FREE_STATUS);
      setLoading(false);
      return;
    }
    setLoading(true);
    void refreshRef.current();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── RevenueCat real-time listener ─────────────────────────────────────────
  // Fires on purchases, renewals, revocations, billing issue resolution, etc.
  // Registered once — reads userRef so it never needs re-registration.
  useEffect(() => {
    const cleanup = addStatusListener(userRef.current?.id ?? null, (newStatus) => {
      setStatus(newStatus);
    });
    return cleanup;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Paywall ───────────────────────────────────────────────────────────────

  const presentPaywall = useCallback(async (): Promise<PaywallResult> => {
    const result = await showPaywall();
    if (result.activated && userRef.current) {
      // RC listener handles the status update; this is an extra safety sync.
      await syncProStatusToSupabase(userRef.current.id, true, {
        provider: "revenuecat",
      }).catch(() => {});
      await refreshRef.current();
    }
    return result;
  }, []);

  // ── Customer Center ───────────────────────────────────────────────────────

  const presentCustomerCenter = useCallback(async (): Promise<void> => {
    await showCustomerCenter();
    // After Customer Center closes, re-fetch status in case the user restored,
    // cancelled, or resolved a billing issue.
    await refreshRef.current();
  }, []);

  // ── Programmatic purchase (fallback) ──────────────────────────────────────

  const purchasePro = useCallback(
    async (plan: "monthly" | "annual" = "annual"): Promise<PurchaseResult> => {
      const result = await purchaseProSubscription(plan);
      if (result.success && userRef.current) {
        await syncProStatusToSupabase(userRef.current.id, true, {
          provider: "revenuecat",
        }).catch(() => {});
        await refreshRef.current();
      }
      return result;
    },
    []
  );

  const restore = useCallback(async (): Promise<RestoreResult> => {
    const result = await restorePurchases();
    if (userRef.current) {
      await syncProStatusToSupabase(userRef.current.id, result.isPro, {
        provider: result.isPro ? "revenuecat" : undefined,
      }).catch(() => {});
      await refreshRef.current();
    }
    return result;
  }, []);

  const resolved = status ?? FREE_STATUS;

  return (
    <SubscriptionContext.Provider
      value={{
        isPro: resolved.isPro,
        tier: resolved.tier,
        status: resolved,
        loading,
        offerings,
        presentPaywall,
        presentCustomerCenter,
        purchasePro,
        restore,
        refresh,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}
