import { subscribeToNetworkStatus, getLastKnownNetworkStatus } from "@/lib/network";
import { useEffect, useState } from "react";

export function useNetworkStatus(): boolean | null {
  const [isOnline, setIsOnline] = useState<boolean | null>(getLastKnownNetworkStatus);

  useEffect(() => {
    return subscribeToNetworkStatus(setIsOnline);
  }, []);

  return isOnline;
}
