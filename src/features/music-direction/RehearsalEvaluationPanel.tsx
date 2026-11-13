import { useCallback, useEffect, useRef, useState } from "react";
import { CheckSquare2, History, LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type Report = { achievements: string; problems: string; corrections: string; next_work: string; observations: string };
type Version = { id: string; version: number; created_at: string; report_snapshot: Report };
const emptyReport: Report = { achievements: "", problems: "", corrections: "", next_work: "", observations: "" };
const labels: Record<keyof Report, string> = { achievements: "Qué se logró", problems: "Problemas encontrados", corrections: "Qué debe corregirse", next_work: "Trabajo para el próximo ensayo", observations: "Observaciones" };

export function RehearsalEvaluationPanel({ organizationId, rehearsalId, canManage }: { organizationId: string; rehearsalId: string; canManage: boolean }) {
  const [report, setReport] = useState<Report>(emptyReport);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [current, history] = await Promise.all([
        supabase.from("rehearsal_reports").select("*").eq("organization_id", organizationId).eq("rehearsal_id", rehearsalId).maybeSingle(),
        supabase.from("rehearsal_report_versions").select("id,version,created_at,report_snapshot").eq("organization_id", organizationId).eq("rehearsal_id", rehearsalId).order("version", { ascending: false }),
      ]);
      if (current.error || history.error) throw new Error(current.error?.message ?? history.error?.message);
      const row = current.data;
      setReport(row ? Object.fromEntries(Object.keys(labels).map((key) => [key, row[key] ?? ""])) as Report : emptyReport);
      setUpdatedAt(row?.updated_at ?? null);
      setVersions((history.data ?? []) as unknown as Version[]);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo consultar la evaluación");
    } finally { setLoading(false); }
  }, [organizationId, rehearsalId]);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    if (lock.current || !canManage) return;
    lock.current = true; setBusy(true);
    try {
      const { data, error: failure } = await supabase.rpc("save_rehearsal_report", { target_organization_id: organizationId, target_rehearsal_id: rehearsalId, report_data: report, expected_updated_at: updatedAt });
      if (failure) throw new Error(failure.message);
      setUpdatedAt((data as { updated_at: string }).updated_at);
      toast.success("Evaluación guardada", { description: "Las versiones anteriores se conservan en el historial." });
      await load();
    } catch (failure) { toast.error("No se pudo guardar la evaluación", { description: failure instanceof Error ? failure.message : undefined }); }
    finally { lock.current = false; setBusy(false); }
  };
  const createNextWork = async () => {
    if (lock.current || !canManage || !report.next_work.trim()) return;
    lock.current = true; setBusy(true);
    try {
      const current = await supabase.from("rehearsals").select("rehearsal_date").eq("organization_id", organizationId).eq("id", rehearsalId).single();
      if (current.error) throw new Error(current.error.message);
      const next = await supabase.from("rehearsals").select("id,name").eq("organization_id", organizationId).gt("rehearsal_date", current.data.rehearsal_date).neq("status", "CANCELADO").order("rehearsal_date").order("start_time").limit(1).maybeSingle();
      if (next.error) throw new Error(next.error.message);
      const { error: failure } = await supabase.rpc("create_music_task", { task_data: { organization_id: organizationId, title: "Trabajo para el próximo ensayo", description: report.next_work, assignment_scope: "ALL", rehearsal_id: next.data?.id ?? "", priority: "NORMAL", work_stage: "POSTERIOR", recurrence_type: "NONE", observations: "Generada desde la evaluación posterior del ensayo" }, selected_musician_ids: [] });
      if (failure) throw new Error(failure.message);
      toast.success(next.data ? `Tarea creada para ${next.data.name}` : "Tarea creada sin ensayo relacionado");
    } catch (failure) { toast.error("No se pudo crear la tarea", { description: failure instanceof Error ? failure.message : undefined }); }
    finally { lock.current = false; setBusy(false); }
  };
  if (loading) return <div className="grid min-h-40 place-items-center"><LoaderCircle className="size-6 animate-spin text-primary" /></div>;
  if (error) return <Card className="rounded-3xl"><CardContent className="space-y-3 p-5"><p className="font-bold">No se pudo actualizar la vista de evaluación</p><p className="break-words text-sm text-muted-foreground">{error}</p><Button variant="outline" className="rounded-xl" onClick={() => void load()}>Recargar evaluación e historial</Button></CardContent></Card>;
  return <div className="space-y-5"><Card className="rounded-[2rem] shadow-none"><CardContent className="p-5 sm:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h3 className="font-black">Evaluación después del ensayo</h3><p className="mt-1 text-xs text-muted-foreground">Cada cambio conserva una versión con fecha y responsable.</p></div>{canManage && <Button onClick={() => void save()} disabled={busy} className="rounded-xl font-bold"><Save className="mr-2 size-4" />Guardar evaluación</Button>}</div><div className="mt-5 grid gap-4 sm:grid-cols-2">{(Object.entries(labels) as [keyof Report, string][]).map(([key, label]) => <div key={key} className={key === "observations" ? "sm:col-span-2" : ""}><Label htmlFor={`evaluation-${key}`}>{label}</Label><Textarea id={`evaluation-${key}`} value={report[key]} disabled={!canManage || busy} onChange={(event) => setReport((current) => ({ ...current, [key]: event.target.value }))} className="mt-2 min-h-24 rounded-xl" /></div>)}</div>{canManage && report.next_work && <Button variant="outline" disabled={busy} onClick={() => void createNextWork()} className="mt-4 h-auto whitespace-normal rounded-xl py-3"><CheckSquare2 className="mr-2 size-4 shrink-0" />Crear tarea para el próximo ensayo</Button>}</CardContent></Card><Card className="rounded-[2rem] shadow-none"><CardContent className="p-5 sm:p-6"><h3 className="flex items-center gap-2 font-black"><History className="size-5 text-primary" />Historial de evaluaciones</h3><p className="mt-1 text-xs text-muted-foreground">{versions.length} versiones conservadas. Son de solo lectura.</p><div className="mt-4 space-y-3">{versions.map((version) => <details key={version.id} className="rounded-2xl border p-4"><summary className="cursor-pointer text-sm font-bold">Versión {version.version} · {new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date(version.created_at))}</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">{(Object.entries(labels) as [keyof Report, string][]).map(([key, label]) => <div key={key}><p className="text-xs font-bold text-primary">{label}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{version.report_snapshot[key] || "Sin registrar"}</p></div>)}</div></details>)}{!versions.length && <p className="rounded-2xl bg-muted/40 p-5 text-sm text-muted-foreground">Aún no hay una evaluación guardada.</p>}</div></CardContent></Card></div>;
}
