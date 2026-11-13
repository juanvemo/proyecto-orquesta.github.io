import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, ChevronRight, Clock3, MapPin, Plus, Search, UsersRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { RehearsalFormDialog } from "@/features/rehearsals/RehearsalFormDialog";
import { listRehearsals } from "@/features/rehearsals/service";
import type { Rehearsal } from "@/features/rehearsals/types";
import { listMusicians } from "@/features/musicians/service";
import type { Musician } from "@/features/musicians/types";

const statusTone: Record<string, string> = { PLANIFICADO: "bg-blue-500/10 text-blue-700 dark:text-blue-400", CONFIRMADO: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", "EN CURSO": "bg-violet-500/10 text-violet-700 dark:text-violet-400", FINALIZADO: "bg-slate-500/10 text-slate-700 dark:text-slate-300", CANCELADO: "bg-rose-500/10 text-rose-700 dark:text-rose-400" };

export default function Rehearsals() {
  const { membership, session, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [musicians, setMusicians] = useState<Musician[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const canManage = hasPermission("rehearsals.manage");
  const load = useCallback(async () => { if (!membership) return; setLoading(true); try { const [rows, people] = await Promise.all([listRehearsals(membership.organizationId), listMusicians(membership.organizationId)]); setRehearsals(rows); setMusicians(people); } catch (error) { toast.error("No fue posible cargar los ensayos", { description: error instanceof Error ? error.message : undefined }); } finally { setLoading(false); } }, [membership]);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => rehearsals.filter((item) => `${item.name} ${item.location} ${item.objective}`.toLowerCase().includes(query.toLowerCase()) && (status === "ALL" || item.status === status)), [rehearsals, query, status]);
  const upcoming = rehearsals.filter((item) => item.rehearsal_date >= today() && item.status !== "CANCELADO" && item.status !== "FINALIZADO").length;
  const pending = rehearsals.reduce((sum, item) => sum + item.rehearsal_musicians.filter((call) => call.response_status === "PENDIENTE").length, 0);

  return <div className="space-y-6 animate-in fade-in duration-300"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Operación musical</p><h1 className="mt-2 text-3xl font-black tracking-tight">Ensayos</h1><p className="mt-2 text-sm text-muted-foreground">Planificación, convocatorias, confirmaciones y asistencia.</p></div>{canManage && <Button onClick={() => setFormOpen(true)} className="h-11 rounded-xl px-5 font-bold"><Plus className="mr-2 size-4" /> Nuevo ensayo</Button>}</div><div className="grid gap-4 sm:grid-cols-3"><Metric icon={CalendarClock} value={upcoming} label="Próximos ensayos" tone="bg-primary/10 text-primary" /><Metric icon={UsersRound} value={pending} label="Respuestas pendientes" tone="bg-amber-500/10 text-amber-600" /><Metric icon={CheckCircle2} value={rehearsals.filter((item) => item.status === "FINALIZADO").length} label="Ensayos finalizados" tone="bg-emerald-500/10 text-emerald-600" /></div><Card className="rounded-[2rem] shadow-none"><CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_220px] sm:p-5"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar ensayo, lugar u objetivo…" className="h-11 rounded-xl pl-9" /></div><Select value={status} onValueChange={setStatus}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Todos los estados</SelectItem>{Object.keys(statusTone).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></CardContent></Card>
    {loading ? <div className="space-y-3">{[1,2,3].map((item) => <Skeleton key={item} className="h-36 rounded-[2rem]" />)}</div> : filtered.length ? <div className="space-y-3">{filtered.map((rehearsal) => { const confirmed = rehearsal.rehearsal_musicians.filter((item) => item.response_status === "CONFIRMADO").length; const pendingCount = rehearsal.rehearsal_musicians.filter((item) => item.response_status === "PENDIENTE").length; return <button key={rehearsal.id} onClick={() => navigate(`/ensayos/${rehearsal.id}`)} className="group w-full text-left"><Card className="rounded-[2rem] shadow-none transition-all group-hover:border-primary/30 group-hover:shadow-md"><CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[110px_1fr_auto] lg:items-center"><div className="rounded-2xl bg-primary/10 p-4 text-center text-primary"><p className="text-xs font-bold uppercase">{month(rehearsal.rehearsal_date)}</p><p className="text-3xl font-black">{day(rehearsal.rehearsal_date)}</p></div><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black">{rehearsal.name}</h2><Badge className={`rounded-lg ${statusTone[rehearsal.status]}`}>{rehearsal.status}</Badge></div><p className="mt-2 line-clamp-1 text-sm text-muted-foreground">{rehearsal.objective}</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><Clock3 className="size-3.5" /> {rehearsal.start_time.slice(0,5)} — {rehearsal.end_time.slice(0,5)}</span><span className="flex items-center gap-1.5"><MapPin className="size-3.5" /> {rehearsal.location}</span><span className="flex items-center gap-1.5"><UsersRound className="size-3.5" /> {confirmed} confirmados · {pendingCount} pendientes</span></div></div><ChevronRight className="hidden size-5 text-muted-foreground transition-transform group-hover:translate-x-1 lg:block" /></CardContent></Card></button>; })}</div> : <Card className="rounded-[2rem] shadow-none"><CardContent className="p-12 text-center"><CalendarClock className="mx-auto size-10 text-primary" /><h2 className="mt-4 text-xl font-black">No hay ensayos con estos filtros</h2><p className="mt-2 text-sm text-muted-foreground">Ajusta la búsqueda o crea una nueva sesión.</p></CardContent></Card>}
    {membership && session && <RehearsalFormDialog open={formOpen} onOpenChange={setFormOpen} organizationId={membership.organizationId} userId={session.user.id} musicians={musicians} onSaved={(id) => { void load(); navigate(`/ensayos/${id}`); }} />}
  </div>;
}
function Metric({ icon: Icon, value, label, tone }: { icon: typeof CalendarClock; value: number; label: string; tone: string }) { return <Card className="rounded-3xl shadow-none"><CardContent className="flex items-center gap-4 p-5"><span className={`grid size-11 place-items-center rounded-2xl ${tone}`}><Icon className="size-5" /></span><div><p className="text-2xl font-black">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>; }
function today() { return new Date().toISOString().slice(0, 10); }
function month(value: string) { return new Intl.DateTimeFormat("es-CO", { month: "short" }).format(new Date(`${value}T12:00:00`)).replace(".", ""); }
function day(value: string) { return new Date(`${value}T12:00:00`).getDate(); }
