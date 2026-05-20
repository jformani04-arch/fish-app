import * as Location from "expo-location";
import { COLORS } from "@/lib/colors";
import MapZoomControls from "@/components/MapZoomControls";
import MapboxGL from "@rnmapbox/maps";
import { Crosshair, Navigation, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface LocationResult {
  latitude: number;
  longitude: number;
  locationName: string;
}

interface Props {
  visible: boolean;
  initialCoords?: { latitude: number; longitude: number } | null;
  onConfirm: (result: LocationResult) => void;
  onClose: () => void;
}

const DEFAULT_CENTER: [number, number] = [-98.35, 39.5];
const DEFAULT_ZOOM = 3.5;

async function getLocationName(coords: {
  latitude: number;
  longitude: number;
}): Promise<string> {
  try {
    const results = await Location.reverseGeocodeAsync(coords);
    if (!results.length) return "";
    const r = results[0];
    const locality = r.city ?? r.subregion ?? r.region ?? "";
    const area = r.region ?? r.country ?? "";
    return [locality, area].filter(Boolean).join(", ");
  } catch {
    return "";
  }
}

export default function LocationPickerModal({
  visible,
  initialCoords,
  onConfirm,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const currentZoomRef = useRef(DEFAULT_ZOOM);

  const [center, setCenter] = useState<{ latitude: number; longitude: number }>(
    initialCoords ?? { latitude: DEFAULT_CENTER[1], longitude: DEFAULT_CENTER[0] }
  );
  const [geocoding, setGeocoding] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!visible || !mapReady) return;
    const target = initialCoords ?? null;
    if (target) {
      setCenter({ latitude: target.latitude, longitude: target.longitude });
      setTimeout(() => {
        cameraRef.current?.setCamera({
          centerCoordinate: [target.longitude, target.latitude],
          zoomLevel: 13,
          animationDuration: 350,
        });
      }, 100);
    } else {
      setCenter({ latitude: DEFAULT_CENTER[1], longitude: DEFAULT_CENTER[0] });
      setTimeout(() => {
        cameraRef.current?.setCamera({
          centerCoordinate: DEFAULT_CENTER,
          zoomLevel: DEFAULT_ZOOM,
          animationDuration: 350,
        });
      }, 100);
    }
  }, [visible, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUseCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setCenter(coords);
      cameraRef.current?.setCamera({
        centerCoordinate: [coords.longitude, coords.latitude],
        zoomLevel: 14,
        animationDuration: 500,
      });
    } catch {
      // location unavailable — silently ignore
    }
  };

  const handleConfirm = async () => {
    setGeocoding(true);
    const name = await getLocationName(center);
    setGeocoding(false);
    onConfirm({ latitude: center.latitude, longitude: center.longitude, locationName: name });
  };

  const handleZoom = (direction: "in" | "out") => {
    const next =
      direction === "in"
        ? Math.min(currentZoomRef.current + 1, 20)
        : Math.max(currentZoomRef.current - 1, 1);
    currentZoomRef.current = next;
    cameraRef.current?.setCamera({ zoomLevel: next, animationDuration: 180 });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <MapboxGL.MapView
          style={styles.map}
          styleURL="mapbox://styles/mapbox/dark-v11"
          onDidFinishLoadingMap={() => setMapReady(true)}
          onCameraChanged={(state) => {
            const [lng, lat] = state.properties.center;
            setCenter({ latitude: lat, longitude: lng });
            currentZoomRef.current = state.properties.zoom;
          }}
          compassEnabled={false}
          scaleBarEnabled={false}
          logoEnabled={false}
          attributionEnabled={false}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: initialCoords
                ? [initialCoords.longitude, initialCoords.latitude]
                : DEFAULT_CENTER,
              zoomLevel: initialCoords ? 13 : DEFAULT_ZOOM,
            }}
          />
        </MapboxGL.MapView>

        {/* Fixed crosshair at map center */}
        <View style={styles.crosshair} pointerEvents="none">
          <Crosshair color={COLORS.primary} size={40} strokeWidth={1.5} />
        </View>

        {/* Floating header */}
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + (Platform.OS === "android" ? 8 : 4) },
          ]}
          pointerEvents="box-none"
        >
          <Pressable onPress={onClose} style={styles.iconButton}>
            <X color={COLORS.text} size={20} strokeWidth={2.4} />
          </Pressable>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>Pick Location</Text>
          </View>
          <Pressable onPress={handleUseCurrentLocation} style={styles.iconButton}>
            <Navigation color={COLORS.primary} size={18} strokeWidth={2.4} />
          </Pressable>
        </View>

        {/* Hint chip */}
        <View
          style={[
            styles.hintChip,
            { top: insets.top + (Platform.OS === "android" ? 72 : 68) },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.hintText}>Pan the map to position the crosshair</Text>
        </View>

        <MapZoomControls
          onZoomIn={() => handleZoom("in")}
          onZoomOut={() => handleZoom("out")}
          style={{ top: insets.top + (Platform.OS === "android" ? 132 : 128) }}
        />

        {/* Bottom confirmation card */}
        <View
          style={[
            styles.bottomCard,
            { paddingBottom: Math.max(insets.bottom, 16) + 8 },
          ]}
        >
          <Text style={styles.coordsText}>
            {center.latitude.toFixed(5)}, {center.longitude.toFixed(5)}
          </Text>
          <Pressable
            style={[styles.confirmButton, geocoding && { opacity: 0.7 }]}
            onPress={handleConfirm}
            disabled={geocoding}
          >
            {geocoding ? (
              <ActivityIndicator color={COLORS.text} size="small" />
            ) : (
              <Text style={styles.confirmText}>Confirm Location</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  crosshair: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -20,
    marginLeft: -20,
  },

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(60,64,68,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  titleWrap: {
    flex: 1,
    backgroundColor: "rgba(60,64,68,0.88)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
  },
  title: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  hintChip: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(60,64,68,0.88)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  hintText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },

  bottomCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(48,52,56,0.97)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  coordsText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: "center",
    marginTop: 3,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  confirmText: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.3,
  },
});
