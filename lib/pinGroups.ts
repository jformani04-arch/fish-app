import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/errorHandling";

const REQUEST_TIMEOUT_MS = 8000;

export async function getUserPinGroups(userId: string): Promise<string[]> {
  const { data, error } = await withTimeout<any>(
    supabase
      .from("pin_groups")
      .select("name")
      .eq("user_id", userId)
      .order("name", { ascending: true }),
    REQUEST_TIMEOUT_MS,
    "Loading pin groups took too long."
  );

  if (error || !data) return [];
  return (data as { name: string }[]).map((row) => row.name);
}

export async function upsertPinGroup(userId: string, name: string): Promise<void> {
  const normalized = name.trim();
  if (!normalized) return;

  await withTimeout<any>(
    supabase
      .from("pin_groups")
      .upsert({ user_id: userId, name: normalized }, { onConflict: "user_id,name" }),
    REQUEST_TIMEOUT_MS,
    "Saving pin group took too long."
  );
}

export async function deletePinGroup(userId: string, name: string): Promise<void> {
  await supabase
    .from("pin_groups")
    .delete()
    .eq("user_id", userId)
    .eq("name", name.trim());
}
