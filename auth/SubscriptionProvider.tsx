import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "@/auth/AuthProvider";
import {
  PurchaseResult,
  RestoreResult,
  SubscriptionStatus,
  SubscriptionTier,
  fetchSubscriptionStatus,
  initSubscriptionSDK,
  purchaseProSubscription,
  restorePurchases,
  syncProStatusToSupabase,
} from "@/lib/subscriptions";

type SubscriptionContextType = {
  isPro: boolean;
  tier: SubscriptionTier;
  status: SubscriptionStatus | null;
  loading: boolean;
  purchasePro: (productId?: string) => Promise<PurchaseResult>;
  restore: () => Promise<RestoreResult>;
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

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setStatus(FREE_STATUS);
      setLoading(false);
      return;
    }
    try {
      const s = await fetchSubscriptionStatus(user.id);
      setStatus(s);
    } catch {
      setStatus(FREE_STATUS);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Initialise the SDK with the current user ID (no-op until RevenueCat is configured).
    initSubscriptionSDK(user?.id);
    setLoading(true);
    void refresh();
  }, [refresh, user?.id]);

  const purchasePro = useCallback(
    async (productId?: string): Promise<PurchaseResult> => {
      const result = await purchaseProSubscription(productId);
      if (result.success && user) {
        // Sync entitlement back to Supabase so server-side checks stay in sync
        await syncProStatusToSupabase(user.id, true, { provider: "revenuecat" }).catch(() => {});
        await refresh();
      }
      return result;
    },
    [refresh, user]
  );

  const restore = useCallback(async (): Promise<RestoreResult> => {
    const result = await restorePurchases();
    if (result.isPro && user) {
      await syncProStatusToSupabase(user.id, true, { provider: "revenuecat" }).catch(() => {});
      await refresh();
    }
    return result;
  }, [refresh, user]);

  const resolved = status ?? FREE_STATUS;

  return (
    <SubscriptionContext.Provider
      value={{
        isPro: resolved.isPro,
        tier: resolved.tier,
        status: resolved,
        loading,
        purchasePro,
        restore,
        refresh,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}
