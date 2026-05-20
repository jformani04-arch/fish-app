import { supabase } from "@/lib/supabase";

export type FishingSpotVisibility = "private" | "friends" | "public";

export interface FishingSpot {
  id: string;
  userId: string;
  name: string;
  notes: string | null;
  latitude: number;
  longitude: number;
  visibility: FishingSpotVisibility;
  createdAt: string;
  updatedAt: string;
}

type FishingSpotRow = {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  latitude: number;
  longitude: number;
  visibility: FishingSpotVisibility;
  created_at: string;
  updated_at: string;
};

function mapRow(row: FishingSpotRow): FishingSpot {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    notes: row.notes,
    latitude: row.latitude,
    longitude: row.longitude,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getUserFishingSpots(userId: string): Promise<FishingSpot[]> {
  const { data, error } = await supabase
    .from("fishing_spots")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as FishingSpotRow[]).map(mapRow);
}

export async function createFishingSpot(
  spot: Pick<FishingSpot, "name" | "notes" | "latitude" | "longitude" | "visibility">
): Promise<FishingSpot> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("No authenticated user");

  const { data, error } = await supabase
    .from("fishing_spots")
    .insert({
      user_id: user.id,
      name: spot.name,
      notes: spot.notes ?? null,
      latitude: spot.latitude,
      longitude: spot.longitude,
      visibility: spot.visibility,
    })
    .select()
    .single();

  if (error) throw error;
  return mapRow(data as FishingSpotRow);
}

export async function updateFishingSpot(
  id: string,
  updates: Partial<Pick<FishingSpot, "name" | "notes" | "visibility">>
): Promise<void> {
  const { error } = await supabase
    .from("fishing_spots")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteFishingSpot(id: string): Promise<void> {
  const { error } = await supabase.from("fishing_spots").delete().eq("id", id);
  if (error) throw error;
}
