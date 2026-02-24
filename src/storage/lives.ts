import { supabase } from "@/lib/supabase";

type LiveRow = {
  id: string;
  title: string;
  description?: string | null;
  start_at_ms: number;
  streaming_url?: string | null;
  owner_id: string;
  owner_name?: string | null;
  status?: "scheduled" | "live" | "ended";
};

function mapLive(row: LiveRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    startAt: row.start_at_ms,
    streamingUrl: row.streaming_url ?? undefined,
    ownerId: row.owner_id,
    ownerName: row.owner_name ?? undefined,
    status: row.status ?? "scheduled",
  };
}

export async function createLive(input: any) {
  const now = Date.now();
  const payload = {
    title: input.title,
    description: input.description ?? null,
    start_at_ms: input.startAt,
    streaming_url: input.streamingUrl ?? null,
    owner_id: input.ownerId,
    owner_name: input.ownerName ?? null,
    status: "scheduled",
    created_at_ms: now,
    updated_at_ms: now,
  };
  const { data, error } = await supabase.from("lives").insert(payload).select("*").single();
  if (error || !data) throw error || new Error("Create live failed.");
  return mapLive(data as LiveRow);
}

export async function listMine(ownerId: string) {
  const { data, error } = await supabase
    .from("lives")
    .select("*")
    .eq("owner_id", ownerId)
    .order("start_at_ms", { ascending: true });
  if (error || !data) return [];
  return (data as LiveRow[]).map(mapLive);
}

export async function listUpcoming(now = Date.now()) {
  const cutoff = now - 2 * 60 * 60 * 1000;
  const { data, error } = await supabase
    .from("lives")
    .select("*")
    .gte("start_at_ms", cutoff)
    .order("start_at_ms", { ascending: true });
  if (error || !data) return [];
  return (data as LiveRow[]).map(mapLive).filter((l) => l.status !== "ended");
}

export async function getLive(id: string) {
  const { data, error } = await supabase.from("lives").select("*").eq("id", id).single();
  if (error || !data) return null;
  return mapLive(data as LiveRow);
}

export async function updateLive(id: string, patch: any) {
  const payload: Record<string, any> = { updated_at_ms: Date.now() };
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.description !== undefined) payload.description = patch.description ?? null;
  if (patch.startAt !== undefined) payload.start_at_ms = patch.startAt;
  if (patch.streamingUrl !== undefined) payload.streaming_url = patch.streamingUrl ?? null;
  if (patch.status !== undefined) payload.status = patch.status;
  const { data, error } = await supabase.from("lives").update(payload).eq("id", id).select("*").single();
  if (error || !data) throw error || new Error("Update live failed.");
  return mapLive(data as LiveRow);
}

export async function setStatus(id: string, status: "scheduled" | "live" | "ended") {
  return updateLive(id, { status });
}
