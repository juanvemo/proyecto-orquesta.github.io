import { FormEvent, useCallback, useEffect, useState } from "react";
import { CheckSquare2, Clock3, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Song } from "@/features/repertoire/types";
import { supabase } from "@/integrations/supabase/client";
import { listMusicTasks } from "./service";
import type { MusicTask, RehearsalPlanBlock } from "./types";
import { RehearsalEvaluationPanel } from "./RehearsalEvaluationPanel";

export function RehearsalPlanningPanel({ organizationId, rehearsalId, songs, canManage, userId }: { organizationId: string; rehearsalId: string; songs: Song[]; canManage: boolean; userId: string }) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<MusicTask[]>([]);
  const [blocks, setBlocks] = useState<RehearsalPlanBlock[]>([]);
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [blockObservations, setBlockObservations] = useState("");
  const [songId, setSongId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [minutes, setMinutes] = useState("15");
  const [adding, setAdding] = useState(false);
  const load = useCallback(async () => {
    try {
      const [allTasks, blockResult] = await Promise.all([
        listMusicTasks(organizationId),
        supabase.from("rehearsal_plan_blocks").select("*,song:songs(id,name)").eq("organization_id", organizationId).eq("rehearsal_id", rehearsalId).order("position"),
      ]);
      if (blockResult.error) throw new Error(blockResult.error.message);
      setTasks(allTasks.filter((task) => task.rehearsal_id === rehearsalId));
      setBlocks((blockResult.data ?? []) as unknown as RehearsalPlanBlock[]);
    } catch (error) { toast.error("No se pudo cargar la planificación", { description: error instanceof Error ? error.message : undefined }); }
  }, [organizationId, rehearsalId]);
  useEffect(() => { void load(); }, [load]);
  const addBlock = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || adding || !canManage) return;
    if (!Number.isInteger(Number(minutes)) || Number(minutes) < 1) { toast.error("Ingresa una duración válida en minutos"); return; }
    setAdding(true);
    try {
      const { error } = await supabase.from("rehearsal_plan_blocks").insert({ organization_id: organizationId, rehearsal_id: rehearsalId, song_id: songId || null, title: title.trim(), objective: objective.trim() || null, observations: blockObservations.trim() || null, start_time: startTime || null, estimated_minutes: Number(minutes), position: blocks.length, created_by: userId });
      if (error) throw new Error(error.message);
      setTitle(""); setObjective(""); setBlockObservations(""); setSongId(""); setStartTime("");
      await load();
    } catch (error) { toast.error("No se pudo agregar el bloque", { description: error instanceof Error ? error.message : undefined }); }
    finally { setAdding(false); }
  };
  return <div className="space-y-5"><div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><Card className="rounded-[2rem] shadow-none"><CardContent className="p-0"><div className="flex items-center justify-between border-b p-5"><div><h3 className="font-black">Plan de trabajo</h3><p className="text-xs text-muted-foreground">Agenda musical y tiempo estimado.</p></div><Clock3 className="size-5 text-primary" /></div><div className="divide-y">{blocks.map((block, index) => <div key={block.id} className="flex items-center gap-3 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-xs font-black text-primary">{index + 1}</span><div className="min-w-0 flex-1"><p className="break-words font-bold">{block.title}</p><p className="text-xs text-muted-foreground">{block.start_time?.slice(0, 5) ?? "Sin hora"} · {block.estimated_minutes} min {block.song ? `· ${block.song.name}` : ""}</p>{block.objective && <p className="mt-1 break-words text-xs">{block.objective}</p>}{block.observations && <p className="mt-1 break-words text-xs text-muted-foreground">{block.observations}</p>}</div></div>)}{!blocks.length && <p className="p-8 text-center text-sm text-muted-foreground">Aún no hay bloques planificados.</p>}</div>{canManage && <form onSubmit={addBlock} className="grid gap-3 border-t p-4 sm:grid-cols-2"><div className="sm:col-span-2"><Label>Bloque</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 rounded-xl" placeholder="Ej. Montaje de Llorarás" /></div><div className="sm:col-span-2"><Label>Objetivo</Label><Input value={objective} onChange={(event) => setObjective(event.target.value)} className="mt-2 rounded-xl" /></div><div className="sm:col-span-2"><Label>Observaciones</Label><Textarea value={blockObservations} onChange={(event) => setBlockObservations(event.target.value)} className="mt-2 rounded-xl" /></div><Select value={songId || "NONE"} onValueChange={(value) => setSongId(value === "NONE" ? "" : value)}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Canción" /></SelectTrigger><SelectContent><SelectItem value="NONE">Sin canción</SelectItem>{songs.map((song) => <SelectItem key={song.id} value={song.id}>{song.name}</SelectItem>)}</SelectContent></Select><div className="grid min-w-0 grid-cols-2 gap-2"><Input type="time" aria-label="Hora de inicio del bloque" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="min-w-0 rounded-xl" /><Input type="number" aria-label="Duración en minutos" min="1" step="1" value={minutes} onChange={(event) => setMinutes(event.target.value)} className="rounded-xl" /></div><Button disabled={adding} className="rounded-xl sm:col-span-2"><Plus className="mr-2 size-4" />{adding ? "Guardando…" : "Agregar bloque"}</Button></form>}</CardContent></Card><Card className="rounded-[2rem] shadow-none"><CardContent className="p-0"><div className="flex items-center justify-between border-b p-5"><div><h3 className="font-black">Tareas del ensayo</h3><p className="text-xs text-muted-foreground">Preparación y seguimiento asociados.</p></div>{canManage && <Button size="sm" onClick={() => navigate("/direccion-musical")} className="rounded-xl"><Plus className="mr-1 size-3" />Crear</Button>}</div><div className="divide-y">{tasks.flatMap((task) => task.music_task_assignees.map((assignment) => <div key={assignment.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-center"><p className="break-words font-bold">{assignment.musician.first_name} {assignment.musician.last_name}</p><div><p className="break-words text-sm font-semibold">{task.title}</p><p className="text-xs text-muted-foreground">{task.song?.name ?? "Sin canción"} · {task.work_stage}</p></div><div className="flex flex-wrap gap-2"><Badge variant="outline" className="w-fit rounded-lg text-[9px]">{task.priority}</Badge><Badge className="w-fit rounded-lg text-[9px]">{assignment.status}</Badge></div></div>))}{!tasks.length && <div className="p-8 text-center"><CheckSquare2 className="mx-auto size-7 text-primary" /><p className="mt-3 text-sm font-semibold">Sin tareas asociadas</p></div>}</div></CardContent></Card></div><RehearsalEvaluationPanel organizationId={organizationId} rehearsalId={rehearsalId} canManage={canManage} /></div>;
}
