import { supabase } from "@/integrations/supabase/client";
import type { Genre, RehearsalSong, Setlist, SetlistItem, Song, SongFormValues } from "./types";

export async function loadRepertoire(organizationId: string) {
  const [genresResult, songsResult, setlistsResult] = await Promise.all([
    supabase.from("genres").select("*").eq("organization_id", organizationId).order("name"),
    supabase.from("songs").select("*,genre:genres(*)").eq("organization_id", organizationId).order("name"),
    supabase.from("setlists").select("*,setlist_blocks(*),setlist_songs(*,song:songs(*,genre:genres(*)))").eq("organization_id", organizationId).order("updated_at", { ascending: false }),
  ]);
  if (genresResult.error) throw genresResult.error;
  if (songsResult.error) throw songsResult.error;
  if (setlistsResult.error) throw setlistsResult.error;
  return { genres: genresResult.data as Genre[], songs: songsResult.data as unknown as Song[], setlists: setlistsResult.data as unknown as Setlist[] };
}

const nullable = (value: string) => value.trim() || null;
export async function saveSong(organizationId: string, values: SongFormValues, id?: string) {
  const duration = Math.max(0, Number(values.duration_minutes || 0) * 60 + Number(values.duration_seconds_part || 0));
  const payload = { organization_id: organizationId, name: values.name.trim(), original_artist: nullable(values.original_artist), composer: nullable(values.composer), genre_id: values.genre_id || null, musical_key: nullable(values.musical_key), bpm: values.bpm ? Number(values.bpm) : null, duration_seconds: duration, song_type: nullable(values.song_type), level: values.level, status: values.status, youtube_url: nullable(values.youtube_url), spotify_url: nullable(values.spotify_url), audio_url: nullable(values.audio_url), score_url: nullable(values.score_url), lyrics: nullable(values.lyrics), observations: nullable(values.observations), updated_at: new Date().toISOString() };
  const result = id ? await supabase.from("songs").update(payload).eq("id", id) : await supabase.from("songs").insert(payload);
  if (result.error) throw result.error;
}

export async function saveGenre(organizationId: string, name: string, description: string) { const { error } = await supabase.from("genres").insert({ organization_id: organizationId, name: name.trim(), description: nullable(description) }); if (error) throw error; }
export async function toggleGenre(id: string, active: boolean) { const { error } = await supabase.from("genres").update({ is_active: active, updated_at: new Date().toISOString() }).eq("id", id); if (error) throw error; }
export async function createSetlist(organizationId: string, userId: string, name: string, description: string) { const { data, error } = await supabase.from("setlists").insert({ organization_id: organizationId, created_by: userId, name: name.trim(), description: nullable(description) }).select("id").single(); if (error) throw error; return data.id; }
export async function updateSetlist(id: string, values: { name?: string; description?: string; status?: Setlist["status"] }) { const { error } = await supabase.from("setlists").update({ ...values, updated_at: new Date().toISOString() }).eq("id", id); if (error) throw error; }
export async function addSetlistBlock(organizationId: string, setlistId: string, name: string, position: number) { const { error } = await supabase.from("setlist_blocks").insert({ organization_id: organizationId, setlist_id: setlistId, name: name.trim(), position }); if (error) throw error; }
export async function addSetlistSong(organizationId: string, setlistId: string, song: Song, position: number, blockId?: string | null) { const { error } = await supabase.from("setlist_songs").insert({ organization_id: organizationId, setlist_id: setlistId, block_id: blockId || null, song_id: song.id, item_type: "SONG", duration_seconds: song.duration_seconds, position }); if (error) throw error; }
export async function addSetlistBreak(organizationId: string, setlistId: string, title: string, durationSeconds: number, position: number, blockId?: string | null) { const { error } = await supabase.from("setlist_songs").insert({ organization_id: organizationId, setlist_id: setlistId, block_id: blockId || null, song_id: null, item_type: "BREAK", title: title.trim() || "Pausa", duration_seconds: durationSeconds, position }); if (error) throw error; }
export async function reorderSetlistItems(items: SetlistItem[]) { const results = await Promise.all(items.map((item, position) => supabase.from("setlist_songs").update({ position }).eq("id", item.id))); const error = results.find((result) => result.error)?.error; if (error) throw error; }
export async function removeSetlistItem(id: string) { const { error } = await supabase.from("setlist_songs").delete().eq("id", id); if (error) throw error; }

export async function loadRehearsalSongs(rehearsalId: string) { const { data, error } = await supabase.from("rehearsal_songs").select("*,song:songs(*,genre:genres(*))").eq("rehearsal_id", rehearsalId).order("position"); if (error) throw error; return (data ?? []) as unknown as RehearsalSong[]; }
export async function addRehearsalSong(organizationId: string, rehearsalId: string, songId: string, position: number) { const { error } = await supabase.from("rehearsal_songs").insert({ organization_id: organizationId, rehearsal_id: rehearsalId, song_id: songId, position }); if (error) throw error; }
export async function updateRehearsalSong(id: string, workStatus: RehearsalSong["work_status"]) { const { error } = await supabase.from("rehearsal_songs").update({ work_status: workStatus }).eq("id", id); if (error) throw error; }
export async function removeRehearsalSong(id: string) { const { error } = await supabase.from("rehearsal_songs").delete().eq("id", id); if (error) throw error; }
