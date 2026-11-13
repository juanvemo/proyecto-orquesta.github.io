import { supabase } from "@/integrations/supabase/client";
import { isMissingTableOrRpcError, readOrgFeatureFlag, writeOrgFeatureFlag } from "@/lib/orgStore";
import type { SongScore, SongScoreDraft } from "./types";

const FLAG_SCORES = "song_scores_store";

export async function listScoresForOrganization(organizationId: string): Promise<SongScore[]> {
  const { data, error } = await supabase
    .from("song_scores")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sort_order")
    .order("created_at");

  if (!error) return (data ?? []) as unknown as SongScore[];
  if (isMissingTableOrRpcError(error)) {
    return await readOrgFeatureFlag<SongScore[]>(organizationId, FLAG_SCORES, []);
  }
  throw error;
}

export async function listScoresForSong(organizationId: string, songId: string): Promise<SongScore[]> {
  const { data, error } = await supabase
    .from("song_scores")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("song_id", songId)
    .order("sort_order")
    .order("created_at");

  if (!error) return (data ?? []) as unknown as SongScore[];
  if (isMissingTableOrRpcError(error)) {
    const all = await readOrgFeatureFlag<SongScore[]>(organizationId, FLAG_SCORES, []);
    return all.filter((item) => item.song_id === songId);
  }
  throw error;
}

export async function replaceSongScores(
  organizationId: string,
  songId: string,
  drafts: SongScoreDraft[],
): Promise<void> {
  const cleaned = drafts
    .map((d, idx) => ({
      organization_id: organizationId,
      song_id: songId,
      category: d.category.trim() || "General",
      instrument: d.instrument.trim() || null,
      title: d.title.trim() || `Partitura ${d.category || "General"}`,
      score_url: d.score_url.trim(),
      notes: d.notes.trim() || null,
      version: d.version.trim() || null,
      sort_order: idx,
    }))
    .filter((d) => /^https?:\/\//i.test(d.score_url));

  const delRes = await supabase.from("song_scores").delete().eq("song_id", songId);
  if (!delRes.error) {
    if (cleaned.length) {
      const { error: insErr } = await supabase.from("song_scores").insert(cleaned);
      if (insErr) throw insErr;
    }
    return;
  }

  if (isMissingTableOrRpcError(delRes.error)) {
    const all = await readOrgFeatureFlag<SongScore[]>(organizationId, FLAG_SCORES, []);
    const nextRows: SongScore[] = cleaned.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
    }));
    await writeOrgFeatureFlag(
      organizationId,
      FLAG_SCORES,
      [...all.filter((item) => item.song_id !== songId), ...nextRows],
    );
    return;
  }

  throw delRes.error;
}
