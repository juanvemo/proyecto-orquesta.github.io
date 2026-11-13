export type SongStatus = "EN REPERTORIO" | "EN MONTAJE" | "PENDIENTE" | "RETIRADA";
export type SongLevel = "BÁSICO" | "INTERMEDIO" | "AVANZADO" | "PROFESIONAL";

export interface Genre { id: string; organization_id: string; name: string; description: string | null; is_active: boolean; }
export interface Song { id: string; organization_id: string; name: string; original_artist: string | null; composer: string | null; genre_id: string | null; musical_key: string | null; bpm: number | null; duration_seconds: number; song_type: string | null; level: SongLevel; status: SongStatus; youtube_url: string | null; spotify_url: string | null; audio_url: string | null; score_url: string | null; lyrics: string | null; observations: string | null; genre: Genre | null; }
export interface SongFormValues { name: string; original_artist: string; composer: string; genre_id: string; musical_key: string; bpm: string; duration_minutes: string; duration_seconds_part: string; song_type: string; level: SongLevel; status: SongStatus; youtube_url: string; spotify_url: string; audio_url: string; score_url: string; lyrics: string; observations: string; }
export interface SetlistItem { id: string; organization_id: string; setlist_id: string; block_id: string | null; song_id: string | null; item_type: "SONG" | "BREAK"; title: string | null; duration_seconds: number; position: number; notes: string | null; song: Song | null; }
export interface SetlistBlock { id: string; organization_id: string; setlist_id: string; name: string; position: number; }
export interface Setlist { id: string; organization_id: string; name: string; description: string | null; status: "BORRADOR" | "LISTO" | "ARCHIVADO"; setlist_blocks: SetlistBlock[]; setlist_songs: SetlistItem[]; }
export interface RehearsalSong { id: string; organization_id: string; rehearsal_id: string; song_id: string; work_status: "PENDIENTE" | "TRABAJADA" | "DOMINADA"; notes: string | null; position: number; song: Song; }
