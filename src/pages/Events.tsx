import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpenText,
  CalendarCheck2,
  CheckCircle2,
  CircleDollarSign,
  FileCog,
  FileSignature,
  ListMusic,
  MapPin,
  Music2,
  Plus,
  Sparkles,
  Trash2,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { CreateEventDialog } from "@/features/commercial/CreateEventDialog";
import {
  assignEventMusician,
  deleteEvent,
  listEvents,
  markTransactionPaid,
  saveEventConditions,
  updateEventMusicianStatus,
  updateEventStatus,
  type ExternalReplacement,
} from "@/features/commercial/service";
import type { CommercialEvent } from "@/features/commercial/types";
import { listMusicians } from "@/features/musicians/service";
import type { Musician } from "@/features/musicians/types";
import { PresentationModeModal } from "@/features/repertoire/PresentationModeModal";
import { SongDetailDialog } from "@/features/repertoire/SongDetailDialog";
import { addSetlistSong, createSetlist, loadRepertoire } from "@/features/repertoire/service";
import type { Setlist, Song } from "@/features/repertoire/types";
import { supabase } from "@/integrations/supabase/client";

export default function Events() {
  const { membership, session, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [events, setEvents] = useState<CommercialEvent[]>([]);
  const [musicians, setMusicians] = useState<Musician[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedMusician, setSelectedMusician] = useState("");
  const [quickSongId, setQuickSongId] = useState("");
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [presentationStartIdx, setPresentationStartIdx] = useState(0);
  const [inspectSong, setInspectSong] = useState<Song | null>(null);

  // External replacement form inside Event
  const [repName, setRepName] = useState("");
  const [repInstrument, setRepInstrument] = useState("");
  const [repPhone, setRepPhone] = useState("");
  const [repNotes, setRepNotes] = useState("");

  const load = useCallback(async () => {
    if (!membership) return;
    try {
      const [e, m, r] = await Promise.all([
        listEvents(membership.organizationId),
        listMusicians(membership.organizationId),
        loadRepertoire(membership.organizationId),
      ]);
      setEvents(e);
      setMusicians(m.filter((item) => item.status === "ACTIVO"));
      setSetlists(r.setlists);
      setSongs(r.songs);
    } catch (error) {
      toast.error("No fue posible cargar eventos", { description: error instanceof Error ? error.message : undefined });
    }
  }, [membership]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = events.find((event) => event.id === params.get("evento")) ?? events[0] ?? null;
  const open = (id: string) => setParams({ evento: id });

  const selectedSetlist = useMemo(
    () => setlists.find((s) => s.id === selected?.setlist_id) ?? null,
    [setlists, selected?.setlist_id],
  );

  const eventSongs = useMemo(() => {
    if (!selectedSetlist) return [] as Song[];
    return [...(selectedSetlist.setlist_songs ?? [])]
      .sort((a, b) => a.position - b.position)
      .filter((item) => item.item_type === "SONG" && item.song)
      .map((item) => item.song!);
  }, [selectedSetlist]);

  const externalReplacements = useMemo(() => {
    const cond = (selected?.conditions ?? {}) as Record<string, unknown>;
    return Array.isArray(cond.external_replacements) ? (cond.external_replacements as ExternalReplacement[]) : [];
  }, [selected?.conditions]);

  const addQuickSongToEvent = async () => {
    if (!membership || !session || !selected || !quickSongId) return;
    const songObj = songs.find((s) => s.id === quickSongId);
    if (!songObj) return;
    try {
      let targetSetlistId = selected.setlist_id;
      let nextPos = eventSongs.length;
      if (!targetSetlistId) {
        targetSetlistId = await createSetlist(
          membership.organizationId,
          session.user.id,
          `Repertorio · ${selected.name}`,
          `Setlist oficial del evento ${selected.name}`,
        );
        await supabase.from("events").update({ setlist_id: targetSetlistId }).eq("id", selected.id);
        nextPos = 0;
      }
      await addSetlistSong(membership.organizationId, targetSetlistId, songObj, nextPos);
      setQuickSongId("");
      toast.success(`"${songObj.name}" agregada al repertorio del evento`);
      await load();
    } catch (error) {
      toast.error("No se pudo agregar la canción al evento", { description: error instanceof Error ? error.message : undefined });
    }
  };

  const handleAddExternalRep = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !repName.trim() || !repInstrument.trim()) {
      toast.error("Nombre e instrumento son requeridos");
      return;
    }
    const nextList: ExternalReplacement[] = [
      ...externalReplacements,
      {
        id: crypto.randomUUID(),
        name: repName.trim(),
        instrument: repInstrument.trim(),
        phone: repPhone.trim() || undefined,
        notes: repNotes.trim() || undefined,
        status: "CONFIRMADO",
      },
    ];
    try {
      await saveEventConditions(selected.id, { ...(selected.conditions ?? {}), external_replacements: nextList });
      setRepName("");
      setRepInstrument("");
      setRepPhone("");
      setRepNotes("");
      toast.success("Reemplazante externo añadido al evento");
      await load();
    } catch (error) {
      toast.error("No se pudo guardar el reemplazante", { description: error instanceof Error ? error.message : undefined });
    }
  };

  const handleRemoveExternalRep = async (repId: string) => {
    if (!selected) return;
    const nextList = externalReplacements.filter((r) => r.id !== repId);
    try {
      await saveEventConditions(selected.id, { ...(selected.conditions ?? {}), external_replacements: nextList });
      await load();
    } catch (error) {
      toast.error("No se pudo quitar el reemplazante", { description: error instanceof Error ? error.message : undefined });
    }
  };

  if (!membership || !session) return null;

  const canManage = hasPermission("events.manage");

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-primary">Producción de eventos</p>
          <h1 className="mt-2 text-3xl font-black">Eventos</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gestiona eventos, músicos, reemplazantes externos, repertorio con Modo Presentación en vivo, rider técnico y contratos.
          </p>
        </div>
        {canManage && (
          <CreateEventDialog
            organizationId={membership.organizationId}
            onCreated={(eventId) => {
              void load();
              open(eventId);
            }}
          />
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <Card className="h-fit rounded-[2rem] shadow-none">
          <CardContent className="p-3">
            {events.length ? (
              events.map((event) => (
                <button
                  key={event.id}
                  onClick={() => open(event.id)}
                  className={`mb-1 w-full rounded-2xl p-4 text-left transition ${
                    selected?.id === event.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  <p className="font-black">{event.name}</p>
                  <p className={`mt-1 text-xs ${selected?.id === event.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {date(event.event_date)} · {event.city}
                  </p>
                </button>
              ))
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">No hay eventos. Puedes crear uno directamente sin cotización.</div>
            )}
          </CardContent>
        </Card>

        {selected && (
          <div className="space-y-5">
            <Card className="rounded-[2rem] shadow-none">
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="rounded-lg">{selected.status}</Badge>
                      <Badge variant="outline" className="rounded-lg">{selected.event_type}</Badge>
                      <Badge variant="secondary" className="rounded-lg">{date(selected.event_date)} · {selected.start_time.slice(0, 5)}–{selected.end_time.slice(0, 5)}</Badge>
                    </div>
                    <h2 className="mt-3 text-2xl font-black">{selected.name}</h2>
                    <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="size-4 shrink-0" />
                      {selected.city} · {selected.venue} · {selected.address}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-sm text-muted-foreground">Valor contratado</p>
                    <p className="text-2xl font-black text-primary">{money(selected.contracted_value)}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Select
                    value={selected.status}
                    disabled={!canManage}
                    onValueChange={(value) =>
                      void updateEventStatus(selected, value as CommercialEvent["status"], session.user.id)
                        .then(() => {
                          toast.success("Estado del evento actualizado");
                          void load();
                        })
                        .catch((error) => toast.error("No se pudo actualizar el evento", { description: error instanceof Error ? error.message : undefined }))
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <CalendarCheck2 className="mr-2 size-4" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["PENDIENTE", "CONFIRMADO", "EN CURSO", "REALIZADO", "CANCELADO", "CERRADO"].map((status) => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button variant="outline" onClick={() => navigate(`/produccion-tecnica?evento=${selected.id}`)} className="rounded-xl">
                    <FileCog className="mr-2 size-4" /> Producción y rider
                  </Button>

                  <Button variant="outline" onClick={() => navigate(`/contratos?evento=${selected.id}`)} className="rounded-xl">
                    <FileSignature className="mr-2 size-4" /> Contrato
                  </Button>

                  <Select
                    value={selected.setlist_id ?? "NONE"}
                    disabled={!canManage}
                    onValueChange={async (value) => {
                      const { error } = await supabase.from("events").update({ setlist_id: value === "NONE" ? null : value }).eq("id", selected.id);
                      if (error) toast.error("No se pudo asignar el setlist");
                      else {
                        toast.success("Repertorio asignado al evento");
                        void load();
                      }
                    }}
                  >
                    <SelectTrigger className="rounded-xl">
                      <Music2 className="mr-2 size-4" />
                      <SelectValue placeholder="Asignar setlist" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Sin repertorio asignado</SelectItem>
                      {setlists.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  {canManage && (
                    <Button
                      variant="outline"
                      className="rounded-xl text-destructive"
                      onClick={() => {
                        if (!window.confirm(`¿Eliminar definitivamente ${selected.name}? También se borrarán músicos, rider y movimientos financieros asociados.`)) return;
                        void deleteEvent(selected.id)
                          .then(() => {
                            toast.success("Evento eliminado");
                            setParams({});
                            void load();
                          })
                          .catch((error) => toast.error("No se pudo eliminar el evento", { description: error instanceof Error ? error.message : undefined }));
                      }}
                    >
                      <Trash2 className="mr-2 size-4" /> Eliminar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Repertorio y Modo Presentación */}
            <Card className="rounded-[2rem] border-primary/20 shadow-none">
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ListMusic className="size-5 text-primary" />
                      <h3 className="text-lg font-black">Repertorio y Presentación en Vivo</h3>
                      {selectedSetlist && <Badge variant="secondary" className="rounded-lg">{selectedSetlist.name}</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {eventSongs.length} canciones listas para consulta en vivo (letras, partituras por instrumento, tempo y tonalidad).
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      setPresentationStartIdx(0);
                      setPresentationOpen(true);
                    }}
                    disabled={eventSongs.length === 0}
                    className="rounded-xl font-black"
                  >
                    <Sparkles className="mr-2 size-4" />
                    Presentación en vivo
                  </Button>
                </div>

                {canManage && (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Select value={quickSongId || "NONE"} onValueChange={(v) => setQuickSongId(v === "NONE" ? "" : v)}>
                      <SelectTrigger className="rounded-xl sm:flex-1"><SelectValue placeholder="Agregar canción directamente al repertorio del evento..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Agregar canción directamente al evento...</SelectItem>
                        {songs.filter((s) => s.status !== "RETIRADA").map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name} {s.musical_key ? `(${s.musical_key})` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" disabled={!quickSongId} onClick={() => void addQuickSongToEvent()} className="rounded-xl font-bold">
                      <Plus className="mr-1.5 size-4" /> Añadir al evento
                    </Button>
                  </div>
                )}

                {eventSongs.length > 0 ? (
                  <div className="mt-4 divide-y overflow-hidden rounded-2xl border">
                    {eventSongs.map((song, idx) => (
                      <div key={`${song.id}-${idx}`} className="flex flex-col justify-between gap-3 p-3.5 sm:flex-row sm:items-center sm:px-4">
                        <div className="flex items-center gap-3">
                          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-xs font-black text-primary">{idx + 1}</span>
                          <div>
                            <p className="font-bold">{song.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {song.musical_key || "Sin tono"} · {song.bpm ? `${song.bpm} BPM` : "Tempo libre"} · {song.song_scores?.length || (song.score_url ? 1 : 0)} partitura(s)
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => setInspectSong(song)} className="rounded-xl">
                            <BookOpenText className="mr-1.5 size-3.5 text-primary" /> Letra y partituras
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setPresentationStartIdx(idx);
                              setPresentationOpen(true);
                            }}
                            className="rounded-xl"
                          >
                            Abrir en vivo
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                    Asigna un setlist existente o agrega canciones arriba para habilitar el Modo Presentación en este evento.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="rounded-[2rem] shadow-none">
                <CardContent className="p-0">
                  <div className="border-b p-5">
                    <h3 className="font-black">Músicos del evento y reemplazantes</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">La nómina permanece editable incluso después de confirmar el evento.</p>
                    {canManage && (
                      <div className="mt-3 flex gap-2">
                        <Select value={selectedMusician || "NONE"} onValueChange={(v) => setSelectedMusician(v === "NONE" ? "" : v)}>
                          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar músico" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE">Seleccionar músico</SelectItem>
                            {musicians
                              .filter((m) => !selected.event_musicians.some((e) => e.musician_id === m.id))
                              .map((m) => <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button
                          size="icon"
                          disabled={!selectedMusician}
                          onClick={() =>
                            void assignEventMusician(membership.organizationId, selected.id, selectedMusician).then(() => {
                              setSelectedMusician("");
                              void load();
                            })
                          }
                          className="shrink-0 rounded-xl"
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="divide-y">
                    {selected.event_musicians.map((item) => (
                      <div key={item.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                        <UsersRound className="hidden size-4 text-primary sm:block" />
                        <div className="flex-1">
                          <p className="font-bold">{item.musician.first_name} {item.musician.last_name}</p>
                          <p className="text-xs text-muted-foreground">{item.musician.specialty}</p>
                        </div>
                        <Select
                          value={item.status}
                          disabled={!canManage}
                          onValueChange={(value) =>
                            void updateEventMusicianStatus(membership.organizationId, item.id, value as "PENDIENTE" | "CONFIRMADO" | "NO DISPONIBLE")
                              .then(() => void load())
                              .catch((error) => toast.error("No se pudo actualizar al músico", { description: error instanceof Error ? error.message : undefined }))
                          }
                        >
                          <SelectTrigger className="h-9 w-full rounded-xl sm:w-[155px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["PENDIENTE", "CONFIRMADO", "NO DISPONIBLE"].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}

                    {externalReplacements.map((rep) => (
                      <div key={rep.id} className="flex items-center justify-between gap-3 bg-violet-500/[0.04] p-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="font-bold">{rep.name}</p>
                            <Badge className="rounded-md bg-violet-500/15 text-[10px] text-violet-700">REEMPLAZANTE EXTERNO</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {rep.instrument}
                            {rep.phone ? ` · ${rep.phone}` : ""}
                            {rep.notes ? ` · ${rep.notes}` : ""}
                          </p>
                        </div>
                        {canManage && (
                          <Button type="button" size="icon" variant="ghost" onClick={() => void handleRemoveExternalRep(rep.id)} className="text-destructive">
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {canManage && (
                    <form onSubmit={handleAddExternalRep} className="border-t bg-muted/20 p-4 space-y-2">
                      <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-muted-foreground">
                        <UserPlus className="size-3.5 text-primary" /> Añadir reemplazante externo
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input value={repName} onChange={(e) => setRepName(e.target.value)} placeholder="Nombre *" className="h-9 rounded-xl text-xs" />
                        <Input value={repInstrument} onChange={(e) => setRepInstrument(e.target.value)} placeholder="Instrumento *" className="h-9 rounded-xl text-xs" />
                        <Input value={repPhone} onChange={(e) => setRepPhone(e.target.value)} placeholder="Teléfono (opcional)" className="h-9 rounded-xl text-xs" />
                        <Input value={repNotes} onChange={(e) => setRepNotes(e.target.value)} placeholder="Observación" className="h-9 rounded-xl text-xs" />
                      </div>
                      <Button type="submit" size="sm" variant="outline" className="w-full rounded-xl font-bold">
                        <Plus className="mr-1.5 size-3.5" /> Registrar reemplazante externo
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-[2rem] shadow-none">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between border-b p-5">
                    <h3 className="font-black">Anticipo, saldo y contrato</h3>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/contratos?evento=${selected.id}`)} className="rounded-xl">
                      <FileSignature className="mr-1.5 size-3.5" /> Enviar contrato
                    </Button>
                  </div>
                  <div className="divide-y">
                    {selected.financial_transactions.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-4">
                        <span className={`grid size-10 place-items-center rounded-xl ${item.status === "PAGADO" ? "bg-emerald-500/10 text-emerald-600" : "bg-orange-500/10 text-orange-600"}`}>
                          <CircleDollarSign className="size-4" />
                        </span>
                        <div className="flex-1">
                          <p className="font-bold">{item.concept}</p>
                          <p className="text-xs text-muted-foreground">{item.status}</p>
                        </div>
                        <p className="font-black">{money(item.amount)}</p>
                        {item.status === "PENDIENTE" && canManage && (
                          <Button
                            size="sm"
                            onClick={() =>
                              void markTransactionPaid(selected, item.id, session.user.id).then(() => {
                                toast.success("Pago registrado — puedes generar y enviar el contrato.");
                                void load();
                              })
                            }
                            className="rounded-xl bg-emerald-600"
                          >
                            <CheckCircle2 className="mr-1 size-3" /> Pagado
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {selected.event_riders[0] && (
              <Card className="rounded-[2rem] border-primary/20 bg-primary/5 shadow-none">
                <CardContent className="flex items-center gap-4 p-5">
                  <FileCog className="size-8 text-primary" />
                  <div>
                    <p className="font-black">Rider técnico y logística del evento</p>
                    <p className="text-sm text-muted-foreground">Incluye servicios, requisitos, músicos, montaje e instrumentación actual.</p>
                  </div>
                  <Badge className="ml-auto rounded-lg">{selected.event_riders[0].status}</Badge>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      <PresentationModeModal
        open={presentationOpen}
        onOpenChange={setPresentationOpen}
        title={selected?.name ?? "Evento"}
        songs={eventSongs}
        initialSongIndex={presentationStartIdx}
      />

      <SongDetailDialog
        song={inspectSong}
        open={Boolean(inspectSong)}
        onOpenChange={(isOpen) => { if (!isOpen) setInspectSong(null); }}
      />
    </div>
  );
}

function date(value: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));
}
function money(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}
