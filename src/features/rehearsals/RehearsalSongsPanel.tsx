import { useCallback, useEffect, useState } from "react";
import { BookOpenText, Music2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PresentationModeModal } from "@/features/repertoire/PresentationModeModal";
import { SongDetailDialog } from "@/features/repertoire/SongDetailDialog";
import { addRehearsalSong, loadRehearsalSongs, removeRehearsalSong, updateRehearsalSong } from "@/features/repertoire/service";
import type { RehearsalSong, Song } from "@/features/repertoire/types";

const tones = {
  PENDIENTE: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  TRABAJADA: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  DOMINADA: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

export function RehearsalSongsPanel({
  organizationId,
  rehearsalId,
  songs,
  canManage,
}: {
  organizationId: string;
  rehearsalId: string;
  songs: Song[];
  canManage: boolean;
}) {
  const [items, setItems] = useState<RehearsalSong[]>([]);
  const [songId, setSongId] = useState("");
  const [inspectingSong, setInspectingSong] = useState<Song | null>(null);
  const [presentationOpen, setPresentationOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await loadRehearsalSongs(rehearsalId));
    } catch {
      toast.error("No fue posible cargar las canciones del ensayo");
    }
  }, [rehearsalId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!songId) return;
    try {
      await addRehearsalSong(organizationId, rehearsalId, songId, items.length);
      setSongId("");
      toast.success("Canción agregada al ensayo");
      void load();
    } catch (error) {
      toast.error("No se pudo agregar la canción", { description: error instanceof Error ? error.message : undefined });
    }
  };

  const update = async (id: string, status: RehearsalSong["work_status"]) => {
    try {
      await updateRehearsalSong(id, status);
      void load();
    } catch {
      toast.error("No se pudo actualizar el avance");
    }
  };

  const rehearsalSongObjects = items.map((i) => i.song).filter(Boolean);

  return (
    <>
      <Card className="rounded-[2rem] shadow-none">
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 className="text-lg font-black">Canciones del ensayo</h2>
              <p className="text-sm text-muted-foreground">
                {items.length} canciones · {items.filter((item) => item.work_status === "DOMINADA").length} dominadas. Haz clic en una canción para ver su letra y partituras.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {rehearsalSongObjects.length > 0 && (
                <Button type="button" variant="outline" onClick={() => setPresentationOpen(true)} className="rounded-xl font-bold">
                  <Sparkles className="mr-1.5 size-4 text-primary" /> Modo presentación
                </Button>
              )}
              {canManage && (
                <div className="flex gap-2">
                  <Select value={songId || "NONE"} onValueChange={(value) => setSongId(value === "NONE" ? "" : value)}>
                    <SelectTrigger className="w-48 rounded-xl sm:w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Seleccionar canción</SelectItem>
                      {songs
                        .filter((song) => song.status !== "RETIRADA" && !items.some((item) => item.song_id === song.id))
                        .map((song) => <SelectItem key={song.id} value={song.id}>{song.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => void add()} disabled={!songId} className="rounded-xl"><Plus className="size-4" /></Button>
                </div>
              )}
            </div>
          </div>

          {items.length ? (
            <div className="divide-y">
              {items.map((item, index) => (
                <div key={item.id} className="grid gap-3 p-4 transition hover:bg-muted/30 sm:grid-cols-[44px_1fr_auto_170px_auto] sm:items-center sm:px-6">
                  <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-sm font-black text-primary">{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => setInspectingSong(item.song)}
                    className="min-w-0 text-left group"
                  >
                    <p className="font-bold group-hover:text-primary group-hover:underline">{item.song.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.song.original_artist || "Orquesta"} · {item.song.musical_key || "Sin tono"} · {item.song.bpm ? `${item.song.bpm} BPM` : "Sin BPM"} · {time(item.song.duration_seconds)}
                    </p>
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setInspectingSong(item.song)}
                    className="w-fit rounded-xl font-bold"
                  >
                    <BookOpenText className="mr-1.5 size-3.5 text-primary" />
                    Ver letra y partituras
                  </Button>
                  {canManage ? (
                    <Select value={item.work_status} onValueChange={(value: RehearsalSong["work_status"]) => void update(item.id, value)}>
                      <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.keys(tones).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Badge className={`w-fit rounded-lg ${tones[item.work_status]}`}>{item.work_status}</Badge>
                  )}
                  {canManage && (
                    <Button variant="ghost" size="icon" className="rounded-xl text-destructive" onClick={() => void removeRehearsalSong(item.id).then(load)}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center">
              <Music2 className="mx-auto size-8 text-primary" />
              <p className="mt-3 font-bold">Sin canciones asignadas</p>
              <p className="text-sm text-muted-foreground">Agrega las piezas que se trabajarán en esta sesión.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <SongDetailDialog
        song={inspectingSong}
        open={Boolean(inspectingSong)}
        onOpenChange={(open) => { if (!open) setInspectingSong(null); }}
      />

      <PresentationModeModal
        open={presentationOpen}
        onOpenChange={setPresentationOpen}
        title="Ensayo"
        songs={rehearsalSongObjects}
      />
    </>
  );
}

function time(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
