import { supabase } from "@/lib/supabase";

export async function hasPurchased(userId: string, bookId: string) {
  const { data, error } = await supabase
    .from("purchases")
    .select("id")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export async function addPurchase(userId: string, bookId: string) {
  const { error } = await supabase
    .from("purchases")
    .upsert(
      { user_id: userId, book_id: bookId, created_at_ms: Date.now() },
      { onConflict: "user_id,book_id" }
    );
  if (error) throw error;
}

export async function listPurchased(userId: string) {
  const { data, error } = await supabase.from("purchases").select("book_id").eq("user_id", userId);
  if (error || !data) return [];
  return data.map((d: any) => d.book_id as string);
}
