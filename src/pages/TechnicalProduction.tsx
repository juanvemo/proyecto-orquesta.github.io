import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, FileText, MapPin, Search, Send, SlidersHorizontal, UsersRound } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { RiderEditorDialog } from "@/features/technical/RiderEditorDialog";
import { listTechnicalEvents } from "@/features/technical/service";
import type { RiderContent, TechnicalEvent } from "@/features/technical/types";

export default function TechnicalProduction() {
  const { membership } = useAuth();
  const [params] = useSearchParams();
  const eventFromUrl=params.get("evento");
  const [events, setEvents] = useState<TechnicalEvent[]>([]);
  const [selected, setSelected] = useState<TechnicalEvent | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!membership) return;
    setLoading(true);
    try {
      const rows = await listTechnicalEvents(membership.organizationId);
      setEvents(rows);
      setSelected((current) => rows.find((event) => event.id === (eventFromUrl ?? current?.id)) ?? null);
    } catch (error) { toast.error("No fue posible cargar Producción Técnica", { description: error instanceof Error ? error.message : undefined }); }
    finally { setLoading(false); }
  }, [membership, eventFromUrl]);

  useEffect(() => { void load(); }, [load]);
  const today = new Date().toISOString().slice(0,10);
  const filtered = useMemo(() => events.filter((event) => `${event.name} ${event.venue} ${event.city} ${event.client_name}`.toLowerCase().includes(query.toLowerCase())), [events, query]);
  const upcoming = events.filter((event) => event.event_date >= today && !["REALIZADO","CERRADO"].includes(event.status));

  return <div className="space-y-6 animate-in fade-in duration-300"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.16em] text-primary">Fase 7 · Rider</p><h1 className="mt-2 text-3xl font-black">Producción Técnica</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Stage plot, input list, patch, monitores, energía, contactos y logística vinculados a cada evento.</p></div><Badge className="w-fit rounded-xl bg-primary/10 px-3 py-2 text-primary">{upcoming.length} eventos próximos</Badge></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={CalendarClock} value={upcoming.length} label="Eventos por producir" tone="bg-blue-500/10 text-blue-700" /><Metric icon={FileText} value={events.filter((event) => !event.rider).length} label="Sin rider" tone="bg-amber-500/10 text-amber-700" /><Metric icon={CheckCircle2} value={events.filter((event) => event.rider?.status === "LISTO").length} label="Riders listos" tone="bg-emerald-500/10 text-emerald-700" /><Metric icon={Send} value={events.filter((event) => event.rider?.status === "ENVIADO").length} label="Riders enviados" tone="bg-violet-500/10 text-violet-700" /></div>
    <Card className="rounded-[2rem] shadow-none"><CardContent className="p-5"><div className="relative max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar evento, cliente o lugar…" className="rounded-xl pl-9" /></div></CardContent></Card>
    {loading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1,2,3,4,5,6].map((item) => <Skeleton key={item} className="h-64 rounded-[2rem]" />)}</div> : filtered.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((event) => { const completion=riderCompletion(event.rider?.technical_snapshot);return <Card key={event.id} className="rounded-[2rem] shadow-none"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><SlidersHorizontal className="size-5" /></span><Badge className={`rounded-lg ${event.rider?.status==="ENVIADO"?"bg-violet-500/10 text-violet-700":event.rider?.status==="LISTO"?"bg-emerald-500/10 text-emerald-700":"bg-amber-500/10 text-amber-700"}`}>{event.rider?.status ?? "SIN RIDER"}</Badge></div><h2 className="mt-4 text-lg font-black">{event.name}</h2><p className="text-xs text-muted-foreground">{event.client_name} · {event.event_type}</p><div className="mt-4 space-y-2 text-sm"><p className="flex items-center gap-2"><CalendarClock className="size-4 text-primary" />{formatDate(event.event_date)} · {event.start_time.slice(0,5)}</p><p className="flex items-center gap-2"><MapPin className="size-4 text-primary" />{event.venue}, {event.city}</p><p className="flex items-center gap-2"><UsersRound className="size-4 text-primary" />{event.musicians.length} músicos asignados</p></div><div className="mt-5"><div className="flex justify-between text-xs font-bold"><span>Preparación técnica</span><span>{completion}%</span></div><Progress value={completion} className="mt-2 h-2" /></div><Button onClick={() => setSelected(event)} className="mt-5 w-full rounded-xl font-black">{event.rider ? "Abrir rider" : "Crear rider técnico"}</Button></CardContent></Card>; })}</div> : <Card className="rounded-[2rem] shadow-none"><CardContent className="p-12 text-center"><SlidersHorizontal className="mx-auto size-10 text-primary" /><p className="mt-4 font-black">No hay eventos para producción</p><p className="text-sm text-muted-foreground">Los eventos confirmados y pendientes aparecerán aquí.</p></CardContent></Card>}
    <RiderEditorDialog event={selected} open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} onSaved={() => void load()} />
  </div>;
}

function riderCompletion(snapshot: Record<string, unknown> | undefined) {
  if (!snapshot) return 0;
  const content=snapshot as Partial<RiderContent>;
  const checks=[Boolean(content.general?.summary),Boolean(content.stage_plot?.length),Boolean(content.input_list?.length),Boolean(content.monitor_mixes?.length),Boolean(content.sound?.pa||content.sound?.console),Boolean(content.power?.voltage),Boolean(content.logistics?.soundcheck_time||content.logistics?.access),Boolean(content.contacts?.length)];
  return Math.round(checks.filter(Boolean).length/checks.length*100);
}
function Metric({icon:Icon,value,label,tone}:{icon:typeof CalendarClock;value:number;label:string;tone:string}){return <Card className="rounded-3xl shadow-none"><CardContent className="flex items-center gap-4 p-5"><span className={`grid size-11 place-items-center rounded-2xl ${tone}`}><Icon className="size-5"/></span><div><p className="text-2xl font-black">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>}
function formatDate(value:string){return new Intl.DateTimeFormat("es-CO",{dateStyle:"medium"}).format(new Date(`${value}T12:00:00`))}
