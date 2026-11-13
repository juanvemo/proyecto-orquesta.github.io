import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarPlus, LoaderCircle, Mail, Save, Sparkles, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { evaluateMusicianAvailability, type ConflictSlot } from "@/features/musicians/availabilityMatch";
import type { Musician } from "@/features/musicians/types";
import { supabase } from "@/integrations/supabase/client";
import { saveRehearsal } from "./service";
import { emptyRehearsalForm, type Rehearsal, type RehearsalFormValues, type RehearsalStatus } from "./types";

function fromRehearsal(rehearsal: Rehearsal): RehearsalFormValues {
  return {
    name: rehearsal.name,
    rehearsal_date: rehearsal.rehearsal_date,
    start_time: rehearsal.start_time.slice(0, 5),
    end_time: rehearsal.end_time.slice(0, 5),
    location: rehearsal.location,
    address: rehearsal.address ?? "",
    responsible_musician_id: rehearsal.responsible_musician_id ?? "",
    objective: rehearsal.objective,
    observations: rehearsal.observations ?? "",
    status: rehearsal.status,
    musician_ids: rehearsal.rehearsal_musicians.map((item) => item.musician_id),
  };
}

export function RehearsalFormDialog({
  open,
  onOpenChange,
  organizationId,
  userId,
  rehearsal,
  musicians,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  organizationId: string;
  userId: string;
  rehearsal?: Rehearsal | null;
  musicians: Musician[];
  onSaved: (id: string, promptGmail?: boolean) => void;
}) {
  const [values, setValues] = useState<RehearsalFormValues>(emptyRehearsalForm);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictSlot[]>([]);
  const [filterMode, setFilterMode] = useState<"ALL" | "AVAILABLE">("ALL");
  const [sendGmailAfterSave, setSendGmailAfterSave] = useState(true);

  useEffect(() => {
    if (open) {
      setValues(rehearsal ? fromRehearsal(rehearsal) : { ...emptyRehearsalForm, musician_ids: [] });
      setFilterMode("ALL");
      setSendGmailAfterSave(!rehearsal);
    }
  }, [open, rehearsal]);

  // Query other rehearsals and events on the selected date so schedule conflicts display live
  useEffect(() => {
    if (!open || !organizationId || !values.rehearsal_date) return;
    let cancelled = false;
    void (async () => {
      const [rehearsalRes, eventRes] = await Promise.all([
        supabase
          .from("rehearsals")
          .select("id,name,rehearsal_date,start_time,end_time,status,rehearsal_musicians(musician_id)")
          .eq("organization_id", organizationId)
          .eq("rehearsal_date", values.rehearsal_date)
          .neq("status", "CANCELADO"),
        supabase
          .from("events")
          .select("id,name,event_date,start_time,end_time,status,event_musicians(musician_id)")
          .eq("organization_id", organizationId)
          .eq("event_date", values.rehearsal_date)
          .neq("status", "CANCELADO"),
      ]);
      if (cancelled) return;
      const slots: ConflictSlot[] = [];
      for (const r of (rehearsalRes.data ?? []) as Array<{ id: string; name: string; rehearsal_date: string; start_time: string; end_time: string; rehearsal_musicians: Array<{ musician_id: string }> }>) {
        slots.push({
          id: r.id,
          name: `Ensayo: ${r.name}`,
          date: r.rehearsal_date,
          start_time: r.start_time,
          end_time: r.end_time,
          musician_ids: (r.rehearsal_musicians ?? []).map((rm) => rm.musician_id),
        });
      }
      for (const e of (eventRes.data ?? []) as Array<{ id: string; name: string; event_date: string; start_time: string; end_time: string; event_musicians: Array<{ musician_id: string }> }>) {
        slots.push({
          id: e.id,
          name: `Evento: ${e.name}`,
          date: e.event_date,
          start_time: e.start_time,
          end_time: e.end_time,
          musician_ids: (e.event_musicians ?? []).map((em) => em.musician_id),
        });
      }
      setConflicts(slots);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, organizationId, values.rehearsal_date]);

  const evaluatedMusicians = useMemo(() => {
    const list = musicians.map((m) => ({
      musician: m,
      match: evaluateMusicianAvailability(m, values.rehearsal_date, values.start_time, values.end_time, conflicts, rehearsal?.id),
    }));
    const priorityOrder: Record<string, number> = {
      DISPONIBLE: 0,
      "CON RESTRICCIONES": 1,
      "SIN REGISTRO": 2,
      "CRUCE DE HORARIO": 3,
      "NO DISPONIBLE": 4,
    };
    return list.sort((a, b) => (priorityOrder[a.match.state] ?? 5) - (priorityOrder[b.match.state] ?? 5));
  }, [musicians, values.rehearsal_date, values.start_time, values.end_time, conflicts, rehearsal?.id]);

  const availableIds = useMemo(
    () => evaluatedMusicians.filter((item) => item.match.state === "DISPONIBLE").map((item) => item.musician.id),
    [evaluatedMusicians],
  );

  const visibleMusicians = useMemo(
    () =>
      filterMode === "AVAILABLE"
        ? evaluatedMusicians.filter((item) => item.match.state === "DISPONIBLE" || item.match.state === "CON RESTRICCIONES")
        : evaluatedMusicians,
    [evaluatedMusicians, filterMode],
  );

  const change = <K extends keyof RehearsalFormValues>(key: K, value: RehearsalFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));
  const toggleMusician = (id: string) => change("musician_ids", values.musician_ids.includes(id) ? values.musician_ids.filter((item) => item !== id) : [...values.musician_ids, id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.name.trim() || !values.location.trim() || !values.objective.trim() || !values.rehearsal_date) {
      toast.error("Completa nombre, fecha, lugar y objetivo");
      return;
    }
    if (values.end_time <= values.start_time) {
      toast.error("La hora final debe ser posterior a la hora de inicio");
      return;
    }
    setSaving(true);
    try {
      const id = await saveRehearsal(organizationId, userId, values, rehearsal?.id);
      const shouldPromptGmail = sendGmailAfterSave && values.musician_ids.length > 0;
      toast.success(rehearsal ? "Ensayo actualizado" : "Ensayo y convocatoria creados", {
        description: "Los músicos convocados quedarán pendientes hasta confirmar asistencia.",
      });
      onOpenChange(false);
      onSaved(id, shouldPromptGmail);
    } catch (error) {
      toast.error("No fue posible guardar el ensayo", { description: error instanceof Error ? error.message : undefined });
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
              <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><CalendarPlus className="size-5" /></span>
              <div>
                <DialogTitle className="text-xl font-black">{rehearsal ? "Editar ensayo" : "Nuevo ensayo"}</DialogTitle>
                <DialogDescription>Programa el encuentro, revisa quién está disponible para esta fecha/horario y convoca al equipo.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
            <Field label="Nombre *" value={values.name} onChange={(value) => change("name", value)} />
            <Field label="Fecha *" type="date" value={values.rehearsal_date} onChange={(value) => change("rehearsal_date", value)} />
            <Field label="Hora de inicio *" type="time" value={values.start_time} onChange={(value) => change("start_time", value)} />
            <Field label="Hora final *" type="time" value={values.end_time} onChange={(value) => change("end_time", value)} />
            <Field label="Lugar *" value={values.location} onChange={(value) => change("location", value)} />
            <Field label="Dirección" value={values.address} onChange={(value) => change("address", value)} />
            <div>
              <Label>Responsable</Label>
              <Select value={values.responsible_musician_id || "NONE"} onValueChange={(value) => change("responsible_musician_id", value === "NONE" ? "" : value)}>
                <SelectTrigger className="mt-2 h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Sin asignar</SelectItem>
                  {musicians.map((item) => <SelectItem key={item.id} value={item.id}>{item.first_name} {item.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={values.status} onValueChange={(value: RehearsalStatus) => change("status", value)}>
                <SelectTrigger className="mt-2 h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{["PLANIFICADO", "CONFIRMADO", "EN CURSO", "FINALIZADO", "CANCELADO"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Objetivo *</Label>
              <Textarea value={values.objective} onChange={(event) => change("objective", event.target.value)} className="mt-2 min-h-24 rounded-xl" />
            </div>
            <div className="sm:col-span-2">
              <Label>Observaciones</Label>
              <Textarea value={values.observations} onChange={(event) => change("observations", event.target.value)} className="mt-2 rounded-xl" />
            </div>

            <div className="sm:col-span-2">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Label>Músicos disponibles y convocados</Label>
                  <p className="text-xs text-muted-foreground">
                    {values.musician_ids.length} convocados · {availableIds.length} disponibles para el horario elegido
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={filterMode === "AVAILABLE" ? "default" : "outline"}
                    size="sm"
                    className="rounded-lg"
                    onClick={() => setFilterMode((m) => (m === "AVAILABLE" ? "ALL" : "AVAILABLE"))}
                  >
                    {filterMode === "AVAILABLE" ? "Mostrar todos" : "Solo disponibles"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10"
                    onClick={() => {
                      const next = Array.from(new Set([...values.musician_ids, ...availableIds]));
                      change("musician_ids", next);
                      toast.success(`${availableIds.length} disponibles preseleccionados`);
                    }}
                  >
                    <Sparkles className="mr-1.5 size-3.5" />
                    Seleccionar disponibles
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => change("musician_ids", values.musician_ids.length === musicians.length ? [] : musicians.map((item) => item.id))}
                  >
                    <UsersRound className="mr-1.5 size-3.5" />
                    {values.musician_ids.length === musicians.length ? "Quitar todos" : "Todos"}
                  </Button>
                </div>
              </div>

              <div className="grid max-h-72 gap-2 overflow-y-auto rounded-2xl border p-3 sm:grid-cols-2">
                {visibleMusicians.map(({ musician: item, match }) => (
                  <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-transparent p-2.5 hover:border-border hover:bg-muted/60">
                    <Checkbox checked={values.musician_ids.includes(item.id)} onCheckedChange={() => toggleMusician(item.id)} className="mt-1" />
                    <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/10 text-xs font-black text-primary">
                      {item.photo_url ? <img src={item.photo_url} alt="" className="h-full w-full object-cover" /> : `${item.first_name[0]}${item.last_name[0]}`}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-bold">{item.first_name} {item.last_name}</span>
                        <Badge variant="outline" className={`rounded-md px-1.5 py-0 text-[10px] font-bold ${match.toneClass}`}>
                          {match.label}
                        </Badge>
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">{item.specialty || item.status}</span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground/80">{match.reason}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Nota: Estar disponible significa compatibilidad horaria. Al guardar, cada músico convocado recibirá estado <strong>PENDIENTE</strong> para confirmar individualmente su asistencia.
              </p>
              <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs font-semibold text-foreground">
                <Checkbox checked={sendGmailAfterSave} onCheckedChange={(checked) => setSendGmailAfterSave(Boolean(checked))} />
                <Mail className="size-4 shrink-0 text-primary" />
                <span>Al guardar, preparar confirmación para enviar programación de calendario por Gmail a los músicos convocados</span>
              </label>
            </div>
          </div>

          <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-background/95 p-4 backdrop-blur sm:px-7">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="rounded-xl font-bold">
              {saving ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              Guardar ensayo
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 rounded-xl" />
    </div>
  );
}
