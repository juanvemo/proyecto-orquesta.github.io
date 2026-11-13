import { useEffect, useMemo, useState } from "react";
import {
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileMusic,
  Gauge,
  Music2,
  Sparkles,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { listScoresForSong } from "./scoresService";
import type { Song, SongScore } from "./types";

const safeUrl = (value: string | null) => (value && /^https?:\/\//i.test(value) ? value : null);

export function PresentationModeModal({
  open,
  onOpenChange,
  title,
  songs,
  initialSongIndex = 0,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  songs: Song[];
  initialSongIndex?: number;
}) {
  const [index, setIndex] = useState(initialSongIndex);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [fontScale, setFontScale] = useState<"md" | "lg" | "xl">("lg");
  const [scoresMap, setScoresMap] = useState<Record<string, SongScore[]>>({});

  useEffect(() => {
    if (open) {
      setIndex(Math.min(initialSongIndex, Math.max(0, songs.length - 1)));
    }
  }, [open, initialSongIndex, songs.length]);

  const activeSong = songs[index] ?? null;

  useEffect(() => {
    if (!open || !activeSong) return;
    if (activeSong.song_scores?.length) {
      setScoresMap((prev) => ({ ...prev, [activeSong.id]: activeSong.song_scores! }));
    } else if (!scoresMap[activeSong.id] && activeSong.organization_id) {
      void listScoresForSong(activeSong.organization_id, activeSong.id).then((rows) => {
        setScoresMap((prev) => ({ ...prev, [activeSong.id]: rows }));
      });
    }
  }, [open, activeSong, scoresMap]);

  const activeScores = useMemo(() => {
    if (!activeSong) return [];
    const loaded = scoresMap[activeSong.id] ?? activeSong.song_scores ?? [];
    if (loaded.length) return loaded;
    const legacy = safeUrl(activeSong.score_url);
    if (legacy) {
      return [
        {
          id: "legacy",
          organization_id: activeSong.organization_id,
          song_id: activeSong.id,
          category: "General",
          instrument: "General",
          title: `Partitura · ${activeSong.name}`,
          score_url: legacy,
          notes: null,
          version: null,
          sort_order: 0,
        },
      ];
    }
    return [];
  }, [activeSong, scoresMap]);

  const categories = useMemo(
    () => Array.from(new Set(activeScores.map((s) => s.category))),
    [activeScores],
  );

  const filteredScores = useMemo(
    () => (selectedCategory === "ALL" ? activeScores : activeScores.filter((s) => s.category === selectedCategory)),
    [activeScores, selectedCategory],
  );

  const lyricsClass =
    fontScale === "xl"
      ? "text-xl leading-9 sm:text-2xl sm:leading-10"
      : fontScale === "lg"
        ? "text-lg leading-8 sm:text-xl sm:leading-9"
        : "text-base leading-7";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[96vh] max-w-[96vw] flex-col overflow-hidden rounded-[1.75rem] border-[#312154] bg-[#140d24] p-0 text-white sm:max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#1d1234] px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-violet-200">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate text-base font-black text-white sm:text-lg">
                Modo Presentación · {title}
              </DialogTitle>
              <p className="text-xs text-white/60">
                {songs.length ? `Canción ${index + 1} de ${songs.length}` : "Sin canciones en repertorio"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden rounded-xl border border-white/15 bg-white/5 p-1 sm:flex">
              {(["md", "lg", "xl"] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setFontScale(sz)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold uppercase ${
                    fontScale === sz ? "bg-primary text-primary-foreground" : "text-white/70 hover:text-white"
                  }`}
                >
                  {sz === "md" ? "A-" : sz === "lg" ? "A" : "A+"}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" />
            </Button>
          </div>
        </div>

        {songs.length === 0 || !activeSong ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <Music2 className="mx-auto size-12 text-violet-300" />
              <p className="mt-4 text-xl font-black">No hay canciones asignadas a esta presentación</p>
              <p className="mt-2 text-sm text-white/60">Asocia un repertorio o canciones para activar la vista de escenario.</p>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 lg:grid-cols-[270px_1fr]">
            {/* Setlist Queue */}
            <aside className="flex flex-col border-b border-white/10 bg-[#180f2c] lg:border-b-0 lg:border-r">
              <div className="border-b border-white/10 px-4 py-3 text-xs font-black uppercase tracking-wider text-violet-300">
                Orden de repertorio ({songs.length})
              </div>
              <div className="flex max-h-36 gap-2 overflow-x-auto p-3 lg:max-h-none lg:flex-1 lg:flex-col lg:overflow-y-auto">
                {songs.map((s, idx) => (
                  <button
                    key={`${s.id}-${idx}`}
                    type="button"
                    onClick={() => {
                      setIndex(idx);
                      setSelectedCategory("ALL");
                    }}
                    className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      idx === index
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : "bg-white/5 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-black/25 text-xs font-black">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{s.name}</p>
                      <p className="truncate text-[11px] opacity-75">
                        {s.musical_key || "Sin tono"} {s.bpm ? `· ${s.bpm} BPM` : ""}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            {/* Stage Active Song View */}
            <div className="flex min-h-0 flex-col overflow-y-auto p-4 sm:p-7">
              <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-white sm:text-4xl">{activeSong.name}</h2>
                  <p className="mt-1 text-sm text-white/70">
                    {activeSong.original_artist || activeSong.composer || "Repertorio oficial"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-xl border border-violet-400/30 bg-violet-500/20 px-3 py-1.5 text-sm font-black text-violet-100">
                    <Music2 className="mr-1.5 size-4" />
                    Tono: {activeSong.musical_key || "N/D"}
                  </Badge>
                  <Badge className="rounded-xl border border-emerald-400/30 bg-emerald-500/20 px-3 py-1.5 text-sm font-black text-emerald-100">
                    <Gauge className="mr-1.5 size-4" />
                    {activeSong.bpm ? `${activeSong.bpm} BPM` : "Tempo libre"}
                  </Badge>
                  <Badge className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-bold text-white">
                    <Clock3 className="mr-1.5 size-4" />
                    {Math.floor(activeSong.duration_seconds / 60)}:{String(activeSong.duration_seconds % 60).padStart(2, "0")}
                  </Badge>
                </div>
              </div>

              {activeSong.observations && (
                <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/15 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-amber-200">Indicaciones / Observaciones en vivo</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-amber-50">{activeSong.observations}</p>
                </div>
              )}

              {/* Partituras bar */}
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-black text-violet-200">
                    <FileMusic className="size-4" />
                    Partituras disponibles ({filteredScores.length})
                  </div>
                  {categories.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedCategory("ALL")}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold ${selectedCategory === "ALL" ? "bg-violet-500 text-white" : "bg-white/10 text-white/75"}`}
                      >
                        Todas
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${selectedCategory === cat ? "bg-violet-500 text-white" : "bg-white/10 text-white/75"}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {filteredScores.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {filteredScores.map((sc) => (
                      <Button key={sc.id} asChild size="sm" variant="secondary" className="rounded-xl font-bold">
                        <a href={sc.score_url} target="_blank" rel="noreferrer">
                          <FileMusic className="mr-1.5 size-3.5" />
                          {sc.category}
                          {sc.instrument ? ` · ${sc.instrument}` : ""}
                          <ExternalLink className="ml-1.5 size-3" />
                        </a>
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-white/55">No hay enlaces de partitura cargados para esta canción.</p>
                )}
              </div>

              {/* Lyrics main stage sheet */}
              <div className="mt-5 flex-1 rounded-3xl border border-white/10 bg-black/25 p-5 sm:p-7">
                <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-violet-300">
                  <BookOpenText className="size-4" /> Letra de la canción
                </div>
                {activeSong.lyrics ? (
                  <pre className={`whitespace-pre-wrap font-sans font-medium text-white/95 ${lyricsClass}`}>
                    {activeSong.lyrics}
                  </pre>
                ) : (
                  <p className="py-10 text-center text-sm text-white/50">
                    Esta canción aún no tiene letra cargada.
                  </p>
                )}
              </div>

              {/* Bottom Stage Navigation */}
              <div className="mt-5 flex items-center justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={index === 0}
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  className="rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/15"
                >
                  <ChevronLeft className="mr-1.5 size-4" /> Anterior
                </Button>
                <Button
                  type="button"
                  disabled={index >= songs.length - 1}
                  onClick={() => setIndex((i) => Math.min(songs.length - 1, i + 1))}
                  className="rounded-xl font-bold"
                >
                  Siguiente <ChevronRight className="ml-1.5 size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
