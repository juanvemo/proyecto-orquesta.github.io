import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarCheck2, CheckCircle2, History, LoaderCircle, Plus, Save, Trash2, UserPlus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { evaluateMusicianAvailability, type ConflictSlot } from "@/features/musicians/availabilityMatch";
import type { Musician } from "@/features/musicians/types";
import {
  saveManualRequestAvailability,
  type AvailabilityHistoryEntry,
  type ExternalReplacement,
  type ManualMusicianStatus,
} from "./service";
import type { AvailabilityResult, QuoteRequest } from "./types";

export interface ConflictItem {
  id: string;
  name: string;
  kind: string;
  start_time: string;
  end_time: string;
  status: string;
}

const manualStatusTone: Record<ManualMusicianStatus, string> = {
  CONFIRMADO: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  PENDIENTE: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  "NO DISPONIBLE": "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  "POR CONFIRMAR": "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  "NO REQUERIDO": "bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

const manualStatusOptions: ManualMusicianStatus[] = [
  "CONFIRMADO",
  "PENDIENTE",
  "POR CONFIRMAR",
  "NO DISPONIBLE",
  "NO REQUERIDO",
];

export function CommercialAvailabilityPanel({
  request,
  musicians,
  conflicts,
  userId,
  userName,
  onSaved,
}: {
  request: QuoteRequest;
  musicians: Musician[];
  conflicts: ConflictItem[];
  userId: string;
  userName: string;
  onSaved: () => void;
}) {
  const latestSnapshot = (request.event_availability?.[0]?.snapshot ?? {}) as Record<string, unknown>;
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityResult>(request.availability_status);
  const [notes, setNotes] = useState(request.availability_notes ?? "");
  const [manualStatuses, setManualStatuses] = useState<Record<string, ManualMusicianStatus>>({});
  const [replacements, setReplacements] = useState<ExternalReplacement[]>([]);
  const [history, setHistory] = useState<AvailabilityHistoryEntry[]>([]);
  const [saving, setSaving] = useState(false);

  // External replacement form
  const [extName, setExtName] = useState("");
  const [extInstrument, setExtInstrument] = useState("");
  const [extPhone, setExtPhone] = useState("");
  const [extNotes, setExtNotes] = useState("");

  useEffect(() => {
    setAvailabilityStatus(request.availability_status);
    setNotes(request.availability_notes ?? "");
    const snap = (request.event_availability?.[0]?.snapshot ?? {}) as Record<string, unknown>;
    const savedMusicians = Array.isArray(snap.musicians)
      ? (snap.musicians as Array<{ id: string; manual_status?: ManualMusicianStatus; status?: string }>)
      : [];
    const map: Record<string, ManualMusicianStatus> = {};
    for (const m of musicians) {
      const prev = savedMusicians.find((s) => s.id === m.id);
      if (prev?.manual_status) {
        map[m.id] = prev.manual_status;
      } else {
        const evalResult = evaluateMusicianAvailability(m, request.event_date, request.start_time, request.end_time);
        map[m.id] =
          evalResult.state === "DISPONIBLE"
            ? "POR CONFIRMAR"
            : evalResult.state === "NO DISPONIBLE"
              ? "NO DISPONIBLE"
              : "PENDIENTE";
      }
    }
    setManualStatuses(map);
    setReplacements(Array.isArray(snap.external_replacements) ? (snap.external_replacements as ExternalReplacement[]) : []);
    setHistory(Array.isArray(snap.history) ? (snap.history as AvailabilityHistoryEntry[]) : []);
  }, [request, musicians]);

  const conflictSlots: ConflictSlot[] = useMemo(
    () =>
      conflicts.map((c) => ({
        id: c.id,
        name: `${c.kind}: ${c.name}`,
        date: request.event_date,
        start_time: c.start_time,
        end_time: c.end_time,
        musician_ids: [],
      })),
    [conflicts, request.event_date],
  );

  const musicianRows = useMemo(
    () =>
      musicians.map((m) => {
        const musicalFunction =
          m.musician_roles.find((item) => item.is_primary)?.musical_role?.name ??
          m.musician_instruments.find((item) => item.is_primary)?.instrument?.name ??
          m.specialty ??
          "Músico";
        const match = evaluateMusicianAvailability(m, request.event_date, request.start_time, request.end_time, conflictSlots);
        return {
          musician: m,
          musicalFunction,
          match,
          manualStatus: manualStatuses[m.id] ?? "POR CONFIRMAR",
        };
      }),
    [musicians, request.event_date, request.start_time, request.end_time, conflictSlots, manualStatuses],
  );

  const counts = useMemo(() => {
    const confirmed = musicianRows.filter((r) => r.manualStatus === "CONFIRMADO").length + replacements.filter((r) => (r.status ?? "CONFIRMADO") === "CONFIRMADO").length;
    const pending = musicianRows.filter((r) => r.manualStatus === "PENDIENTE" || r.manualStatus === "POR CONFIRMAR").length;
    const unavailable = musicianRows.filter((r) => r.manualStatus === "NO DISPONIBLE").length;
    return { confirmed, pending, unavailable };
  }, [musicianRows, replacements]);

  const addExternalReplacement = (e: FormEvent) => {
    e.preventDefault();
    if (!extName.trim() || !extInstrument.trim()) {
      toast.error("Nombre e instrumento son obligatorios para el reemplazante");
      return;
    }
    const nextItem: ExternalReplacement = {
      id: crypto.randomUUID(),
      name: extName.trim(),
      instrument: extInstrument.trim(),
      phone: extPhone.trim() || undefined,
      notes: extNotes.trim() || undefined,
      status: "CONFIRMADO",
    };
    setReplacements((prev) => [...prev, nextItem]);
    setExtName("");
    setExtInstrument("");
    setExtPhone("");
    setExtNotes("");
    toast.success("Reemplazante externo agregado (guarda para persistir cambios)");
  };

  const handleSave = async (nextAvailabilityStatus: AvailabilityResult = availabilityStatus) => {
    setSaving(true);
    try {
      const summary = `${counts.confirmed} confirmados · ${counts.pending} por confirmar/pendientes · ${replacements.length} reemplazantes externos · Estado: ${nextAvailabilityStatus}`;
      const nextHistory: AvailabilityHistoryEntry[] = [
        { at: new Date().toISOString(), by: userName || "Administración", summary },
        ...history,
      ].slice(0, 30);

      const snapshot: Record<string, unknown> = {
        ...latestSnapshot,
        conflicts: conflicts.map((i) => ({ id: i.id, name: i.name, kind: i.kind })),
        musicians: musicianRows.map((i) => ({
          id: i.musician.id,
          name: `${i.musician.first_name} ${i.musician.last_name}`,
          status: i.match.label,
          manual_status: i.manualStatus,
          function: i.musicalFunction,
        })),
        external_replacements: replacements,
        history: nextHistory,
      };

      await saveManualRequestAvailability({
        request,
        userId,
        userName: userName || "Administración",
        availabilityStatus: nextAvailabilityStatus,
        notes,
        snapshot,
        changeSummary: summary,
      });
      setAvailabilityStatus(nextAvailabilityStatus);
      setHistory(nextHistory);
      toast.success("Disponibilidad y nómina actualizadas", {
        description: "Puedes modificar esta información en cualquier momento, incluso después de enviar o confirmar el evento.",
      });
      onSaved();
    } catch (error) {
      toast.error("No fue posible guardar la disponibilidad", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-5">
          <Card className="rounded-[2rem] shadow-none">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-black">Disponibilidad general y calendario</h2>
                <Badge variant="outline" className="rounded-lg text-[10px] font-bold">SIEMPRE EDITABLE</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Edita manualmente las confirmaciones antes o después de enviar la cotización, aceptarla o confirmar el evento.
              </p>

              <div className="mt-4 space-y-3">
                {conflicts.length ? (
                  conflicts.map((item) => (
                    <div key={`${item.kind}-${item.id}`} className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
                      <p className="font-bold text-rose-700">{item.kind}: {item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)} · {item.status}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="size-5" />
                    <p className="mt-1.5 font-black">Sin cruces de eventos o ensayos</p>
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-muted/40 p-3 text-center">
                <div><p className="text-lg font-black text-emerald-600">{counts.confirmed}</p><p className="text-[10px] font-bold text-muted-foreground">Confirmados</p></div>
                <div><p className="text-lg font-black text-amber-600">{counts.pending}</p><p className="text-[10px] font-bold text-muted-foreground">Por confirmar</p></div>
                <div><p className="text-lg font-black text-primary">{replacements.length}</p><p className="text-[10px] font-bold text-muted-foreground">Reemplazantes</p></div>
              </div>

              <Label className="mt-5 block">Notas de disponibilidad</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-2 rounded-xl" placeholder="Anotaciones de reemplazos, horarios o cambios..." />

              <div className="mt-4 grid gap-2">
                <Button disabled={saving} onClick={() => void handleSave("DISPONIBLE")} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
                  {saving ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />}
                  Guardar · Disponibilidad confirmada
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button disabled={saving} onClick={() => void handleSave("REQUIERE REVISIÓN")} variant="outline" className="rounded-xl">
                    <CalendarCheck2 className="mr-1.5 size-4" /> Requiere revisión
                  </Button>
                  <Button disabled={saving} onClick={() => void handleSave("EXISTE CONFLICTO")} variant="outline" className="rounded-xl text-rose-600">
                    <XCircle className="mr-1.5 size-4" /> Con conflicto
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* External Replacements */}
          <Card className="rounded-[2rem] shadow-none">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <UserPlus className="size-5 text-primary" />
                <h3 className="font-black">Reemplazantes externos</h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Registra músicos de apoyo sin crear cuentas ni registros permanentes en el directorio.
              </p>

              <form onSubmit={addExternalReplacement} className="mt-4 space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={extName} onChange={(e) => setExtName(e.target.value)} placeholder="Nombre completo *" className="rounded-xl" />
                  <Input value={extInstrument} onChange={(e) => setExtInstrument(e.target.value)} placeholder="Instrumento *" className="rounded-xl" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={extPhone} onChange={(e) => setExtPhone(e.target.value)} placeholder="Teléfono (opcional)" className="rounded-xl" />
                  <Input value={extNotes} onChange={(e) => setExtNotes(e.target.value)} placeholder="Observaciones" className="rounded-xl" />
                </div>
                <Button type="submit" variant="outline" className="w-full rounded-xl font-bold">
                  <Plus className="mr-1.5 size-4" /> Agregar reemplazante externo
                </Button>
              </form>

              {replacements.length > 0 && (
                <div className="mt-4 space-y-2">
                  {replacements.map((rep) => (
                    <div key={rep.id} className="flex items-start justify-between gap-2 rounded-2xl border bg-muted/25 p-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-sm">{rep.name}</span>
                          <Badge className="rounded-md bg-violet-500/15 text-[10px] text-violet-700 dark:text-violet-300">REEMPLAZANTE EXTERNO</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {rep.instrument}
                          {rep.phone ? ` · ${rep.phone}` : ""}
                          {rep.notes ? ` · ${rep.notes}` : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setReplacements((prev) => prev.filter((item) => item.id !== rep.id))}
                        className="size-8 shrink-0 text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Manual Musician Status Roster */}
        <div className="space-y-5">
          <Card className="rounded-[2rem] shadow-none">
            <CardContent className="p-0">
              <div className="flex flex-col justify-between gap-3 border-b p-5 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-black">Disponibilidad manual de músicos</h2>
                  <p className="text-xs text-muted-foreground">
                    Ajusta individualmente el estado de cada músico para esta cotización y guarda los cambios.
                  </p>
                </div>
                <Button size="sm" disabled={saving} onClick={() => void handleSave()} className="rounded-xl font-bold">
                  {saving ? <LoaderCircle className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}
                  Guardar lista
                </Button>
              </div>
              <div className="max-h-[540px] divide-y overflow-y-auto">
                {musicianRows.map((item) => (
                  <div key={item.musician.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-xs font-black text-primary">
                      {item.musician.first_name[0]}{item.musician.last_name[0]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold">{item.musician.first_name} {item.musician.last_name}</p>
                        <Badge variant="outline" className={`rounded-md text-[10px] ${item.match.toneClass}`}>
                          Agenda: {item.match.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.musicalFunction}</p>
                    </div>
                    <Select
                      value={item.manualStatus}
                      onValueChange={(val: ManualMusicianStatus) =>
                        setManualStatuses((prev) => ({ ...prev, [item.musician.id]: val }))
                      }
                    >
                      <SelectTrigger className={`h-9 w-full rounded-xl font-bold sm:w-44 ${manualStatusTone[item.manualStatus]}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {manualStatusOptions.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <History className="size-4 text-primary" />
                <h3 className="font-black">Historial de cambios de disponibilidad</h3>
              </div>
              {history.length ? (
                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                  {history.map((h, i) => (
                    <div key={i} className="rounded-xl bg-muted/40 p-3 text-xs">
                      <p className="font-bold">{h.summary}</p>
                      <p className="mt-1 text-muted-foreground">
                        {h.by} · {new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(h.at))}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Aún no se han guardado cambios manuales de disponibilidad.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
