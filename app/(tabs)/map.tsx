import { useAuth } from "@/auth/AuthProvider";
import { useFriends } from "@/auth/FriendsProvider";
import { useSubscription } from "@/auth/SubscriptionProvider";
import { ProBadge } from "@/components/ProBadge";
import { COLORS } from "@/lib/colors";
import MapZoomControls from "@/components/MapZoomControls";
import FishingSpotModal from "@/components/FishingSpotModal";
import { CatchLog, getUserCatchLogs } from "@/lib/catches";
import { getUserFacingErrorMessage, withTimeout } from "@/lib/errorHandling";
import {
  BoundingBox,
  FriendMapPin,
  FriendProfile,
  getFriendMapPins,
  getGlobalMapPins,
} from "@/lib/friends";
import { FishingSpot, getUserFishingSpots } from "@/lib/fishingSpots";
import { isLikelyNetworkError, refreshNetworkStatus } from "@/lib/network";
import { useIsFocused } from "@react-navigation/native";
import MapboxGL from "@rnmapbox/maps";
import { router } from "expo-router";
import {
  ArrowLeft,
  Bookmark,
  BookmarkPlus,
  Check,
  Flame,
  Globe,
  Layers,
  MapPin,
  Mountain,
  RefreshCcw,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "");

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterMode = "mine" | "friends" | "global";
type DateRange = "week" | "month" | "3months" | "year" | null;

type RichPin = {
  id: string;
  species: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  date: string;
  weight: string;
  length: string;
  lure: string;
  weather: string;
  userId: string | null;
  username: string;
  avatarUrl: string | null;
  markerColor: string;
  source: FilterMode;
  syncStatus?: CatchLog["syncStatus"];
  pinGroup?: string | null;
};

type PinState = {
  pins: RichPin[];
  loading: boolean;
  error: string | null;
};

type GeoPosition = [number, number]; // [longitude, latitude]

type MapBounds = {
  ne: GeoPosition;
  sw: GeoPosition;
};

// ── Constants ─────────────────────────────────────────────────────────────────

type MapStyle = "outdoors" | "standard" | "satellite";

const MAP_STYLE_URLS: Record<MapStyle, string> = {
  outdoors: "mapbox://styles/mapbox/outdoors-v12",
  standard: "mapbox://styles/mapbox/standard",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};

// Overlay registry types — architecture stub for future premium overlays
// (species heatmaps, seasonal density, weather, depth). Not rendered yet.
export type MapOverlayId = "heatmap" | "species_density" | "seasonal" | "weather" | "depth";
export type MapOverlayDef = { id: MapOverlayId; label: string; requiresPro: boolean };

const DEFAULT_CENTER: GeoPosition = [-81.841, 41.238];
const DEFAULT_ZOOM = 9;
const MAP_LOAD_TIMEOUT_MS = 12000;
const EMPTY_STATE: PinState = { pins: [], loading: false, error: null };
const DEBUG = process.env.EXPO_PUBLIC_DEBUG === "1";
const GLOBAL_REFETCH_DEBOUNCE_MS = 600;

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: null, label: "All Time" },
  { value: "week", label: "Last 7 Days" },
  { value: "month", label: "Last 30 Days" },
  { value: "3months", label: "Last 3 Months" },
  { value: "year", label: "This Year" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function dlog(message: string, payload?: unknown) {
  if (!DEBUG) return;
  console.log(payload === undefined ? `[map] ${message}` : `[map] ${message}`, payload);
}

function hasValidCoords(catchLog: CatchLog) {
  return (
    catchLog.latitude != null &&
    catchLog.longitude != null &&
    Number.isFinite(catchLog.latitude) &&
    Number.isFinite(catchLog.longitude)
  );
}

function getDateRangeCutoff(range: DateRange): Date | null {
  if (!range) return null;
  const now = new Date();
  if (range === "week") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (range === "month") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (range === "3months") return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  if (range === "year") return new Date(now.getFullYear(), 0, 1);
  return null;
}

function mapMinePin(
  catchLog: CatchLog,
  username: string,
  avatarUrl: string | null
): RichPin {
  return {
    id: catchLog.id,
    species: catchLog.species,
    latitude: catchLog.latitude as number,
    longitude: catchLog.longitude as number,
    imageUrl: catchLog.imageUrl,
    date: catchLog.date,
    weight: catchLog.weight,
    length: catchLog.length,
    lure: catchLog.lure,
    weather: catchLog.weather,
    userId: null,
    username,
    avatarUrl,
    markerColor: catchLog.syncStatus === "pending" ? "#FDBA74" : "#FD7B41",
    source: "mine",
    syncStatus: catchLog.syncStatus,
    pinGroup: catchLog.pinGroup ?? null,
  };
}

function mapRemotePin(pin: FriendMapPin, source: "friends" | "global"): RichPin {
  return {
    id: pin.id,
    species: pin.species,
    latitude: pin.latitude,
    longitude: pin.longitude,
    imageUrl: pin.imageUrl,
    date: pin.date,
    weight: pin.weight,
    length: pin.length,
    lure: pin.lure,
    weather: pin.weather,
    userId: pin.userId,
    username: pin.username,
    avatarUrl: pin.avatarUrl,
    markerColor: source === "friends" ? "#4F8CFF" : "#22C55E",
    source,
    syncStatus: "synced",
  };
}

function pinsToGeoJSON(pins: RichPin[]) {
  return {
    type: "FeatureCollection" as const,
    features: pins.map((pin) => ({
      type: "Feature" as const,
      id: pin.id,
      geometry: {
        type: "Point" as const,
        coordinates: [pin.longitude, pin.latitude] as GeoPosition,
      },
      properties: {
        id: pin.id,
        species: pin.species,
        imageUrl: pin.imageUrl,
        date: pin.date,
        weight: pin.weight,
        length: pin.length,
        lure: pin.lure,
        weather: pin.weather,
        userId: pin.userId ?? "",
        username: pin.username,
        avatarUrl: pin.avatarUrl ?? "",
        markerColor: pin.markerColor,
        source: pin.source,
        syncStatus: pin.syncStatus ?? "synced",
      },
    })),
  };
}

function spotsToGeoJSON(spots: FishingSpot[]) {
  return {
    type: "FeatureCollection" as const,
    features: spots.map((spot) => ({
      type: "Feature" as const,
      id: spot.id,
      geometry: {
        type: "Point" as const,
        coordinates: [spot.longitude, spot.latitude] as GeoPosition,
      },
      properties: {
        id: spot.id,
        name: spot.name,
        notes: spot.notes ?? "",
        visibility: spot.visibility,
      },
    })),
  };
}

function getActiveState(
  mode: FilterMode,
  mineState: PinState,
  friendsState: PinState,
  globalState: PinState
) {
  if (mode === "mine") return mineState;
  if (mode === "friends") return friendsState;
  return globalState;
}

function boundsFromPins(pins: RichPin[]): { ne: GeoPosition; sw: GeoPosition } | null {
  if (pins.length === 0) return null;
  const lngs = pins.map((p) => p.longitude);
  const lats = pins.map((p) => p.latitude);
  return {
    ne: [Math.max(...lngs), Math.max(...lats)],
    sw: [Math.min(...lngs), Math.min(...lats)],
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CatchMapScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const { profile, user } = useAuth();
  const { friends } = useFriends();
  const { isPro } = useSubscription();

  // Map readiness
  const [isMapReady, setIsMapReady] = useState(false);

  // Filter mode
  const [filterMode, setFilterMode] = useState<FilterMode>("mine");
  const [selectedFriendId, setSelectedFriendId] = useState<string>("all");

  // Pin data
  const [mineState, setMineState] = useState<PinState>({ pins: [], loading: true, error: null });
  const [friendsState, setFriendsState] = useState<PinState>({ pins: [], loading: true, error: null });
  const [globalState, setGlobalState] = useState<PinState>(EMPTY_STATE);

  // Selected pin callout
  const [selectedPin, setSelectedPin] = useState<RichPin | null>(null);

  // Fishing spots
  const [spots, setSpots] = useState<FishingSpot[]>([]);
  const [showSpots, setShowSpots] = useState(true);
  const [selectedSpot, setSelectedSpot] = useState<FishingSpot | null>(null);
  const [spotsLoading, setSpotsLoading] = useState(false);
  const [addingSpot, setAddingSpot] = useState(false);
  const [pendingSpotCoords, setPendingSpotCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [editingSpot, setEditingSpot] = useState<FishingSpot | null>(null);

  // Filtering
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [filterSpecies, setFilterSpecies] = useState<string | null>(null);
  const [filterDateRange, setFilterDateRange] = useState<DateRange>(null);

  // Map style
  const [mapStyle, setMapStyle] = useState<MapStyle>("outdoors");
  const [showStylePicker, setShowStylePicker] = useState(false);

  // Layer visibility
  const [showCatches, setShowCatches] = useState(true);

  // Heatmap
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Pin group filter (mine-mode only)
  const [filterPinGroup, setFilterPinGroup] = useState<string | null>(null);

  // Network + viewport
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [globalFetchToken, setGlobalFetchToken] = useState(0);

  // Refs that update without re-renders
  const currentBoundsRef = useRef<MapBounds | null>(null);
  const currentZoomRef = useRef(DEFAULT_ZOOM);
  const currentCenterRef = useRef<GeoPosition>(DEFAULT_CENTER);
  const globalDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether the camera should auto-fit on the next renderablePins update.
  // Set to true on initial load and on filterMode changes; consumed once fit executes.
  const fitRequestedRef = useRef(true);

  // ── Derived state ──────────────────────────────────────────────────────────

  const filteredFriendPins = useMemo(() => {
    if (selectedFriendId === "all") return friendsState.pins;
    return friendsState.pins.filter((pin) => pin.userId === selectedFriendId);
  }, [friendsState.pins, selectedFriendId]);

  const activeState = getActiveState(filterMode, mineState, friendsState, globalState);
  const activePins = filterMode === "friends" ? filteredFriendPins : activeState.pins;

  const renderablePins = useMemo(() => {
    let pins = activePins.filter(
      (pin) => Number.isFinite(pin.latitude) && Number.isFinite(pin.longitude)
    );

    if (filterSpecies) {
      pins = pins.filter((pin) => pin.species === filterSpecies);
    }

    if (filterDateRange) {
      const cutoff = getDateRangeCutoff(filterDateRange);
      if (cutoff) {
        pins = pins.filter((pin) => {
          if (!pin.date) return false;
          return new Date(pin.date) >= cutoff;
        });
      }
    }

    if (filterPinGroup) {
      pins = pins.filter(
        (pin) => pin.pinGroup?.toLowerCase() === filterPinGroup.toLowerCase()
      );
    }

    return pins;
  }, [activePins, filterSpecies, filterDateRange, filterPinGroup]);

  // Unique species in the currently active pin set (for filter sheet)
  const availableSpecies = useMemo(() => {
    const seen = new Set<string>();
    for (const pin of activePins) {
      if (pin.species && pin.species !== "Unknown") seen.add(pin.species);
    }
    return [...seen].sort();
  }, [activePins]);

  // Unique pin groups from the mine data set — shown regardless of current filter
  // so the user can switch between groups without losing the list.
  const availablePinGroups = useMemo(() => {
    if (filterMode !== "mine") return [];
    const seen = new Set<string>();
    for (const pin of mineState.pins) {
      if (pin.pinGroup) seen.add(pin.pinGroup);
    }
    return [...seen].sort();
  }, [filterMode, mineState.pins]);

  const hasActiveError = !!activeState.error && activePins.length === 0;
  const isActiveLoading = activeState.loading;
  const hasActiveFilters = !!filterSpecies || !!filterDateRange || !!filterPinGroup;
  const activeFilterCount = (filterSpecies ? 1 : 0) + (filterDateRange ? 1 : 0) + (filterPinGroup ? 1 : 0);

  const catchesGeoJSON = useMemo(() => pinsToGeoJSON(renderablePins), [renderablePins]);
  const spotsGeoJSON = useMemo(() => spotsToGeoJSON(spots), [spots]);
  const heatmapGeoJSON = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: renderablePins.map((pin) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [pin.longitude, pin.latitude] as GeoPosition },
        properties: {},
      })),
    }),
    [renderablePins]
  );

  const clusterColor =
    filterMode === "mine" ? "#FD7B41" : filterMode === "friends" ? "#4F8CFF" : "#22C55E";

  const modeAccent =
    filterMode === "mine" ? COLORS.primary : filterMode === "friends" ? "#4F8CFF" : "#22C55E";

  // ── Effects: load mine + friends ──────────────────────────────────────────

  useEffect(() => {
    if (!isFocused) return;
    let cancelled = false;

    const loadMineAndFriends = async () => {
      setSelectedPin(null);
      setMineState((prev) => ({ ...prev, loading: true, error: null }));
      setFriendsState((prev) => ({ ...prev, loading: true, error: null }));

      const online = await refreshNetworkStatus().catch(() => false);
      if (cancelled) return;
      setIsOnline(online);

      if (!user) {
        if (!cancelled) {
          setMineState(EMPTY_STATE);
          setFriendsState(EMPTY_STATE);
        }
        return;
      }

      const [mineResult, friendsResult] = await Promise.allSettled([
        withTimeout(
          getUserCatchLogs(user.id),
          MAP_LOAD_TIMEOUT_MS,
          "Loading your catch pins took too long."
        ),
        online
          ? withTimeout(
              getFriendMapPins(friends.map((f) => f.id)),
              MAP_LOAD_TIMEOUT_MS,
              "Loading your friends' pins took too long."
            )
          : Promise.resolve([] as FriendMapPin[]),
      ]);

      if (cancelled) return;

      if (mineResult.status === "fulfilled") {
        dlog("mine rows loaded", mineResult.value.length);
        setMineState({
          pins: mineResult.value
            .filter(hasValidCoords)
            .map((c) => mapMinePin(c, profile?.username ?? "Me", profile?.avatar_url ?? null)),
          loading: false,
          error: null,
        });
      } else {
        setMineState({
          pins: [],
          loading: false,
          error:
            !online && isLikelyNetworkError(mineResult.reason)
              ? null
              : getUserFacingErrorMessage(
                  mineResult.reason,
                  "Unable to load your catches on the map."
                ),
        });
      }

      if (friendsResult.status === "fulfilled") {
        dlog("friend rows loaded", friendsResult.value.length);
        setFriendsState({
          pins: friendsResult.value.map((pin) => mapRemotePin(pin, "friends")),
          loading: false,
          error: null,
        });
      } else {
        setFriendsState({
          pins: [],
          loading: false,
          error:
            !online && isLikelyNetworkError(friendsResult.reason)
              ? null
              : getUserFacingErrorMessage(
                  friendsResult.reason,
                  "Unable to load your friends' catches."
                ),
        });
      }
    };

    void loadMineAndFriends();
    return () => { cancelled = true; };
  }, [friends, isFocused, profile?.avatar_url, profile?.username, reloadToken, user]);

  // ── Effects: load global pins (viewport-based) ────────────────────────────

  useEffect(() => {
    if (filterMode !== "global" || !isFocused) return;
    let cancelled = false;

    const loadGlobal = async () => {
      setGlobalState((prev) => ({
        ...prev,
        loading: prev.pins.length === 0,
        error: null,
      }));

      const online = await refreshNetworkStatus().catch(() => false);
      if (cancelled) return;
      setIsOnline(online);

      if (!online) {
        setGlobalState((prev) => ({ pins: prev.pins, loading: false, error: null }));
        return;
      }

      try {
        const bounds = currentBoundsRef.current;
        const bbox: BoundingBox | undefined = bounds
          ? {
              minLat: bounds.sw[1],
              maxLat: bounds.ne[1],
              minLng: bounds.sw[0],
              maxLng: bounds.ne[0],
            }
          : undefined;

        const rows = await withTimeout(
          getGlobalMapPins(bbox),
          MAP_LOAD_TIMEOUT_MS,
          "Loading global pins took too long."
        );

        if (cancelled) return;
        dlog("global rows loaded", rows.length);
        setGlobalState({
          pins: rows.map((pin) => mapRemotePin(pin, "global")),
          loading: false,
          error: null,
        });
      } catch (error) {
        if (!cancelled) {
          setGlobalState({
            pins: [],
            loading: false,
            error: getUserFacingErrorMessage(error, "Unable to load global catches."),
          });
        }
      }
    };

    void loadGlobal();
    return () => { cancelled = true; };
  }, [filterMode, isFocused, reloadToken, globalFetchToken]);

  // ── Effects: load fishing spots ───────────────────────────────────────────

  useEffect(() => {
    if (!user || !isFocused) return;
    let cancelled = false;

    const loadSpots = async () => {
      setSpotsLoading(true);
      try {
        const data = await getUserFishingSpots(user.id);
        if (!cancelled) setSpots(data);
      } catch {
        // spots failure is non-critical — silently ignore
      } finally {
        if (!cancelled) setSpotsLoading(false);
      }
    };

    void loadSpots();
    return () => { cancelled = true; };
  }, [user, isFocused, reloadToken]);

  // ── Effects: reset selection on filter/mode change ───────────────────────

  useEffect(() => {
    setSelectedPin(null);
    setSelectedSpot(null);
  }, [filterMode, selectedFriendId]);

  // Clear pin group filter when leaving mine mode (groups are personal)
  useEffect(() => {
    if (filterMode !== "mine") setFilterPinGroup(null);
  }, [filterMode]);

  // Request a camera fit whenever the user switches filter modes
  useEffect(() => {
    fitRequestedRef.current = true;
  }, [filterMode]);

  // ── Effects: fit viewport to pins after map ready / mode change ──────────
  // fitRequestedRef gates the fit so it only fires on initial load and mode
  // switches — NOT on species/date/group filter chip changes.

  useEffect(() => {
    if (!isMapReady || !fitRequestedRef.current || renderablePins.length === 0) return;
    fitRequestedRef.current = false;

    if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);

    const pins = renderablePins;
    viewportTimerRef.current = setTimeout(() => {
      if (pins.length === 1) {
        cameraRef.current?.setCamera({
          centerCoordinate: [pins[0].longitude, pins[0].latitude],
          zoomLevel: 13,
          animationDuration: 220,
        });
        return;
      }

      const bounds = boundsFromPins(pins);
      if (bounds) {
        cameraRef.current?.fitBounds(bounds.ne, bounds.sw, [180, 48, 180, 48], 220);
      }
    }, 0);

    return () => {
      if (viewportTimerRef.current) {
        clearTimeout(viewportTimerRef.current);
        viewportTimerRef.current = null;
      }
    };
  }, [isMapReady, renderablePins]);

  // ── Effects: dismiss stale callout when selected pin is filtered out ──────

  useEffect(() => {
    if (selectedPin !== null && !renderablePins.some((p) => p.id === selectedPin.id)) {
      setSelectedPin(null);
    }
    // selectedPin intentionally omitted: we only want this when renderablePins changes,
    // not when selectedPin changes (would cause a re-fire loop via setSelectedPin).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderablePins]);

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const handleCameraChanged = useCallback(
    (state: {
      properties: {
        center: GeoPosition;
        zoom: number;
        bounds: { ne: GeoPosition; sw: GeoPosition };
      };
    }) => {
      currentCenterRef.current = state.properties.center;
      currentZoomRef.current = state.properties.zoom;
      currentBoundsRef.current = {
        ne: state.properties.bounds.ne,
        sw: state.properties.bounds.sw,
      };

      if (filterMode === "global" && isFocused) {
        if (globalDebounceRef.current) clearTimeout(globalDebounceRef.current);
        globalDebounceRef.current = setTimeout(() => {
          setGlobalFetchToken((t) => t + 1);
        }, GLOBAL_REFETCH_DEBOUNCE_MS);
      }
    },
    [filterMode, isFocused]
  );

  const handlePinPress = useCallback(
    (e: { features: Array<{ id?: string | number; properties: Record<string, unknown> | null }> }) => {
      const feature = e.features[0];
      if (!feature || feature.properties?.cluster) return;
      const pinId = feature.properties?.id as string;
      const pin = renderablePins.find((p) => p.id === pinId);
      if (pin) {
        setSelectedPin(pin);
        setSelectedSpot(null);
      }
    },
    [renderablePins]
  );

  const handleSpotPress = useCallback(
    (e: { features: Array<{ properties: Record<string, unknown> | null }> }) => {
      const feature = e.features[0];
      if (!feature) return;
      const spotId = feature.properties?.id as string;
      const spot = spots.find((s) => s.id === spotId);
      if (spot) {
        setSelectedSpot(spot);
        setSelectedPin(null);
      }
    },
    [spots]
  );

  const handleMapPress = useCallback(() => {
    if (addingSpot) return; // long-press handles spot placement
    setSelectedPin(null);
    setSelectedSpot(null);
  }, [addingSpot]);

  const handleMapLongPress = useCallback(
    (e: { geometry: { coordinates: GeoPosition } }) => {
      if (!addingSpot) return;
      const [lng, lat] = e.geometry.coordinates;
      setPendingSpotCoords({ latitude: lat, longitude: lng });
    },
    [addingSpot]
  );

  const handleZoom = useCallback((direction: "in" | "out") => {
    const next =
      direction === "in"
        ? Math.min(currentZoomRef.current + 1, 20)
        : Math.max(currentZoomRef.current - 1, 1);
    currentZoomRef.current = next;
    cameraRef.current?.setCamera({ zoomLevel: next, animationDuration: 180 });
  }, []);

  // ── Spot actions ──────────────────────────────────────────────────────────

  const handleAddSpotFromCenter = useCallback(() => {
    const [lng, lat] = currentCenterRef.current;
    setPendingSpotCoords({ latitude: lat, longitude: lng });
  }, []);

  const handleSpotSaved = useCallback((spot: FishingSpot) => {
    setSpots((prev) => {
      const idx = prev.findIndex((s) => s.id === spot.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = spot;
        return next;
      }
      return [spot, ...prev];
    });
    setPendingSpotCoords(null);
    setEditingSpot(null);
    setAddingSpot(false);
  }, []);

  const handleSpotDeleted = useCallback((id: string) => {
    setSpots((prev) => prev.filter((s) => s.id !== id));
    setSelectedSpot(null);
    setEditingSpot(null);
  }, []);

  // ── Layer styles ──────────────────────────────────────────────────────────

  const clusterCircleStyle = useMemo(
    () => ({
      circleColor: clusterColor,
      circleRadius: ["step", ["get", "point_count"], 20, 10, 25, 50, 30] as any,
      circleOpacity: 1.0,
      circleStrokeWidth: 3,
      circleStrokeColor: "#ffffff",
      circleStrokeOpacity: 0.95,
    }),
    [clusterColor]
  );

  const clusterTextStyle = useMemo(
    () => ({
      textField: ["get", "point_count_abbreviated"] as any,
      textFont: ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
      textSize: 13,
      textColor: "#ffffff",
      textAllowOverlap: true,
      textIgnorePlacement: true,
    }),
    []
  );

  const singlePinStyle = useMemo(
    () => ({
      circleColor: ["get", "markerColor"] as any,
      circleRadius: 9,
      circleStrokeWidth: 2.5,
      circleStrokeColor: "#ffffff",
      circleStrokeOpacity: 0.92,
    }),
    []
  );

  const spotCircleStyle = useMemo(
    () => ({
      circleColor: "rgba(253,123,65,0.18)",
      circleRadius: 10,
      circleStrokeWidth: 2.5,
      circleStrokeColor: COLORS.primary,
      circleStrokeOpacity: 1,
    }),
    []
  );

  const heatmapLayerStyle = useMemo(
    () => ({
      heatmapWeight: 1,
      heatmapIntensity: ["interpolate", ["linear"], ["zoom"], 0, 1, 9, 3, 15, 5] as any,
      heatmapColor: [
        "interpolate", ["linear"], ["heatmap-density"],
        0,   "rgba(0,0,0,0)",
        0.15,"rgba(65,100,200,0.5)",
        0.4, "rgba(99,200,160,0.8)",
        0.65,"rgba(253,183,65,0.95)",
        0.85,"rgba(253,123,65,1.0)",
        1.0, "rgba(255,255,255,1)",
      ] as any,
      heatmapRadius: ["interpolate", ["linear"], ["zoom"], 0, 5, 9, 22, 15, 45] as any,
      heatmapOpacity: 0.82,
    }),
    []
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={MAP_STYLE_URLS[mapStyle]}
        onDidFinishLoadingMap={() => setIsMapReady(true)}
        onCameraChanged={handleCameraChanged as any}
        onPress={handleMapPress as any}
        onLongPress={handleMapLongPress as any}
        compassEnabled={false}
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: DEFAULT_CENTER,
            zoomLevel: DEFAULT_ZOOM,
          }}
        />

        {/* Catch density heatmap — rendered below pins */}
        {showHeatmap && renderablePins.length >= 2 && (
          <MapboxGL.ShapeSource id="heatmap-source" shape={heatmapGeoJSON}>
            <MapboxGL.HeatmapLayer id="heatmap-layer" style={heatmapLayerStyle} />
          </MapboxGL.ShapeSource>
        )}

        {/* Catch markers with clustering */}
        {showCatches && (
          <MapboxGL.ShapeSource
            id="catches-source"
            shape={catchesGeoJSON}
            cluster
            clusterRadius={48}
            clusterMaxZoomLevel={14}
            onPress={handlePinPress as any}
          >
            <MapboxGL.CircleLayer
              id="clusters-circle"
              filter={["has", "point_count"]}
              style={clusterCircleStyle}
            />
            <MapboxGL.SymbolLayer
              id="clusters-count"
              filter={["has", "point_count"]}
              style={clusterTextStyle}
            />
            <MapboxGL.CircleLayer
              id="single-pins"
              filter={["!", ["has", "point_count"]]}
              style={singlePinStyle}
            />
          </MapboxGL.ShapeSource>
        )}

        {/* Fishing spots layer */}
        {showSpots && spots.length > 0 && (
          <MapboxGL.ShapeSource
            id="spots-source"
            shape={spotsGeoJSON}
            onPress={handleSpotPress as any}
          >
            <MapboxGL.CircleLayer id="spots-circle" style={spotCircleStyle} />
          </MapboxGL.ShapeSource>
        )}
      </MapboxGL.MapView>

      {/* Header fade behind controls */}
      <View style={styles.headerGradient} pointerEvents="none">
        <View style={styles.headerGradientTop} />
        <View style={styles.headerGradientMid} />
        <View style={styles.headerGradientBottom} />
      </View>

      {/* Add spot crosshair overlay */}
      {addingSpot && (
        <View style={styles.addSpotOverlay} pointerEvents="none">
          <View style={styles.addSpotHint}>
            <Text style={styles.addSpotHintText}>Long-press the map to place your spot</Text>
          </View>
        </View>
      )}

      <MapZoomControls
        onZoomIn={() => handleZoom("in")}
        onZoomOut={() => handleZoom("out")}
        style={{ top: insets.top + (Platform.OS === "android" ? 152 : 148) }}
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + (Platform.OS === "android" ? 6 : 2) },
        ]}
        pointerEvents="box-none"
      >
        {/* Row 1: back button + action controls */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => {
              if (addingSpot) {
                setAddingSpot(false);
              } else {
                router.replace("/(tabs)/home");
              }
            }}
            style={styles.backButton}
          >
            <ArrowLeft color={COLORS.text} size={18} strokeWidth={2.4} />
          </Pressable>

          <View style={{ flex: 1 }} />

          <View style={styles.headerActions}>
            {!addingSpot && (
              <>
                <View style={styles.actionsGroup}>
                  <Pressable
                    onPress={() => setShowFilterSheet(true)}
                    style={[styles.groupBtn, hasActiveFilters && styles.groupBtnActive]}
                  >
                    <SlidersHorizontal
                      color={hasActiveFilters ? COLORS.primary : COLORS.text}
                      size={15}
                      strokeWidth={2.2}
                    />
                    {activeFilterCount > 0 && (
                      <View style={styles.filterCountBadge}>
                        <Text style={styles.filterCountText}>{activeFilterCount}</Text>
                      </View>
                    )}
                  </Pressable>
                  <View style={styles.groupDivider} />
                  <Pressable
                    onPress={() => setShowStylePicker((v) => !v)}
                    style={[styles.groupBtn, showStylePicker && styles.groupBtnActive]}
                  >
                    <Layers
                      color={showStylePicker ? COLORS.primary : COLORS.text}
                      size={15}
                      strokeWidth={2.2}
                    />
                  </Pressable>
                  <View style={styles.groupDivider} />
                  <Pressable
                    onPress={() => { setAddingSpot(true); setShowSpots(true); }}
                    style={styles.groupBtn}
                  >
                    <BookmarkPlus color={COLORS.text} size={15} strokeWidth={2.2} />
                  </Pressable>
                </View>

                <View style={[styles.countChip, { borderColor: `${modeAccent}44` }]}>
                  {isActiveLoading ? (
                    <ActivityIndicator size="small" color={modeAccent} />
                  ) : (
                    <Text style={[styles.countText, { color: modeAccent }]}>{renderablePins.length}</Text>
                  )}
                </View>
              </>
            )}

            {addingSpot && (
              <Pressable onPress={handleAddSpotFromCenter} style={styles.placeButton}>
                <Text style={styles.placeButtonText}>Place Here</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Row 2: filter mode toggle */}
        {!addingSpot && (
          <View style={styles.headerToggleRow}>
            <FilterToggle
              mode={filterMode}
              activeColor={modeAccent}
              onChange={(mode) => {
                setFilterMode(mode);
                if (mode !== "friends") setSelectedFriendId("all");
              }}
            />
          </View>
        )}

        {addingSpot && (
          <View style={styles.headerToggleRow}>
            <View style={styles.addingSpotBanner}>
              <Text style={styles.addingSpotText}>Adding Spot Mode</Text>
            </View>
          </View>
        )}

        {/* Row 3: friend chips (only in friends mode) */}
        {filterMode === "friends" && !addingSpot && (
          <FriendSelector
            friends={friends}
            selectedFriendId={selectedFriendId}
            onSelect={setSelectedFriendId}
          />
        )}
      </View>

      {/* Layer controls panel */}
      {!addingSpot && (
        <MapLayerPanel
          showCatches={showCatches}
          onToggleCatches={() => setShowCatches((v) => !v)}
          showSpots={showSpots}
          onToggleSpots={() => setShowSpots((v) => !v)}
          hasSpots={spots.length > 0}
          showHeatmap={showHeatmap}
          onToggleHeatmap={() =>
            isPro ? setShowHeatmap((v) => !v) : router.push("/pro")
          }
          isPro={isPro}
          style={{ top: insets.top + (Platform.OS === "android" ? 152 : 148) }}
        />
      )}

      {/* Map style picker */}
      {showStylePicker && !addingSpot && (
        <MapStylePicker
          current={mapStyle}
          isPro={isPro}
          onSelect={(style) => {
            if (style === "satellite" && !isPro) {
              setShowStylePicker(false);
              router.push("/pro");
              return;
            }
            setMapStyle(style);
            setShowStylePicker(false);
          }}
          onClose={() => setShowStylePicker(false)}
          insetTop={insets.top + (Platform.OS === "android" ? 8 : 4)}
        />
      )}

      {/* Loading overlay */}
      {isActiveLoading && (
        <View style={[styles.overlayCard, { top: insets.top + 78 }]}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.overlayTitle}>Loading map data...</Text>
        </View>
      )}

      {/* Error overlay */}
      {!isActiveLoading && hasActiveError && (
        <View style={[styles.overlayCard, { top: insets.top + 78 }]}>
          <Text style={styles.overlayTitle}>Map data couldn&apos;t load</Text>
          <Text style={styles.overlayText}>{activeState.error}</Text>
          <Pressable
            style={styles.overlayButton}
            onPress={() => setReloadToken((v) => v + 1)}
          >
            <RefreshCcw color="#000" size={14} strokeWidth={2.2} />
            <Text style={styles.overlayButtonText}>Try Again</Text>
          </Pressable>
        </View>
      )}

      {/* Empty overlay */}
      {!isActiveLoading && !hasActiveError && renderablePins.length === 0 && (
        <View style={[styles.overlayCard, { top: insets.top + 78 }]}>
          <Text style={styles.overlayTitle}>
            {getEmptyTitle(filterMode, selectedFriendId, hasActiveFilters)}
          </Text>
          <Text style={styles.overlayText}>
            {getEmptyMessage(filterMode, selectedFriendId, isOnline, hasActiveFilters)}
          </Text>
          {hasActiveFilters && (
            <Pressable
              style={styles.overlayButton}
              onPress={() => {
                setFilterSpecies(null);
                setFilterDateRange(null);
                setFilterPinGroup(null);
              }}
            >
              <X color="#000" size={14} strokeWidth={2.2} />
              <Text style={styles.overlayButtonText}>Clear Filters</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Catch callout card */}
      {selectedPin && (
        <View style={[styles.calloutCard, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.calloutHandle} />
          <View style={styles.calloutRow}>
            <Pressable
              style={styles.calloutContent}
              onPress={() => {
                setSelectedPin(null);
                if (selectedPin.userId === null) {
                  router.push(`/catches/${selectedPin.id}`);
                } else {
                  router.push(`/user/catch/${selectedPin.id}`);
                }
              }}
            >
              {selectedPin.imageUrl ? (
                <Image source={{ uri: selectedPin.imageUrl }} style={styles.calloutImage} />
              ) : (
                <View style={[styles.calloutImage, styles.calloutImageFallback]}>
                  <MapPin color={COLORS.textSecondary} size={20} strokeWidth={1.5} />
                </View>
              )}

              <View style={styles.calloutDetails}>
                <Text style={styles.calloutSpecies} numberOfLines={1}>
                  {selectedPin.species || "Unknown Species"}
                </Text>
                {(!!selectedPin.length || !!selectedPin.weight) && (
                  <Text style={styles.calloutMeta}>
                    {[selectedPin.length, selectedPin.weight].filter(Boolean).join(" · ")}
                  </Text>
                )}
                {!!selectedPin.date && (
                  <Text style={styles.calloutMeta}>{selectedPin.date}</Text>
                )}
                {(!!selectedPin.lure || !!selectedPin.weather) && (
                  <Text style={styles.calloutMeta}>
                    {[selectedPin.lure, selectedPin.weather].filter(Boolean).join(" · ")}
                  </Text>
                )}
                {!!selectedPin.pinGroup && (
                  <View style={styles.calloutPinGroup}>
                    <Tag size={10} color={COLORS.primary} strokeWidth={2} />
                    <Text style={styles.calloutPinGroupText}>{selectedPin.pinGroup}</Text>
                  </View>
                )}
                {selectedPin.syncStatus === "pending" && (
                  <Text style={styles.pendingSyncText}>
                    Saved offline — syncing when online.
                  </Text>
                )}
              </View>
            </Pressable>

            <Pressable style={styles.calloutClose} onPress={() => setSelectedPin(null)}>
              <X color={COLORS.textSecondary} size={18} strokeWidth={2} />
            </Pressable>
          </View>

          {selectedPin.userId !== null && (
            <Pressable
              style={styles.calloutAnglerRow}
              onPress={() => {
                setSelectedPin(null);
                router.push(`/user/${selectedPin.userId}`);
              }}
            >
              {selectedPin.avatarUrl ? (
                <Image source={{ uri: selectedPin.avatarUrl }} style={styles.calloutAvatar} />
              ) : (
                <View style={[styles.calloutAvatar, styles.calloutAvatarFallback]}>
                  <Text style={styles.calloutAvatarInitial}>
                    {selectedPin.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.calloutProfileCopy}>
                <Text style={styles.calloutAnglerName}>{selectedPin.username}</Text>
                <Text style={styles.calloutAnglerSub}>Tap to view profile</Text>
              </View>
            </Pressable>
          )}
        </View>
      )}

      {/* Spot callout card */}
      {selectedSpot && (
        <View style={[styles.calloutCard, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.calloutHandle} />
          <View style={styles.calloutRow}>
            <View style={[styles.calloutImage, styles.spotIconBox]}>
              <Bookmark color={COLORS.primary} size={22} strokeWidth={1.8} />
            </View>
            <View style={styles.calloutDetails}>
              <Text style={styles.calloutSpecies} numberOfLines={1}>
                {selectedSpot.name}
              </Text>
              {!!selectedSpot.notes && (
                <Text style={styles.calloutMeta} numberOfLines={2}>
                  {selectedSpot.notes}
                </Text>
              )}
              <Text style={styles.calloutMeta}>
                {selectedSpot.latitude.toFixed(4)}, {selectedSpot.longitude.toFixed(4)}
              </Text>
            </View>
            <View style={styles.calloutActionsColumn}>
              <Pressable
                style={styles.calloutClose}
                onPress={() => setSelectedSpot(null)}
              >
                <X color={COLORS.textSecondary} size={18} strokeWidth={2} />
              </Pressable>
              <Pressable
                style={[styles.calloutClose, { marginTop: 6 }]}
                onPress={() => {
                  setEditingSpot(selectedSpot);
                  setSelectedSpot(null);
                }}
              >
                <SlidersHorizontal color={COLORS.textSecondary} size={16} strokeWidth={2} />
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Filter sheet */}
      {showFilterSheet && (
        <FilterSheet
          availableSpecies={availableSpecies}
          availablePinGroups={availablePinGroups}
          filterSpecies={filterSpecies}
          filterDateRange={filterDateRange}
          filterPinGroup={filterPinGroup}
          onSpeciesChange={setFilterSpecies}
          onDateRangeChange={setFilterDateRange}
          onPinGroupChange={setFilterPinGroup}
          onClearAll={() => {
            setFilterSpecies(null);
            setFilterDateRange(null);
            setFilterPinGroup(null);
          }}
          onClose={() => setShowFilterSheet(false)}
          insetBottom={insets.bottom}
        />
      )}

      {/* Add spot modal */}
      {pendingSpotCoords && (
        <FishingSpotModal
          mode="add"
          latitude={pendingSpotCoords.latitude}
          longitude={pendingSpotCoords.longitude}
          onSave={handleSpotSaved}
          onClose={() => {
            setPendingSpotCoords(null);
            setAddingSpot(false);
          }}
        />
      )}

      {/* Edit spot modal */}
      {editingSpot && (
        <FishingSpotModal
          mode="edit"
          spot={editingSpot}
          onSave={handleSpotSaved}
          onDelete={handleSpotDeleted}
          onClose={() => setEditingSpot(null)}
        />
      )}
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FilterToggle({
  mode,
  activeColor,
  onChange,
}: {
  mode: FilterMode;
  activeColor: string;
  onChange: (mode: FilterMode) => void;
}) {
  return (
    <View style={toggleStyles.wrap}>
      {(["mine", "friends", "global"] as FilterMode[]).map((option) => (
        <Pressable
          key={option}
          style={[
            toggleStyles.btn,
            mode === option && { backgroundColor: activeColor },
          ]}
          onPress={() => onChange(option)}
        >
          <Text style={[toggleStyles.label, mode === option && toggleStyles.labelActive]}>
            {option === "mine" ? "Mine" : option === "friends" ? "Friends" : "Global"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function FriendSelector({
  friends,
  selectedFriendId,
  onSelect,
}: {
  friends: FriendProfile[];
  selectedFriendId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.friendSelectorContent}
      style={styles.friendSelector}
    >
      <Pressable
        style={[styles.friendChip, selectedFriendId === "all" && styles.friendChipActive]}
        onPress={() => onSelect("all")}
      >
        <Text style={[styles.friendChipText, selectedFriendId === "all" && styles.friendChipTextActive]}>
          All Friends
        </Text>
      </Pressable>
      {friends.map((friend) => (
        <Pressable
          key={friend.id}
          style={[styles.friendChip, selectedFriendId === friend.id && styles.friendChipActive]}
          onPress={() => onSelect(friend.id)}
        >
          <Text
            style={[styles.friendChipText, selectedFriendId === friend.id && styles.friendChipTextActive]}
            numberOfLines={1}
          >
            {friend.username}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function FilterSheet({
  availableSpecies,
  availablePinGroups,
  filterSpecies,
  filterDateRange,
  filterPinGroup,
  onSpeciesChange,
  onDateRangeChange,
  onPinGroupChange,
  onClearAll,
  onClose,
  insetBottom,
}: {
  availableSpecies: string[];
  availablePinGroups: string[];
  filterSpecies: string | null;
  filterDateRange: DateRange;
  filterPinGroup: string | null;
  onSpeciesChange: (s: string | null) => void;
  onDateRangeChange: (d: DateRange) => void;
  onPinGroupChange: (g: string | null) => void;
  onClearAll: () => void;
  onClose: () => void;
  insetBottom: number;
}) {
  const hasAnyFilter = !!filterSpecies || !!filterDateRange || !!filterPinGroup;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={[styles.sheetContainer, { paddingBottom: insetBottom + 16 }]}>
        <View style={styles.sheetHandle} />

        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Filter Catches</Text>
          {hasAnyFilter && (
            <Pressable onPress={onClearAll} style={styles.clearAllButton}>
              <Text style={styles.clearAllText}>Clear All</Text>
            </Pressable>
          )}
          <Pressable onPress={onClose} style={styles.sheetClose}>
            <X color={COLORS.textSecondary} size={18} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Date range */}
        <Text style={styles.sheetSectionLabel}>Time Range</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipRow}
        >
          {DATE_RANGE_OPTIONS.map((opt) => (
            <Pressable
              key={String(opt.value)}
              style={[
                styles.filterChip,
                filterDateRange === opt.value && styles.filterChipActive,
              ]}
              onPress={() => onDateRangeChange(opt.value)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterDateRange === opt.value && styles.filterChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Species */}
        {availableSpecies.length > 0 && (
          <>
            <Text style={[styles.sheetSectionLabel, { marginTop: 16 }]}>Species</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipRow}
            >
              <Pressable
                style={[styles.filterChip, filterSpecies === null && styles.filterChipActive]}
                onPress={() => onSpeciesChange(null)}
              >
                <Text
                  style={[styles.filterChipText, filterSpecies === null && styles.filterChipTextActive]}
                >
                  All
                </Text>
              </Pressable>
              {availableSpecies.map((sp) => (
                <Pressable
                  key={sp}
                  style={[styles.filterChip, filterSpecies === sp && styles.filterChipActive]}
                  onPress={() => onSpeciesChange(filterSpecies === sp ? null : sp)}
                >
                  <Text
                    style={[styles.filterChipText, filterSpecies === sp && styles.filterChipTextActive]}
                  >
                    {sp}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {/* Pin Groups — only shown in "mine" mode (availablePinGroups is empty otherwise) */}
        {availablePinGroups.length > 0 && (
          <>
            <Text style={[styles.sheetSectionLabel, { marginTop: 16 }]}>Pin Group</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipRow}
            >
              <Pressable
                style={[styles.filterChip, filterPinGroup === null && styles.filterChipActive]}
                onPress={() => onPinGroupChange(null)}
              >
                <Text
                  style={[styles.filterChipText, filterPinGroup === null && styles.filterChipTextActive]}
                >
                  All
                </Text>
              </Pressable>
              {availablePinGroups.map((group) => (
                <Pressable
                  key={group}
                  style={[
                    styles.filterChip,
                    filterPinGroup?.toLowerCase() === group.toLowerCase() && styles.filterChipActive,
                  ]}
                  onPress={() =>
                    onPinGroupChange(
                      filterPinGroup?.toLowerCase() === group.toLowerCase() ? null : group
                    )
                  }
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      filterPinGroup?.toLowerCase() === group.toLowerCase() &&
                        styles.filterChipTextActive,
                    ]}
                  >
                    {group}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        <Pressable style={[styles.doneButton, { marginTop: 20 }]} onPress={onClose}>
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function MapLayerPanel({
  showCatches,
  onToggleCatches,
  showSpots,
  onToggleSpots,
  hasSpots,
  showHeatmap,
  onToggleHeatmap,
  isPro,
  style,
}: {
  showCatches: boolean;
  onToggleCatches: () => void;
  showSpots: boolean;
  onToggleSpots: () => void;
  hasSpots: boolean;
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  isPro: boolean;
  style?: object;
}) {
  return (
    <View style={[layerPanelStyles.wrap, style]} pointerEvents="box-none">
      {/* Catches */}
      <Pressable
        style={[layerPanelStyles.btn, showCatches && layerPanelStyles.btnActive]}
        onPress={onToggleCatches}
      >
        <MapPin
          color={showCatches ? COLORS.primary : COLORS.textSecondary}
          size={15}
          strokeWidth={2.2}
          fill={showCatches ? "rgba(253,123,65,0.25)" : "none"}
        />
      </Pressable>

      {/* Spots */}
      {hasSpots && (
        <>
          <View style={layerPanelStyles.divider} />
          <Pressable
            style={[layerPanelStyles.btn, showSpots && layerPanelStyles.btnActive]}
            onPress={onToggleSpots}
          >
            <Bookmark
              color={showSpots ? COLORS.primary : COLORS.textSecondary}
              size={15}
              strokeWidth={2.2}
              fill={showSpots ? COLORS.primary : "none"}
            />
          </Pressable>
        </>
      )}

      {/* Heatmap (Pro) */}
      <View style={layerPanelStyles.divider} />
      <Pressable
        style={[layerPanelStyles.btn, showHeatmap && layerPanelStyles.btnActive]}
        onPress={onToggleHeatmap}
      >
        <Flame
          color={showHeatmap ? COLORS.primary : COLORS.textSecondary}
          size={15}
          strokeWidth={2.2}
        />
        {!isPro && (
          <View style={layerPanelStyles.proBadgeWrap}>
            <ProBadge size="xs" />
          </View>
        )}
      </Pressable>
    </View>
  );
}

const layerPanelStyles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    backgroundColor: "rgba(17,19,21,0.90)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 10,
  },
  btn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  btnActive: {
    backgroundColor: "rgba(253,123,65,0.16)",
  },
  divider: {
    height: 1,
    marginHorizontal: 8,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  proBadgeWrap: {
    position: "absolute",
    bottom: 4,
    right: 4,
  },
});

function MapStylePicker({
  current,
  isPro,
  onSelect,
  onClose,
  insetTop,
}: {
  current: MapStyle;
  isPro: boolean;
  onSelect: (style: MapStyle) => void;
  onClose: () => void;
  insetTop: number;
}) {
  const OPTIONS: { id: MapStyle; label: string; sub: string; icon: React.ReactNode; pro: boolean }[] = [
    {
      id: "outdoors",
      label: "Outdoors",
      sub: "Terrain, water & trails",
      icon: <Mountain size={18} color={current === "outdoors" ? COLORS.primary : COLORS.text} strokeWidth={2} />,
      pro: false,
    },
    {
      id: "standard",
      label: "Standard",
      sub: "Clean street map",
      icon: <Layers size={18} color={current === "standard" ? COLORS.primary : COLORS.text} strokeWidth={2} />,
      pro: false,
    },
    {
      id: "satellite",
      label: "Satellite",
      sub: "Aerial imagery",
      icon: <Globe size={18} color={current === "satellite" ? COLORS.primary : isPro ? COLORS.text : COLORS.textSecondary} strokeWidth={2} />,
      pro: true,
    },
  ];

  return (
    <>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[stylePickerStyles.card, { top: insetTop + 52 }]}>
        <View style={stylePickerStyles.header}>
          <Text style={stylePickerStyles.title}>Map Style</Text>
        </View>
        {OPTIONS.map((opt, i) => (
          <Pressable
            key={opt.id}
            style={[
              stylePickerStyles.row,
              i < OPTIONS.length - 1 && stylePickerStyles.rowBorder,
              current === opt.id && stylePickerStyles.rowActive,
            ]}
            onPress={() => onSelect(opt.id)}
          >
            <View style={stylePickerStyles.rowIcon}>{opt.icon}</View>
            <View style={stylePickerStyles.rowCopy}>
              <Text style={[stylePickerStyles.rowLabel, current === opt.id && stylePickerStyles.rowLabelActive]}>
                {opt.label}
              </Text>
              <Text style={stylePickerStyles.rowSub}>{opt.sub}</Text>
            </View>
            <View style={stylePickerStyles.rowRight}>
              {opt.pro && !isPro && <ProBadge size="xs" />}
              {current === opt.id && (
                <Check size={16} color={COLORS.primary} strokeWidth={2.5} />
              )}
            </View>
          </Pressable>
        ))}
      </View>
    </>
  );
}

const stylePickerStyles = StyleSheet.create({
  card: {
    position: "absolute",
    right: 16,
    width: 220,
    backgroundColor: "rgba(28,31,35,0.97)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  title: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  rowActive: {
    backgroundColor: "rgba(253,123,65,0.08)",
  },
  rowIcon: {
    width: 28,
    alignItems: "center",
  },
  rowCopy: { flex: 1 },
  rowLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  rowLabelActive: { color: COLORS.primary },
  rowSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 20,
  },
});

// ── Empty state helpers ───────────────────────────────────────────────────────

function getEmptyTitle(mode: FilterMode, selectedFriendId: string, hasFilters: boolean) {
  if (hasFilters) return "No catches match your filters";
  if (mode === "mine") return "No catches to display";
  if (mode === "global") return "No global catches here";
  if (selectedFriendId !== "all") return "No catches for this friend";
  return "No friend catches to display";
}

function getEmptyMessage(
  mode: FilterMode,
  selectedFriendId: string,
  isOnline: boolean | null,
  hasFilters: boolean
) {
  if (hasFilters) return "Try adjusting your species or date filters.";
  if (isOnline === false) {
    return mode === "mine"
      ? "You're offline. Catches saved on this device will appear here."
      : "You're offline. Catches will load when the connection returns.";
  }
  if (mode === "mine") return "Log a catch with a location and it will appear here.";
  if (mode === "global") return "Public catches from across the app will appear here.";
  if (selectedFriendId !== "all") return "Try another friend or switch back to All Friends.";
  return "Friends' public catches will appear here.";
}

// ── Styles ────────────────────────────────────────────────────────────────────

const toggleStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: "rgba(17,19,21,0.90)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    padding: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  btn: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  active: { backgroundColor: COLORS.primary },
  label: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "600" },
  labelActive: { color: "#000000" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  map: { flex: 1 },

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "column",
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 5,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerToggleRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 130,
    overflow: "hidden",
  },
  headerGradientTop: {
    height: 44,
    backgroundColor: "rgba(17,19,21,0.82)",
  },
  headerGradientMid: {
    height: 44,
    backgroundColor: "rgba(17,19,21,0.46)",
  },
  headerGradientBottom: {
    flex: 1,
    backgroundColor: "rgba(17,19,21,0.14)",
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17,19,21,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  actionsGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(17,19,21,0.88)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  groupBtn: {
    width: 38,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  groupBtnActive: {
    backgroundColor: "rgba(253,123,65,0.18)",
  },
  groupDivider: {
    width: 1,
    height: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  countChip: {
    backgroundColor: "rgba(17,19,21,0.90)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    height: 32,
    minWidth: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  countText: { color: COLORS.primary, fontSize: 13, fontWeight: "700" },

  addingSpotBanner: {
    backgroundColor: "rgba(253,123,65,0.15)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(253,123,65,0.4)",
    alignItems: "center",
  },
  addingSpotText: { color: COLORS.primary, fontSize: 13, fontWeight: "700" },

  placeButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 100,
    alignItems: "center",
  },
  placeButtonText: { color: "#000", fontWeight: "700", fontSize: 13 },

  addSpotOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 120,
  },
  addSpotHint: {
    backgroundColor: "rgba(17,19,21,0.92)",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  addSpotHintText: { color: COLORS.textSecondary, fontSize: 13 },

  overlayCard: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "rgba(17,19,21,0.94)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    padding: 16,
    gap: 8,
    alignItems: "center",
  },
  overlayTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  overlayText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  overlayButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },
  overlayButtonText: { color: "#000", fontWeight: "700", fontSize: 13 },

  friendSelector: { maxHeight: 38 },
  friendSelectorContent: { gap: 8, paddingRight: 12 },
  friendChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(17,19,21,0.90)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  friendChipActive: {
    backgroundColor: "rgba(79,140,255,0.22)",
    borderColor: "rgba(79,140,255,0.55)",
  },
  friendChipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "600" },
  friendChipTextActive: { color: COLORS.text },

  calloutCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 16,
  },
  calloutHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "center",
    marginBottom: 8,
  },
  calloutRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  calloutContent: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  calloutImage: {
    width: 68,
    height: 68,
    borderRadius: 12,
    resizeMode: "cover",
  },
  calloutImageFallback: {
    backgroundColor: "rgba(221,220,219,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  spotIconBox: {
    backgroundColor: "rgba(253,123,65,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  calloutDetails: { flex: 1, gap: 3 },
  calloutActionsColumn: { gap: 0, alignItems: "center" },
  calloutSpecies: { color: COLORS.text, fontSize: 17, fontWeight: "700" },
  calloutMeta: { color: COLORS.textSecondary, fontSize: 13 },
  pendingSyncText: { color: "#FDBA74", fontSize: 12, fontWeight: "600" },
  calloutClose: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(221,220,219,0.1)",
  },
  calloutAnglerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(221,220,219,0.06)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 10,
  },
  calloutAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLORS.primary,
    resizeMode: "cover",
  },
  calloutAvatarFallback: {
    backgroundColor: "rgba(253,123,65,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  calloutAvatarInitial: { color: COLORS.primary, fontWeight: "700", fontSize: 14 },
  calloutProfileCopy: { flex: 1 },
  calloutAnglerName: { color: COLORS.text, fontSize: 14, fontWeight: "700" },
  calloutAnglerSub: { color: COLORS.primary, fontSize: 11, marginTop: 1 },

  calloutPinGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    backgroundColor: "rgba(253,123,65,0.12)",
    borderWidth: 1,
    borderColor: "rgba(253,123,65,0.25)",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  calloutPinGroupText: { color: COLORS.primary, fontSize: 10, fontWeight: "600" },

  filterCountBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  filterCountText: { color: "#000", fontSize: 9, fontWeight: "800" },

  // Filter sheet
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  sheetTitle: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: "700" },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(221,220,219,0.1)",
  },
  sheetSectionLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  filterChipRow: { gap: 8, paddingBottom: 4 },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(221,220,219,0.06)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: "rgba(253,123,65,0.15)",
    borderColor: "rgba(253,123,65,0.45)",
  },
  filterChipText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "600" },
  filterChipTextActive: { color: COLORS.primary },

  clearAllButton: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(253,123,65,0.12)",
    borderWidth: 1,
    borderColor: "rgba(253,123,65,0.3)",
    marginRight: 6,
  },
  clearAllText: { color: COLORS.primary, fontSize: 12, fontWeight: "700" },

  doneButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 30,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  doneButtonText: { color: "#000", fontWeight: "700", fontSize: 15 },
});
