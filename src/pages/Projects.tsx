import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  FolderKanban,
  LoaderCircle,
  MessageSquare,
  Plus,
  Send,
  Target,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  addProjectTaskComment,
  deleteProjectTask,
  listOrgMembersForProjects,
  listProjects,
  saveProject,
  saveProjectTask,
} from "@/features/projects/service";
import type {
  OrchestraProject,
  ProjectObjective,
  ProjectPriority,
  ProjectStatus,
  ProjectTask,
  ProjectTaskStatus,
} from "@/features/projects/types";

const PROJECT_CATEGORIES = ["Vestuario e Imagen", "Producción Musical", "Infraestructura y Sonido", "Comercial", "Organizacional", "Otro"];

export default function Projects() {
  const { membership, session, user, hasPermission } = useAuth();
  const canManage = hasPermission("projects.manage");

  const [projects, setProjects] = useState<OrchestraProject[]>([]);
  const [members, setMembers] = useState<Array<{ userId: string; name: string }>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<OrchestraProject | null>(null);
  const [pName, setPName] = useState("");
  const [pCategory, setPCategory] = useState("Operativo");
  const [pDesc, setPDesc] = useState("");
  const [pStatus, setPStatus] = useState<ProjectStatus>("EN CURSO");
  const [pPriority, setPPriority] = useState<ProjectPriority>("ALTA");
  const [pOwner, setPOwner] = useState("");
  const [pStart, setPStart] = useState("");
  const [pTarget, setPTarget] = useState("");
  const [pBudget, setPBudget] = useState(0);
  const [pObjectives, setPObjectives] = useState<ProjectObjective[]>([]);

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [tTitle, setTTitle] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tPriority, setTPriority] = useState<ProjectPriority>("MEDIA");
  const [tAssigneeId, setTAssigneeId] = useState("none");
  const [tDueDate, setTDueDate] = useState("");

  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!membership) return;
    setLoading(true);
    try {
      const [rows, memberList] = await Promise.all([
        listProjects(membership.organizationId),
        listOrgMembersForProjects(membership.organizationId),
      ]);
      setProjects(rows);
      setMembers(memberList);
      setSelectedId((prev) => (prev && rows.some((p) => p.id === prev) ? prev : rows[0]?.id ?? null));
    } catch (error) {
      toast.error("No fue posible cargar los proyectos", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [membership]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => projects.find((p) => p.id === selectedId) ?? null, [projects, selectedId]);

  const openNewProject = () => {
    setEditingProject(null);
    setPName("");
    setPCategory("Vestuario e Imagen");
    setPDesc("");
    setPStatus("EN CURSO");
    setPPriority("ALTA");
    setPOwner(user?.name ?? "");
    setPStart(new Date().toISOString().slice(0, 10));
    setPTarget("");
    setPBudget(0);
    setPObjectives([{ id: crypto.randomUUID(), title: "", metric: "", achieved: false }]);
    setProjectDialogOpen(true);
  };

  const openEditProject = (proj: OrchestraProject) => {
    setEditingProject(proj);
    setPName(proj.name);
    setPCategory(proj.category);
    setPDesc(proj.description ?? "");
    setPStatus(proj.status);
    setPPriority(proj.priority);
    setPOwner(proj.owner_name ?? "");
    setPStart(proj.start_date ?? "");
    setPTarget(proj.target_date ?? "");
    setPBudget(proj.budget);
    setPObjectives(proj.objectives.length ? proj.objectives : [{ id: crypto.randomUUID(), title: "", metric: "", achieved: false }]);
    setProjectDialogOpen(true);
  };

  const handleSaveProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!membership || !session || !pName.trim()) return;
    setSaving(true);
    try {
      const saved = await saveProject(membership.organizationId, session.user.id, {
        id: editingProject?.id,
        name: pName,
        category: pCategory,
        description: pDesc,
        status: pStatus,
        priority: pPriority,
        owner_name: pOwner,
        start_date: pStart || null,
        target_date: pTarget || null,
        budget: pBudget,
        objectives: pObjectives.filter((o) => o.title.trim()),
        tasks: editingProject?.tasks ?? [],
      });
      toast.success(editingProject ? "Proyecto actualizado" : "Proyecto creado");
      setProjectDialogOpen(false);
      await load();
      setSelectedId(saved.id);
    } catch (error) {
      toast.error("Error al guardar proyecto", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!membership || !session || !selected || !tTitle.trim()) return;
    setSaving(true);
    try {
      const assignee = members.find((m) => m.userId === tAssigneeId);
      await saveProjectTask(membership.organizationId, session.user.id, selected.id, {
        title: tTitle,
        description: tDesc,
        priority: tPriority,
        status: "PENDIENTE",
        assignee_user_id: assignee?.userId ?? null,
        assignee_name: assignee?.name ?? null,
        due_date: tDueDate || null,
        progress: 0,
      });
      toast.success("Tarea agregada al proyecto");
      setTaskDialogOpen(false);
      setTTitle("");
      setTDesc("");
      setTDueDate("");
      setTAssigneeId("none");
      await load();
    } catch (error) {
      toast.error("No fue posible crear la tarea", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleObjective = async (proj: OrchestraProject, objId: string) => {
    if (!membership || !session) return;
    const nextObjectives = proj.objectives.map((o) => (o.id === objId ? { ...o, achieved: !o.achieved } : o));
    await saveProject(membership.organizationId, session.user.id, {
      ...proj,
      objectives: nextObjectives,
    });
    void load();
  };

  const updateTaskStatus = async (task: ProjectTask, nextStatus: ProjectTaskStatus) => {
    if (!membership || !session) return;
    await saveProjectTask(membership.organizationId, session.user.id, task.project_id, {
      ...task,
      status: nextStatus,
      progress: nextStatus === "COMPLETADA" ? 100 : nextStatus === "EN PROGRESO" ? 50 : 0,
    });
    toast.success(`Tarea marcada como ${nextStatus.toLowerCase()}`);
    void load();
  };

  const sendComment = async (task: ProjectTask) => {
    if (!membership || !session) return;
    const text = (commentDrafts[task.id] ?? "").trim();
    if (!text) return;
    await addProjectTaskComment(
      membership.organizationId,
      task.project_id,
      task.id,
      session.user.id,
      user?.name || session.user.email || "Usuario",
      text,
    );
    setCommentDrafts((prev) => ({ ...prev, [task.id]: "" }));
    toast.success("Comentario publicado");
    void load();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-primary">Gestión Organizacional</p>
          <h1 className="mt-2 text-3xl font-black">Proyectos, Objetivos y Tareas</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Planifica iniciativas estratégicas y operativas de la orquesta (vestuario, producción de sencillos, adquisiciones, giras) con metas medibles y seguimiento colaborativo.
          </p>
        </div>
        {canManage && (
          <Button onClick={openNewProject} className="h-11 rounded-2xl font-black">
            <Plus className="mr-2 size-4" />
            Nuevo proyecto
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
          <Skeleton className="h-96 rounded-[2rem]" />
          <Skeleton className="h-96 rounded-[2rem]" />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
          {/* Sidebar list */}
          <Card className="h-fit rounded-[2rem] shadow-none">
            <CardContent className="space-y-3 p-4">
              <p className="px-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
                Proyectos activos ({projects.length})
              </p>
              {projects.map((proj) => {
                const completedTasks = proj.tasks.filter((t) => t.status === "COMPLETADA").length;
                const progress = proj.tasks.length ? Math.round((completedTasks / proj.tasks.length) * 100) : 0;
                const active = proj.id === selected?.id;
                return (
                  <button
                    key={proj.id}
                    onClick={() => setSelectedId(proj.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      active ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="rounded-lg text-[10px]">{proj.category}</Badge>
                      <Badge className="rounded-lg text-[10px]">{proj.status}</Badge>
                    </div>
                    <p className="mt-2 font-black">{proj.name}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{completedTasks}/{proj.tasks.length} tareas</span>
                      <span className="font-bold text-primary">{progress}%</span>
                    </div>
                    <Progress value={progress} className="mt-1.5 h-1.5" />
                  </button>
                );
              })}
              {!projects.length && (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  <FolderKanban className="mx-auto size-9 text-primary" />
                  <p className="mt-3 font-bold">Sin proyectos creados</p>
                  <p className="mt-1 text-xs">Ej. “Dotación de camisas”, “Producción de tema nuevo”.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detail panel */}
          {selected ? (
            <div className="space-y-5">
              <Card className="rounded-[2rem] shadow-none">
                <CardContent className="space-y-5 p-6">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="rounded-lg">{selected.status}</Badge>
                        <Badge variant="outline" className="rounded-lg">{selected.category}</Badge>
                        <Badge variant="secondary" className="rounded-lg">Prioridad {selected.priority}</Badge>
                      </div>
                      <h2 className="mt-3 text-2xl font-black">{selected.name}</h2>
                      {selected.description && <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>}
                    </div>
                    {canManage && (
                      <Button variant="outline" size="sm" onClick={() => openEditProject(selected)} className="rounded-xl">
                        Editar proyecto
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-3 rounded-2xl bg-muted/40 p-4 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Líder responsable</p>
                      <p className="font-bold">{selected.owner_name || "Sin definir"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Fecha objetivo</p>
                      <p className="font-bold">{selected.target_date || "Sin fecha"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Presupuesto estimado</p>
                      <p className="font-black text-primary">
                        {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(selected.budget || 0)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <Target className="size-4 text-primary" />
                      <h3 className="font-black">Objetivos y metas medibles ({selected.objectives.filter((o) => o.achieved).length}/{selected.objectives.length})</h3>
                    </div>
                    <div className="mt-3 space-y-2">
                      {selected.objectives.map((obj) => (
                        <label key={obj.id} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 hover:bg-muted/30">
                          <Checkbox
                            checked={obj.achieved}
                            onCheckedChange={() => void toggleObjective(selected, obj.id)}
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-bold ${obj.achieved ? "line-through text-muted-foreground" : ""}`}>
                              {obj.title}
                            </p>
                            {obj.metric && <p className="text-xs text-muted-foreground">Indicador: {obj.metric}</p>}
                          </div>
                        </label>
                      ))}
                      {!selected.objectives.length && (
                        <p className="text-xs text-muted-foreground">Edita el proyecto para definir objetivos clave.</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[2rem] shadow-none">
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-black">Tareas del proyecto ({selected.tasks.length})</h3>
                    <Button size="sm" onClick={() => setTaskDialogOpen(true)} className="rounded-xl font-bold">
                      <Plus className="mr-1.5 size-4" />
                      Nueva tarea
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {selected.tasks.map((task) => (
                      <div key={task.id} className="space-y-3 rounded-2xl border p-4">
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-black">{task.title}</span>
                              <Badge variant="outline" className="rounded-lg text-[10px]">{task.priority}</Badge>
                            </div>
                            {task.description && <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>}
                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <UserRound className="size-3.5 text-primary" />
                                {task.assignee_name || "Sin responsable"}
                              </span>
                              {task.due_date && <span>Vence: {task.due_date}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Select value={task.status} onValueChange={(v) => void updateTaskStatus(task, v as ProjectTaskStatus)}>
                              <SelectTrigger className="h-9 w-36 rounded-xl text-xs font-bold">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                                <SelectItem value="EN PROGRESO">En progreso</SelectItem>
                                <SelectItem value="COMPLETADA">Completada</SelectItem>
                                <SelectItem value="BLOQUEADA">Bloqueada</SelectItem>
                              </SelectContent>
                            </Select>
                            {canManage && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 rounded-lg text-destructive"
                                onClick={async () => {
                                  if (!membership) return;
                                  await deleteProjectTask(membership.organizationId, selected.id, task.id);
                                  toast.success("Tarea eliminada");
                                  void load();
                                }}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Comments with author & timestamp */}
                        <div className="rounded-xl bg-muted/40 p-3">
                          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase text-muted-foreground">
                            <MessageSquare className="size-3.5 text-primary" />
                            Comentarios ({task.comments.length})
                          </p>
                          <div className="space-y-2">
                            {task.comments.map((c) => (
                              <div key={c.id} className="rounded-xl border bg-background px-3 py-2 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-black text-primary">{c.author_name}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(c.created_at))}
                                  </span>
                                </div>
                                <p className="mt-1 whitespace-pre-wrap">{c.comment}</p>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 flex gap-2">
                            <Input
                              value={commentDrafts[task.id] ?? ""}
                              onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))}
                              placeholder="Escribe una actualización o comentario…"
                              className="h-9 rounded-xl bg-background text-xs"
                            />
                            <Button type="button" size="sm" onClick={() => void sendComment(task)} className="h-9 rounded-xl">
                              <Send className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!selected.tasks.length && (
                      <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                        <CheckCircle2 className="mx-auto size-8 text-primary" />
                        <p className="mt-2 font-bold">Sin tareas registradas en este proyecto</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="rounded-[2rem] shadow-none">
              <CardContent className="p-12 text-center">
                <FolderKanban className="mx-auto size-11 text-primary" />
                <p className="mt-3 text-lg font-black">Crea tu primer proyecto</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Organiza objetivos y tareas clave como dotación de uniformes, grabación de canciones o compras técnicas.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Project Dialog */}
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[2rem] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">
              {editingProject ? "Editar proyecto" : "Nuevo proyecto organizacional"}
            </DialogTitle>
            <DialogDescription>Define metas claras, responsable y presupuesto estimado.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveProject} className="mt-2 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Nombre del proyecto</Label>
                <Input value={pName} onChange={(e) => setPName(e.target.value)} required placeholder="Ej. Mandar a hacer camisas oficiales" className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Categoría</Label>
                <Select value={pCategory} onValueChange={setPCategory}>
                  <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={pStatus} onValueChange={(v) => setPStatus(v as ProjectStatus)}>
                  <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLANIFICADO">Planificado</SelectItem>
                    <SelectItem value="EN CURSO">En curso</SelectItem>
                    <SelectItem value="EN PAUSA">En pausa</SelectItem>
                    <SelectItem value="COMPLETADO">Completado</SelectItem>
                    <SelectItem value="CANCELADO">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridad</Label>
                <Select value={pPriority} onValueChange={(v) => setPPriority(v as ProjectPriority)}>
                  <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BAJA">Baja</SelectItem>
                    <SelectItem value="MEDIA">Media</SelectItem>
                    <SelectItem value="ALTA">Alta</SelectItem>
                    <SelectItem value="URGENTE">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Líder / responsable</Label>
                <Input value={pOwner} onChange={(e) => setPOwner(e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Fecha inicio</Label>
                <Input type="date" value={pStart} onChange={(e) => setPStart(e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Fecha meta</Label>
                <Input type="date" value={pTarget} onChange={(e) => setPTarget(e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div className="sm:col-span-2">
                <Label>Presupuesto estimado (COP)</Label>
                <Input type="number" min={0} value={pBudget} onChange={(e) => setPBudget(Number(e.target.value))} className="mt-1.5 rounded-xl" />
              </div>
              <div className="sm:col-span-2">
                <Label>Descripción</Label>
                <Textarea value={pDesc} onChange={(e) => setPDesc(e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border p-4">
              <div className="flex items-center justify-between">
                <Label className="font-black">Objetivos / entregables clave</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPObjectives((prev) => [...prev, { id: crypto.randomUUID(), title: "", metric: "", achieved: false }])}
                  className="rounded-xl"
                >
                  <Plus className="mr-1 size-3.5" />
                  Objetivo
                </Button>
              </div>
              {pObjectives.map((obj) => (
                <div key={obj.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Input
                    value={obj.title}
                    onChange={(e) => setPObjectives((prev) => prev.map((o) => (o.id === obj.id ? { ...o, title: e.target.value } : o)))}
                    placeholder="Objetivo (ej. Entregar 20 camisas bordadas)"
                    className="rounded-xl"
                  />
                  <Input
                    value={obj.metric}
                    onChange={(e) => setPObjectives((prev) => prev.map((o) => (o.id === obj.id ? { ...o, metric: e.target.value } : o)))}
                    placeholder="Indicador (ej. 100% músicos con talla)"
                    className="rounded-xl"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setPObjectives((prev) => prev.filter((o) => o.id !== obj.id))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button disabled={saving} className="w-full rounded-xl font-black">
              {saving && <LoaderCircle className="mr-2 size-4 animate-spin" />}
              Guardar proyecto
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="rounded-[2rem] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Agregar tarea al proyecto</DialogTitle>
            <DialogDescription>Asigna responsable, fecha límite y prioridad.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="mt-2 space-y-4">
            <div>
              <Label>Título de la tarea</Label>
              <Input value={tTitle} onChange={(e) => setTTitle(e.target.value)} required placeholder="Ej. Cotizar tela y bordado del logo" className="mt-1.5 rounded-xl" />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={tDesc} onChange={(e) => setTDesc(e.target.value)} className="mt-1.5 rounded-xl" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Responsable</Label>
                <Select value={tAssigneeId} onValueChange={setTAssigneeId}>
                  <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridad</Label>
                <Select value={tPriority} onValueChange={(v) => setTPriority(v as ProjectPriority)}>
                  <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BAJA">Baja</SelectItem>
                    <SelectItem value="MEDIA">Media</SelectItem>
                    <SelectItem value="ALTA">Alta</SelectItem>
                    <SelectItem value="URGENTE">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Fecha límite</Label>
              <Input type="date" value={tDueDate} onChange={(e) => setTDueDate(e.target.value)} className="mt-1.5 rounded-xl" />
            </div>
            <Button disabled={saving} className="w-full rounded-xl font-black">
              {saving && <LoaderCircle className="mr-2 size-4 animate-spin" />}
              Crear tarea
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
