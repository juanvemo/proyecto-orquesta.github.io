import { FormEvent, useEffect, useState } from "react";
import { FileMusic, LoaderCircle, Music2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { listScoresForSong } from "./scoresService";
import { saveSong } from "./service";
import {
  SCORE_CATEGORIES,
  type Genre,
  type Song,
  type SongFormValues,
  type SongLevel,
  type SongScoreDraft,
  type SongStatus,
} from "./types";

const empty: SongFormValues = {
  name: "",
  original_artist: "",
  composer: "",
  genre_id: "",
  musical_key: "",
  bpm: "",
  duration_minutes: "4",
  duration_seconds_part: "0",
  song_type: "",
  level: "INTERMEDIO",
  status: "PENDIENTE",
  youtube_url: "",
  spotify_url: "",
  audio_url: "",
  score_url: "",
  lyrics: "",
  observations: "",
};

function fromSong(song: Song): SongFormValues {
  return {
    name: song.name,
    original_artist: song.original_artist ?? "",
    composer: song.composer ?? "",
    genre_id: song.genre_id ?? "",
    musical_key: song.musical_key ?? "",
    bpm: song.bpm?.toString() ?? "",
    duration_minutes: Math.floor(song.duration_seconds / 60).toString(),
    duration_seconds_part: (song.duration_seconds % 60).toString(),
    song_type: song.song_type ?? "",
    level: song.level,
    status: song.status,
    youtube_url: song.youtube_url ?? "",
    spotify_url: song.spotify_url ?? "",
    audio_url: song.audio_url ?? "",
    score_url: song.score_url ?? "",
    lyrics: song.lyrics ?? "",
    observations: song.observations ?? "",
  };
}

const emptyDraft = (): SongScoreDraft => ({
  category: "Vientos",
  instrument: "",
  title: "",
  score_url: "",
  notes: "",
  version: "v1",
});

export function SongFormDialog({
  open,
  onOpenChange,
  organizationId,
  genres,
  song,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  organizationId: string;
  genres: Genre[];
  song?: Song | null;
  onSaved: () => void;
}) {
  const [values, setValues] = useState(empty);
  const [scores, setScores] = useState<SongScoreDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(song ? fromSong(song) : empty);
    if (song) {
      if (song.song_scores?.length) {
        setScores(
          song.song_scores.map((s) => ({
            id: s.id,
            category: s.category,
            instrument: s.instrument ?? "",
            title: s.title,
            score_url: s.score_url,
            notes: s.notes ?? "",
            version: s.version ?? "",
          })),
        );
      } else {
        void listScoresForSong(organizationId, song.id).then((rows) => {
          if (rows.length) {
            setScores(
              rows.map((s) => ({
                id: s.id,
                category: s.category,
                instrument: s.instrument ?? "",
                title: s.title,
                score_url: s.score_url,
                notes: s.notes ?? "",
                version: s.version ?? "",
              })),
            );
          } else if (song.score_url) {
            setScores([
              {
                category: "General",
                instrument: "Todos",
                title: "Partitura general",
                score_url: song.score_url,
                notes: "",
                version: "v1",
              },
            ]);
          } else {
            setScores([]);
          }
        });
      }
    } else {
      setScores([]);
    }
  }, [open, song, organizationId]);

  const change = <K extends keyof SongFormValues>(key: K, value: SongFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));

  const addScoreRow = () => setScores((current) => [...current, emptyDraft()]);
  const updateScoreRow = (index: number, patch: Partial<SongScoreDraft>) =>
    setScores((current) => current.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  const removeScoreRow = (index: number) => setScores((current) => current.filter((_, idx) => idx !== index));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (values.name.trim().length < 2) {
      toast.error("Escribe el nombre de la canción");
      return;
    }
    if (values.bpm && (Number(values.bpm) < 20 || Number(values.bpm) > 300)) {
      toast.error("El BPM debe estar entre 20 y 300");
      return;
    }
    for (const s of scores) {
      if (s.score_url.trim() && !/^https?:\/\//i.test(s.score_url.trim())) {
        toast.error("Todos los enlaces de partitura deben iniciar por http:// o https://");
        return;
      }
    }
    setSaving(true);
    try {
      await saveSong(organizationId, { ...values, scores }, song?.id);
      toast.success(song ? "Canción actualizada" : "Canción agregada");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error("No fue posible guardar la canción", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[2rem] p-0 sm:max-w-3xl">
        <form onSubmit={submit}>
          <DialogHeader className="border-b p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Music2 className="size-5" /></span>
              <div>
                <DialogTitle className="text-xl font-black">{song ? "Editar canción" : "Nueva canción"}</DialogTitle>
                <DialogDescription>Ficha musical, enlaces, letra y múltiples partituras categorizadas por instrumento.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <Tabs defaultValue="music" className="p-5 sm:p-7">
            <TabsList className="mb-6 h-auto flex-wrap rounded-2xl p-1.5">
              <TabsTrigger value="music" className="rounded-xl">Información</TabsTrigger>
              <TabsTrigger value="scores" className="rounded-xl">Partituras ({scores.length})</TabsTrigger>
              <TabsTrigger value="resources" className="rounded-xl">Audio y Letra</TabsTrigger>
            </TabsList>

            <TabsContent value="music" className="grid gap-5 sm:grid-cols-2">
              <Field label="Nombre *" value={values.name} onChange={(value) => change("name", value)} />
              <Field label="Artista original" value={values.original_artist} onChange={(value) => change("original_artist", value)} />
              <Field label="Compositor" value={values.composer} onChange={(value) => change("composer", value)} />
              <div>
                <Label>Género</Label>
                <Select value={values.genre_id || "NONE"} onValueChange={(value) => change("genre_id", value === "NONE" ? "" : value)}>
                  <SelectTrigger className="mt-2 h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Sin género</SelectItem>
                    {genres.filter((item) => item.is_active).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Field label="Tonalidad" value={values.musical_key} onChange={(value) => change("musical_key", value)} placeholder="Ej. Cm" />
              <Field label="BPM" type="number" value={values.bpm} onChange={(value) => change("bpm", value)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Minutos" type="number" value={values.duration_minutes} onChange={(value) => change("duration_minutes", value)} />
                <Field label="Segundos" type="number" value={values.duration_seconds_part} onChange={(value) => change("duration_seconds_part", value)} />
              </div>
              <Field label="Tipo" value={values.song_type} onChange={(value) => change("song_type", value)} placeholder="Ej. Apertura" />
              <div>
                <Label>Nivel</Label>
                <Select value={values.level} onValueChange={(value: SongLevel) => change("level", value)}>
                  <SelectTrigger className="mt-2 h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{["BÁSICO", "INTERMEDIO", "AVANZADO", "PROFESIONAL"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={values.status} onValueChange={(value: SongStatus) => change("status", value)}>
                  <SelectTrigger className="mt-2 h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{["EN REPERTORIO", "EN MONTAJE", "PENDIENTE", "RETIRADA"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Observaciones</Label>
                <Textarea value={values.observations} onChange={(event) => change("observations", event.target.value)} className="mt-2 rounded-xl" />
              </div>
            </TabsContent>

            <TabsContent value="scores" className="space-y-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-black">Partituras por categoría e instrumento</h3>
                  <p className="text-xs text-muted-foreground">Agrega tantas partituras como necesites (Vientos, Piano, Bajo, Timbales, Voz, General, etc.).</p>
                </div>
                <Button type="button" onClick={addScoreRow} className="rounded-xl font-bold">
                  <Plus className="mr-1.5 size-4" />
                  Agregar partitura
                </Button>
              </div>

              {scores.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-center">
                  <FileMusic className="mx-auto size-8 text-primary" />
                  <p className="mt-2 text-sm font-bold">Sin partituras adicionales</p>
                  <p className="mt-1 text-xs text-muted-foreground">Haz clic en “Agregar partitura” para añadir versiones por instrumento o sección.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {scores.map((row, idx) => (
                    <div key={idx} className="rounded-2xl border bg-muted/20 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-primary">Partitura #{idx + 1}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeScoreRow(idx)} className="h-8 rounded-lg text-destructive hover:bg-destructive/10">
                          <Trash2 className="mr-1 size-3.5" /> Quitar
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <Label className="text-xs">Categoría *</Label>
                          <Select value={row.category} onValueChange={(v) => updateScoreRow(idx, { category: v })}>
                            <SelectTrigger className="mt-1 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {SCORE_CATEGORIES.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Instrumento específico</Label>
                          <Input
                            value={row.instrument}
                            onChange={(e) => updateScoreRow(idx, { instrument: e.target.value })}
                            placeholder="Ej. Trompeta 1, Baby Bass"
                            className="mt-1 h-10 rounded-xl"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Versión / Arreglo</Label>
                          <Input
                            value={row.version}
                            onChange={(e) => updateScoreRow(idx, { version: e.target.value })}
                            placeholder="Ej. Arreglo Cali v2"
                            className="mt-1 h-10 rounded-xl"
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs">Nombre del documento *</Label>
                          <Input
                            value={row.title}
                            onChange={(e) => updateScoreRow(idx, { title: e.target.value })}
                            placeholder="Ej. Partitura Trompeta 1 - PDF"
                            className="mt-1 h-10 rounded-xl"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Enlace a partitura (URL) *</Label>
                          <Input
                            type="url"
                            value={row.score_url}
                            onChange={(e) => updateScoreRow(idx, { score_url: e.target.value })}
                            placeholder="https://drive.google.com/..."
                            className="mt-1 h-10 rounded-xl"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Notas del arreglo</Label>
                        <Input
                          value={row.notes}
                          onChange={(e) => updateScoreRow(idx, { notes: e.target.value })}
                          placeholder="Observación de lectura o repeticiones"
                          className="mt-1 h-10 rounded-xl"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 border-t">
                <Field label="Enlace general de respaldo (opcional)" type="url" value={values.score_url} onChange={(value) => change("score_url", value)} placeholder="https://drive.google.com/..." />
              </div>
            </TabsContent>

            <TabsContent value="resources" className="grid gap-5 sm:grid-cols-2">
              <Field label="YouTube" type="url" value={values.youtube_url} onChange={(value) => change("youtube_url", value)} />
              <Field label="Spotify" type="url" value={values.spotify_url} onChange={(value) => change("spotify_url", value)} />
              <div className="sm:col-span-2">
                <Field label="Audio de referencia (URL)" type="url" value={values.audio_url} onChange={(value) => change("audio_url", value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Letra</Label>
                <Textarea value={values.lyrics} onChange={(event) => change("lyrics", event.target.value)} placeholder="Pega aquí la letra respetando versos y coros…" className="mt-2 min-h-52 rounded-xl font-mono leading-6" />
              </div>
            </TabsContent>
          </Tabs>

          <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-background/95 p-4 backdrop-blur sm:px-7">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="rounded-xl font-bold">
              {saving ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              Guardar canción
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-11 rounded-xl" />
    </div>
  );
}
