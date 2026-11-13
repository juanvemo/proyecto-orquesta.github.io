import { FormEvent, useState } from "react";
import { CheckCircle2, History, MessageSquareText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addTaskComment, clearMusicTaskHistory, deleteMusicTask, updateTaskStatus } from "./service";
import type { MusicTask, TaskStatus } from "./types";

export function TaskDetailDialog({ task, open, onOpenChange, userId, canManage, onChanged }: { task: MusicTask | null; open: boolean; onOpenChange: (open: boolean) => void; userId: string; canManage: boolean; onChanged: () => void }) {
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  if (!task) return null;
  const ownAssignment = task.music_task_assignees.find((item) => item.musician.user_id === userId);

  const changeStatus = async (assigneeId: string, status: TaskStatus) => {
    try { await updateTaskStatus(assigneeId, status, comment); toast.success("Estado actualizado"); setComment(""); onChanged(); }
    catch (error) { toast.error("No se pudo actualizar", { description: error instanceof Error ? error.message : undefined }); }
  };

  const submitComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!comment.trim()) return;
    setSaving(true);
    try { await addTaskComment(task.organization_id, task.id, userId, comment); setComment(""); toast.success("Comentario agregado"); onChanged(); }
    catch (error) { toast.error("No se pudo comentar", { description: error instanceof Error ? error.message : undefined }); }
    finally { setSaving(false); }
  };

  const clearHistory = async () => {
    if (!window.confirm("¿Borrar todo el historial visible de esta tarea? La operación quedará registrada en la auditoría administrativa.")) return;
    try { await clearMusicTaskHistory(task.id); toast.success("Historial eliminado"); onChanged(); }
    catch (error) { toast.error("No se pudo borrar el historial", { description: error instanceof Error ? error.message : undefined }); }
  };

  const removeTask = async () => {
    if (!window.confirm(`¿Eliminar definitivamente la tarea “${task.title}”? También se eliminarán sus asignaciones, comentarios e historial.`)) return;
    try { await deleteMusicTask(task.id); toast.success("Tarea eliminada"); onOpenChange(false); onChanged(); }
    catch (error) { toast.error("No se pudo borrar la tarea", { description: error instanceof Error ? error.message : undefined }); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto rounded-[2rem] sm:max-w-3xl"><DialogHeader><div className="flex flex-wrap items-center gap-2"><Badge className="rounded-lg">{task.priority}</Badge><Badge variant="outline" className="rounded-lg">{task.status}</Badge><Badge variant="secondary" className="rounded-lg">{stageLabels[task.work_stage]}</Badge></div><DialogTitle className="mt-2 text-2xl font-black">{task.title}</DialogTitle><DialogDescription>{task.description || "Sin descripción adicional."}</DialogDescription></DialogHeader>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Info label="Fecha límite" value={task.due_at ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(task.due_at)) : "Sin fecha"} /><Info label="Canción" value={task.song?.name || "Sin canción"} /><Info label="Ensayo" value={task.rehearsal?.name || "Sin ensayo"} /><Info label="Evento" value={task.event?.name || "Sin evento"} /></div>
    {task.observations && <div className="mt-5 rounded-2xl bg-primary/5 p-4"><p className="text-xs font-black uppercase tracking-wider text-primary">Observaciones del Director</p><p className="mt-2 text-sm">{task.observations}</p></div>}
    <section className="mt-6"><h3 className="font-black">{canManage ? "Estudiantes asignados" : "Mi asignación"}</h3><div className="mt-3 space-y-2">{task.music_task_assignees.map((assignment) => <div key={assignment.id} className="flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center"><div className="flex flex-1 items-center gap-3">{assignment.musician.photo_url ? <img src={assignment.musician.photo_url} alt="" className="size-10 rounded-xl object-cover" /> : <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-xs font-black text-primary">{assignment.musician.first_name[0]}{assignment.musician.last_name[0]}</span>}<div><p className="font-bold">{assignment.musician.first_name} {assignment.musician.last_name}</p>{assignment.completion_comment && <p className="text-xs text-muted-foreground">“{assignment.completion_comment}”</p>}</div></div>{canManage ? <Select value={assignment.status} onValueChange={(value: TaskStatus) => void changeStatus(assignment.id, value)}><SelectTrigger className="h-9 w-full rounded-xl sm:w-44"><SelectValue /></SelectTrigger><SelectContent>{["PENDIENTE","EN PROGRESO","COMPLETADA","NO COMPLETADA","VENCIDA","CANCELADA"].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select> : <Badge className="w-fit rounded-lg">{assignment.status}</Badge>}</div>)}</div>{!canManage && ownAssignment && (["PENDIENTE","EN PROGRESO","VENCIDA"] as string[]).includes(ownAssignment.status) && <div className="mt-3 flex flex-col gap-2 sm:flex-row">{ownAssignment.status !== "EN PROGRESO" ? <Button variant="outline" onClick={() => void changeStatus(ownAssignment.id, "EN PROGRESO")} className="rounded-xl">Iniciar tarea</Button> : <Button onClick={() => void changeStatus(ownAssignment.id, "COMPLETADA")} className="rounded-xl bg-emerald-600"><CheckCircle2 className="mr-2 size-4" />Marcar como completada</Button>}</div>}</section>
    <section className="mt-6"><div className="flex items-center gap-2"><MessageSquareText className="size-4 text-primary" /><h3 className="font-black">Comentarios</h3></div><div className="mt-3 max-h-44 space-y-2 overflow-y-auto">{task.music_task_comments.length ? [...task.music_task_comments].sort((a,b) => a.created_at.localeCompare(b.created_at)).map((item) => <div key={item.id} className="rounded-xl bg-muted/50 p-3"><p className="text-sm">{item.comment}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at))}</p></div>) : <p className="text-sm text-muted-foreground">Sin comentarios.</p>}</div><form onSubmit={submitComment} className="mt-3 flex gap-2"><Input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Escribe un comentario…" className="rounded-xl" /><Button size="icon" disabled={saving} className="shrink-0 rounded-xl"><MessageSquareText className="size-4" /></Button></form></section>
    <section className="mt-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="flex items-center gap-2"><History className="size-4 text-primary" /><h3 className="font-black">Historial de cambios</h3></div>{canManage && task.music_task_history.length > 0 && <Button variant="outline" size="sm" onClick={() => void clearHistory()} className="rounded-xl text-destructive"><Trash2 className="mr-2 size-4" />Borrar historial</Button>}</div><div className="mt-3 space-y-2">{[...task.music_task_history].sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0,12).map((item) => <div key={item.id} className="flex gap-3 rounded-xl bg-muted/40 p-3"><span className="mt-1 size-2 shrink-0 rounded-full bg-primary" /><div><p className="text-sm font-bold">{historyLabels[item.action] ?? item.action}</p><p className="text-[10px] text-muted-foreground">{new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at))}</p></div></div>)}{!task.music_task_history.length && <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>}</div></section>
    {canManage && <div className="mt-6 flex justify-end border-t pt-4"><Button variant="destructive" onClick={() => void removeTask()} className="rounded-xl"><Trash2 className="mr-2 size-4" />Eliminar tarea</Button></div>}
  </DialogContent></Dialog>;
}

const stageLabels: Record<MusicTask["work_stage"], string> = { GENERAL: "Trabajo general", PREVIA: "Antes del ensayo", DURANTE: "Durante el ensayo", POSTERIOR: "Después del ensayo" };
const historyLabels: Record<string,string> = { CREATED: "Tarea creada", TASK_UPDATED: "Datos de la tarea actualizados", STATUS_CHANGED: "Estado actualizado", COMMENT_ADDED: "Comentario agregado" };
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>; }
