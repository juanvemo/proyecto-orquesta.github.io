import { FormEvent, useState } from "react";
import { CalendarClock, Clock3, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { deleteAvailability, saveAvailability } from "./service";
import type { Availability, AvailabilityStatus } from "./types";

const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const statusTone: Record<AvailabilityStatus, string> = { "DISPONIBLE": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", "NO DISPONIBLE": "bg-rose-500/10 text-rose-700 dark:text-rose-400", "TAL VEZ": "bg-amber-500/10 text-amber-700 dark:text-amber-400", "DISPONIBLE CON RESTRICCIONES": "bg-blue-500/10 text-blue-700 dark:text-blue-400" };

export function AvailabilityManager({ organizationId, musicianId, entries, canManage, onChanged }: { organizationId: string; musicianId: string; entries: Availability[]; canManage: boolean; onChanged: () => void }) {
  const [day, setDay] = useState("6");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("23:00");
  const [status, setStatus] = useState<AvailabilityStatus>("DISPONIBLE");
  const [restrictions, setRestrictions] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    try {
      await saveAvailability({ organization_id: organizationId, musician_id: musicianId, kind: "RECURRING", day_of_week: Number(day), specific_date: null, start_time: start || null, end_time: end || null, status, restrictions: restrictions.trim() || null, valid_from: new Date().toISOString().slice(0, 10), valid_until: null });
      setRestrictions(""); toast.success("Disponibilidad agregada"); onChanged();
    } catch (error) { toast.error("No se pudo guardar la disponibilidad", { description: error instanceof Error ? error.message : undefined }); }
    finally { setSaving(false); }
  };
  const remove = async (id: string) => { try { await deleteAvailability(id); toast.success("Horario eliminado"); onChanged(); } catch { toast.error("No se pudo eliminar el horario"); } };

  return <div className="grid gap-5 xl:grid-cols-[1fr_340px]"><Card className="rounded-[2rem] shadow-none"><CardContent className="p-0"><div className="border-b p-5 sm:p-6"><h2 className="text-lg font-black">Disponibilidad recurrente</h2><p className="text-sm text-muted-foreground">Días y horarios habituales informados por el músico.</p></div>{entries.length ? <div className="divide-y">{entries.map((entry) => <div key={entry.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:px-6"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><CalendarClock className="size-5" /></span><div className="min-w-0 flex-1"><p className="font-bold">{entry.kind === "RECURRING" ? days[entry.day_of_week ?? 0] : entry.specific_date}</p><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3" /> {(entry.start_time ?? "Todo el día").slice(0, 5)}{entry.end_time ? ` — ${entry.end_time.slice(0, 5)}` : ""}</p>{entry.restrictions && <p className="mt-1 text-xs text-muted-foreground">{entry.restrictions}</p>}</div><Badge className={`w-fit rounded-lg ${statusTone[entry.status]}`}>{entry.status}</Badge>{canManage && <Button variant="ghost" size="icon" className="rounded-xl text-destructive" onClick={() => void remove(entry.id)}><Trash2 className="size-4" /></Button>}</div>)}</div> : <div className="p-10 text-center"><CalendarClock className="mx-auto size-8 text-primary" /><p className="mt-3 font-bold">Sin disponibilidad registrada</p><p className="text-sm text-muted-foreground">Agrega el primer horario recurrente.</p></div>}</CardContent></Card>{canManage && <Card className="h-fit rounded-[2rem] shadow-none"><CardContent className="p-5 sm:p-6"><h3 className="font-black">Agregar horario</h3><form onSubmit={submit} className="mt-5 space-y-4"><div><Label>Día</Label><Select value={day} onValueChange={setDay}><SelectTrigger className="mt-2 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{days.map((label, index) => <SelectItem key={label} value={String(index)}>{label}</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-2 gap-3"><div><Label>Desde</Label><Input type="time" value={start} onChange={(event) => setStart(event.target.value)} className="mt-2 rounded-xl" /></div><div><Label>Hasta</Label><Input type="time" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-2 rounded-xl" /></div></div><div><Label>Estado</Label><Select value={status} onValueChange={(value: AvailabilityStatus) => setStatus(value)}><SelectTrigger className="mt-2 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{Object.keys(statusTone).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div><div><Label>Restricciones</Label><Textarea value={restrictions} onChange={(event) => setRestrictions(event.target.value)} className="mt-2 rounded-xl" placeholder="Ej. Disponible después de las 7 p. m." /></div><Button type="submit" disabled={saving} className="w-full rounded-xl font-bold"><Plus className="mr-2 size-4" /> Agregar horario</Button></form></CardContent></Card>}</div>;
}
