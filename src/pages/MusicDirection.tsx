import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, CheckSquare2, GraduationCap, Music2, Plus, Search, UsersRound } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { expandRecurringTasks, listMusicTasks } from "@/features/music-direction/service";
import { TaskDetailDialog } from "@/features/music-direction/TaskDetailDialog";
import { TaskFormDialog } from "@/features/music-direction/TaskFormDialog";
import type { MusicTask, TaskStatus } from "@/features/music-direction/types";
import { getMusicianCatalogs, listMusicians } from "@/features/musicians/service";
import type { Instrument, Musician } from "@/features/musicians/types";
import { listRehearsals } from "@/features/rehearsals/service";
import type { Rehearsal } from "@/features/rehearsals/types";
import { loadRepertoire } from "@/features/repertoire/service";
import type { Song } from "@/features/repertoire/types";
import { supabase } from "@/integrations/supabase/client";

type EventRef = { id: string; name: string; event_date: string; status: string };
type Template = { id: string; title: string; description: string | null; default_priority: "BAJA" | "NORMAL" | "ALTA" | "URGENTE" };
const statuses: TaskStatus[] = ["PENDIENTE", "EN PROGRESO", "COMPLETADA", "VENCIDA", "NO COMPLETADA", "CANCELADA"];

export default function MusicDirection() {
  const { membership, session } = useAuth();
  const organizationId = membership?.organizationId;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const taskFromUrl = searchParams.get("tarea");
  const [tasks, setTasks] = useState<MusicTask[]>([]);
  const [musicians, setMusicians] = useState<Musician[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [events, setEvents] = useState<EventRef[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [planned, setPlanned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<MusicTask | null>(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ musician: "ALL", instrument: "ALL", song: "ALL", rehearsal: "ALL", priority: "ALL", date: "" });
  const [templateTitle, setTemplateTitle] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true); setLoadError(null);
    try {
      await expandRecurringTasks(organizationId);
      const [taskRows, people, catalogs, repertoire, rehearsalRows, eventResult, templateResult, plans] = await Promise.all([
        listMusicTasks(organizationId), listMusicians(organizationId), getMusicianCatalogs(organizationId), loadRepertoire(organizationId), listRehearsals(organizationId),
        supabase.rpc("get_music_task_event_references", { target_organization_id: organizationId }),
        supabase.from("music_task_templates").select("id,title,description,default_priority").eq("organization_id", organizationId).eq("is_active", true).order("title"),
        supabase.from("rehearsal_plan_blocks").select("rehearsal_id").eq("organization_id", organizationId),
      ]);
      if (eventResult.error || templateResult.error || plans.error) throw new Error(eventResult.error?.message ?? templateResult.error?.message ?? plans.error?.message);
      setTasks(taskRows); setMusicians(people); setInstruments(catalogs.instruments); setSongs(repertoire.songs); setRehearsals(rehearsalRows);
      setEvents((eventResult.data ?? []) as EventRef[]); setTemplates((templateResult.data ?? []) as Template[]);
      setPlanned(new Set((plans.data ?? []).map((item) => item.rehearsal_id)));
      setSelected((current) => taskRows.find((task) => task.id === (taskFromUrl ?? current?.id)) ?? null);
    } catch (error) { setLoadError(error instanceof Error ? error.message : error && typeof error === "object" && "message" in error ? String(error.message) : "No se pudo consultar el servidor"); }
    finally { setLoading(false); }
  }, [organizationId, taskFromUrl]);
  useEffect(() => { void load(); }, [load]);
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const status = (task: MusicTask): TaskStatus => task.due_at && new Date(task.due_at) < now && ["PENDIENTE", "EN PROGRESO"].includes(task.status) ? "VENCIDA" : task.status;
  const dateKey = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  const filtered = useMemo(() => tasks.filter((task) => `${task.title} ${task.description ?? ""} ${task.song?.name ?? ""}`.toLowerCase().includes(query.toLowerCase())
    && (filters.musician === "ALL" || task.music_task_assignees.some((item) => item.musician_id === filters.musician))
    && (filters.instrument === "ALL" || task.instrument_id === filters.instrument)
    && (filters.song === "ALL" || task.song_id === filters.song)
    && (filters.rehearsal === "ALL" || task.rehearsal_id === filters.rehearsal)
    && (filters.priority === "ALL" || task.priority === filters.priority)
    && (!filters.date || Boolean(task.due_at && dateKey(task.due_at) === filters.date))), [tasks, query, filters]);
  const nextRehearsal = rehearsals.filter((item) => item.rehearsal_date >= today && !["CANCELADO", "FINALIZADO"].includes(item.status)).sort((a, b) => `${a.rehearsal_date}${a.start_time}`.localeCompare(`${b.rehearsal_date}${b.start_time}`))[0];
  const preparationTasks = tasks.filter((task) => task.rehearsal_id === nextRehearsal?.id && ["GENERAL", "PREVIA"].includes(task.work_stage) && task.status !== "CANCELADA");
  const preparationAssignments = preparationTasks.flatMap((task) => task.music_task_assignees).filter((item) => item.status !== "CANCELADA");
  const completed = preparationAssignments.filter((item) => item.status === "COMPLETADA").length;
  const preparation = preparationAssignments.length ? Math.round(completed / preparationAssignments.length * 100) : 0;
  const pendingInvites = nextRehearsal?.rehearsal_musicians.filter((item) => item.response_status === "PENDIENTE").length ?? 0;
  const unavailableInvites = nextRehearsal?.rehearsal_musicians.filter((item) => item.response_status === "NO PUEDO ASISTIR").length ?? 0;
  const overdue = tasks.filter((task) => status(task) === "VENCIDA").length;
  const openTasks = tasks.filter((task) => !["COMPLETADA", "CANCELADA", "NO COMPLETADA"].includes(status(task)));
  const dueToday = openTasks.filter((task) => task.due_at && dateKey(task.due_at) === today).length;
  const upcomingTasks = openTasks.filter((task) => task.due_at && dateKey(task.due_at) > today).length;
  const nextEvent = events.filter((event) => event.event_date >= today && !["CANCELADO", "CERRADO", "REALIZADO"].includes(event.status)).sort((a, b) => a.event_date.localeCompare(b.event_date))[0];
  const songProgress = songs.map((song) => {
    const related = tasks.filter((task) => task.song_id === song.id && task.status !== "CANCELADA");
    const assignments = related.flatMap((task) => task.music_task_assignees).filter((item) => item.status !== "CANCELADA");
    const done = assignments.filter((item) => item.status === "COMPLETADA").length;
    const byInstrument = new Map<string, { total: number; done: number }>();
    related.forEach((task) => task.music_task_assignees.filter((item) => item.status !== "CANCELADA").forEach((item) => {
      const name = task.instrument?.name ?? item.musician.musician_instruments.find((entry) => entry.is_primary)?.instrument?.name ?? item.musician.specialty ?? "General";
      const counts = byInstrument.get(name) ?? { total: 0, done: 0 };
      counts.total++; if (item.status === "COMPLETADA") counts.done++; byInstrument.set(name, counts);
    }));
    return { song, total: assignments.length, done, percentage: assignments.length ? Math.round(done / assignments.length * 100) : 0, byInstrument: [...byInstrument].map(([name, counts]) => ({ name, percentage: Math.round(counts.done / counts.total * 100) })) };
  }).filter((item) => item.total > 0).sort((a, b) => b.total - a.total);
  const saveTemplate = async () => {
    if (!organizationId || !session || !templateTitle.trim() || savingTemplate) return;
    setSavingTemplate(true);
    const { error } = await supabase.from("music_task_templates").insert({ organization_id: organizationId, title: templateTitle.trim(), default_priority: "NORMAL", created_by: session.user.id });
    if (error) toast.error("No se pudo crear la plantilla", { description: error.message });
    else { setTemplateTitle(""); toast.success("Plantilla creada"); await load(); }
    setSavingTemplate(false);
  };
  if (loading && !tasks.length && !loadError) return <div className="space-y-5"><Skeleton className="h-32 rounded-[2rem]" /><Skeleton className="h-[500px] rounded-[2rem]" /></div>;
  if (loadError) return <Card className="rounded-[2rem] border-orange-200"><CardContent className="space-y-4 p-6"><AlertTriangle className="size-7 text-orange-600" /><h1 className="text-xl font-black">No se pudo cargar Dirección Musical</h1><p className="break-words text-sm text-muted-foreground">{loadError}</p><p className="text-sm">No se muestran indicadores vacíos como si fueran resultados reales.</p><Button onClick={() => void load()} className="rounded-xl">Volver a consultar</Button></CardContent></Card>;
  const filterOptions = [
    { key: "musician" as const, label: "Todos los estudiantes", options: musicians.map((item) => ({ id: item.id, name: `${item.first_name} ${item.last_name}` })) },
    { key: "instrument" as const, label: "Instrumentos", options: instruments.filter((item) => item.is_active) },
    { key: "song" as const, label: "Canciones", options: songs },
    { key: "rehearsal" as const, label: "Ensayos", options: rehearsals },
    { key: "priority" as const, label: "Prioridades", options: ["BAJA", "NORMAL", "ALTA", "URGENTE"].map((value) => ({ id: value, name: value })) },
  ];
  return <div className="space-y-6 animate-in fade-in duration-300"><header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.16em] text-primary">Dirección y seguimiento</p><h1 className="mt-2 text-3xl font-black">Dirección Musical</h1><p className="mt-2 text-sm text-muted-foreground">Planifica, evalúa ensayos y sigue la preparación de tus músicos.</p></div><div className="flex flex-col gap-2 sm:flex-row"><Button variant="outline" onClick={() => navigate("/ensayos")} className="h-11 rounded-xl font-bold"><CalendarClock className="mr-2 size-4" />Crear ensayo</Button><Button onClick={() => setFormOpen(true)} className="h-11 rounded-xl font-black"><Plus className="mr-2 size-4" />Nueva tarea</Button></div></header>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={CheckSquare2} label="Tareas pendientes" value={openTasks.length} note={`${overdue} vencidas · ${dueToday} hoy · ${upcomingTasks} próximas`} /><Metric icon={Music2} label="Canciones en montaje" value={songs.filter((song) => song.status === "EN MONTAJE").length} note={`${songs.filter((song) => song.status === "EN REPERTORIO").length} en repertorio`} /><Metric icon={UsersRound} label="Confirmación próxima" value={nextRehearsal?.rehearsal_musicians.filter((item) => item.response_status === "CONFIRMADO").length ?? 0} note={`${pendingInvites} pendientes · ${unavailableInvites} no disponibles`} /><Metric icon={CheckCircle2} label="Preparación del ensayo" value={preparation} suffix="%" note={`${completed}/${preparationAssignments.length} asignaciones previas listas`} /></div>
    <Card className="rounded-[2rem] border-primary/20 bg-primary/5 shadow-none"><CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_280px]"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-primary"><CalendarClock className="size-4" />Próximo ensayo</p>{nextRehearsal ? <><h2 className="mt-3 text-xl font-black">{nextRehearsal.name}</h2><p className="mt-1 text-sm text-muted-foreground">{date(nextRehearsal.rehearsal_date)} · {nextRehearsal.start_time.slice(0, 5)} · {nextRehearsal.location}</p><p className="mt-3 text-sm">Objetivo: {nextRehearsal.objective}</p><Button variant="outline" onClick={() => navigate(`/ensayos/${nextRehearsal.id}`)} className="mt-4 rounded-xl">Abrir plan y evaluación</Button></> : <p className="mt-4 font-bold">No hay un próximo ensayo planificado</p>}</div><div className="min-w-0"><div className="flex justify-between text-xs font-bold"><span>Preparación previa</span><span>{preparation}%</span></div><Progress value={preparation} className="mt-3 h-3" /><p className="mt-2 text-xs text-muted-foreground">No incluye tareas posteriores ni canceladas.</p></div></CardContent></Card>
    <Card className="rounded-[2rem] shadow-none"><CardContent className="p-5"><h2 className="flex items-center gap-2 font-black"><AlertTriangle className="size-5 text-orange-600" />Alertas de preparación</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Tareas vencidas", value: overdue }, { label: "Sin confirmar ensayo", value: pendingInvites }, { label: "Tareas de canciones pendientes", value: openTasks.filter((task) => task.song_id).length }, { label: "Próximo ensayo sin planificación", value: nextRehearsal && !planned.has(nextRehearsal.id) ? 1 : 0 }].map((item) => <div key={item.label} className="rounded-2xl bg-orange-500/10 p-4 text-orange-800"><p className="text-2xl font-black">{item.value}</p><p className="text-xs font-bold">{item.label}</p></div>)}</div></CardContent></Card>
    <Card className="rounded-[2rem] shadow-none"><CardContent className="p-5"><h2 className="flex items-center gap-2 font-black"><GraduationCap className="size-5 text-primary" />Mis estudiantes</h2><p className="mt-1 text-xs text-muted-foreground">Seguimiento de músicos activos; las fichas retiradas no se convocan de nuevo.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{musicians.filter((item) => item.status === "ACTIVO").map((student) => { const assignments = tasks.flatMap((task) => task.music_task_assignees).filter((item) => item.musician_id === student.id && item.status !== "CANCELADA"); const done = assignments.filter((item) => item.status === "COMPLETADA").length; const percentage = assignments.length ? Math.round(done / assignments.length * 100) : 0; return <button key={student.id} onClick={() => navigate(`/musicos/${student.id}`)} className="flex items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-primary/30 hover:bg-primary/5">{student.photo_url ? <img src={student.photo_url} alt="" className="size-11 rounded-xl object-cover" /> : <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-black text-primary">{student.first_name[0]}{student.last_name[0]}</span>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{student.first_name} {student.last_name}</p><p className="truncate text-xs text-muted-foreground">{student.specialty || "Estudiante de la orquesta"}</p><div className="mt-2 flex items-center gap-2"><Progress value={percentage} className="h-1.5" /><span className="text-[10px] font-black">{percentage}%</span></div></div></button>; })}</div></CardContent></Card>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tarea…" className="rounded-xl pl-9" /></div>{filterOptions.map((item) => <Select key={item.key} value={filters[item.key]} onValueChange={(value) => setFilters((current) => ({ ...current, [item.key]: value }))}><SelectTrigger className="min-w-0 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">{item.label}</SelectItem>{item.options.map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent></Select>)}<Input type="date" value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))} className="min-w-0 rounded-xl" aria-label="Fecha límite en Colombia" /></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{statuses.map((column) => <section key={column} className="min-w-0 rounded-3xl bg-muted/40 p-3"><div className="flex items-center justify-between gap-2 px-1 py-2"><h2 className="text-sm font-black">{column}</h2><Badge variant="outline" className="rounded-lg">{filtered.filter((task) => status(task) === column).length}</Badge></div><div className="mt-2 space-y-3">{filtered.filter((task) => status(task) === column).map((task) => <button key={task.id} onClick={() => setSelected(task)} className="w-full rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/40"><div className="flex items-start justify-between gap-2"><p className="min-w-0 break-words font-black">{task.title}</p><Badge className="shrink-0 rounded-lg bg-primary/10 text-[9px] text-primary">{task.priority}</Badge></div><p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{task.description || "Sin descripción"}</p><div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground">{task.song && <span>♪ {task.song.name}</span>}{task.rehearsal && <span>● {task.rehearsal.name}</span>}</div><div className="mt-3 flex justify-between gap-2 text-[10px] font-bold"><span>{task.due_at ? dateTime(task.due_at) : "Sin fecha límite"}</span><span>{task.music_task_assignees.length} músicos</span></div></button>)}{!filtered.some((task) => status(task) === column) && <p className="rounded-2xl border border-dashed p-5 text-center text-xs text-muted-foreground">Sin tareas</p>}</div></section>)}</div>
    <div className="grid gap-5 lg:grid-cols-2"><Card className="rounded-[2rem] shadow-none"><CardContent className="p-5"><h2 className="font-black">Preparación por canción</h2><div className="mt-4 space-y-4">{songProgress.slice(0, 6).map((item) => <div key={item.song.id}><div className="flex justify-between gap-3 text-sm"><span className="truncate font-bold">{item.song.name}</span><span className="font-black">{item.percentage}%</span></div><Progress value={item.percentage} className="mt-2 h-2" /><p className="mt-1 text-[10px] text-muted-foreground">{item.done} de {item.total} asignaciones completadas</p><div className="mt-2 flex flex-wrap gap-1">{item.byInstrument.map((instrument) => <Badge key={instrument.name} variant="outline" className="rounded-md text-[9px]">{instrument.name} {instrument.percentage}%</Badge>)}</div></div>)}{!songProgress.length && <p className="text-sm text-muted-foreground">Asocia tareas a canciones para medir su preparación.</p>}</div></CardContent></Card><Card className="rounded-[2rem] shadow-none"><CardContent className="p-5"><h2 className="font-black">Plantillas frecuentes</h2><div className="mt-4 flex gap-2"><Input value={templateTitle} onChange={(event) => setTemplateTitle(event.target.value)} placeholder="Ej. Practicar con metrónomo" className="rounded-xl" /><Button onClick={() => void saveTemplate()} disabled={!templateTitle.trim() || savingTemplate} className="rounded-xl"><Plus className="size-4" /><span className="sr-only">Crear plantilla</span></Button></div><div className="mt-4 flex flex-wrap gap-2">{templates.map((template) => <Badge key={template.id} variant="secondary" className="rounded-xl px-3 py-2">{template.title}</Badge>)}</div>{nextEvent && <div className="mt-5 rounded-2xl bg-primary/5 p-4"><p className="text-xs font-black uppercase text-primary">Próximo evento musical</p><p className="mt-2 font-black">{nextEvent.name}</p><p className="text-xs text-muted-foreground">{date(nextEvent.event_date)} · {nextEvent.status}</p></div>}</CardContent></Card></div>
    <Card className="rounded-[2rem] shadow-none"><CardContent className="p-5"><h2 className="font-black">Ensayos y evaluaciones</h2><p className="mt-1 text-xs text-muted-foreground">Abre un ensayo y consulta la pestaña Plan y tareas para evaluar y revisar versiones.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{[...rehearsals].sort((a, b) => b.rehearsal_date.localeCompare(a.rehearsal_date)).map((rehearsal) => <button key={rehearsal.id} onClick={() => navigate(`/ensayos/${rehearsal.id}`)} className="rounded-2xl border p-4 text-left hover:bg-primary/5"><p className="font-bold">{rehearsal.name}</p><p className="mt-1 text-xs text-muted-foreground">{date(rehearsal.rehearsal_date)} · {rehearsal.status}</p></button>)}</div></CardContent></Card>
    {organizationId && <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} organizationId={organizationId} musicians={musicians} instruments={instruments} songs={songs} rehearsals={rehearsals} events={events} templates={templates} onSaved={() => void load()} />}<TaskDetailDialog task={selected} open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} userId={session?.user.id ?? ""} canManage onChanged={() => void load()} />
  </div>;
}
function Metric({ icon: Icon, label, value, note, suffix = "" }: { icon: typeof CheckSquare2; label: string; value: number; note: string; suffix?: string }) { return <Card className="rounded-3xl shadow-none"><CardContent className="flex items-center gap-4 p-5"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-5" /></span><div className="min-w-0"><p className="text-2xl font-black">{value}{suffix}</p><p className="text-sm font-bold">{label}</p><p className="text-xs text-muted-foreground">{note}</p></div></CardContent></Card>; }
function date(value: string) { return new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" }).format(new Date(`${value}T12:00:00-05:00`)); }
function dateTime(value: string) { return new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date(value)); }
