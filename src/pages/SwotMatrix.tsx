import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Compass,
  LoaderCircle,
  Pencil,
  Plus,
  Shield,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { deleteSwotFactor, deleteSwotGap, listSwotData, saveSwotFactor, saveSwotGap } from "@/features/swot/service";
import type {
  GapPriority,
  GapStatus,
  SwotFactor,
  SwotFactorStatus,
  SwotGap,
  SwotImpact,
  SwotQuadrant,
} from "@/features/swot/types";

const QUADRANTS: Array<{
  key: SwotQuadrant;
  title: string;
  origin: "Interno · Positivo" | "Interno · A mejorar" | "Externo · Positivo" | "Externo · Riesgo";
  tone: string;
  badgeTone: string;
  icon: typeof Shield;
  hint: string;
}> = [
  {
    key: "FORTALEZA",
    title: "Fortalezas (F)",
    origin: "Interno · Positivo",
    tone: "border-emerald-500/30 bg-emerald-500/[0.04]",
    badgeTone: "bg-emerald-500/15 text-emerald-700",
    icon: Shield,
    hint: "Capacidades internas diferenciales: talento musical, arreglos propios, puntualidad, cohesión escénica.",
  },
  {
    key: "DEBILIDAD",
    title: "Debilidades (D)",
    origin: "Interno · A mejorar",
    tone: "border-amber-500/30 bg-amber-500/[0.04]",
    badgeTone: "bg-amber-500/15 text-amber-700",
    icon: AlertTriangle,
    hint: "Limitaciones internas corregibles: rotación de músicos, falta de equipos propios, tiempos de montaje.",
  },
  {
    key: "OPORTUNIDAD",
    title: "Oportunidades (O)",
    origin: "Externo · Positivo",
    tone: "border-sky-500/30 bg-sky-500/[0.04]",
    badgeTone: "bg-sky-500/15 text-sky-700",
    icon: TrendingUp,
    hint: "Tendencias del entorno aprovechables: festivales, bodas corporativas, alianzas con venues y productores.",
  },
  {
    key: "AMENAZA",
    title: "Amenazas (A)",
    origin: "Externo · Riesgo",
    tone: "border-rose-500/30 bg-rose-500/[0.04]",
    badgeTone: "bg-rose-500/15 text-rose-700",
    icon: Compass,
    hint: "Riesgos externos: estacionalidad de eventos, competencia de precios bajos, cancelaciones climáticas.",
  },
];

const GAP_AREAS = ["Musical", "Comercial", "Logística y Técnica", "Talento Humano", "Finanzas", "Imagen y Marca", "Otro"];

export default function SwotMatrix() {
  const { membership, session, hasPermission } = useAuth();
  const canManage = hasPermission("swot.manage") || hasPermission("organization.manage");

  const [factors, setFactors] = useState<SwotFactor[]>([]);
  const [gaps, setGaps] = useState<SwotGap[]>([]);
  const [loading, setLoading] = useState(true);

  const [factorDialogOpen, setFactorDialogOpen] = useState(false);
  const [editingFactor, setEditingFactor] = useState<SwotFactor | null>(null);
  const [fQuadrant, setFQuadrant] = useState<SwotQuadrant>("FORTALEZA");
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fImpact, setFImpact] = useState<SwotImpact>("ALTO");
  const [fPriority, setFPriority] = useState(2);
  const [fResponsible, setFResponsible] = useState("");
  const [fDate, setFDate] = useState("");
  const [fStatus, setFStatus] = useState<SwotFactorStatus>("ACTIVO");
  const [fStrategy, setFStrategy] = useState("");

  const [gapDialogOpen, setGapDialogOpen] = useState(false);
  const [editingGap, setEditingGap] = useState<SwotGap | null>(null);
  const [gArea, setGArea] = useState("Musical");
  const [gCurrent, setGCurrent] = useState("");
  const [gDesired, setGDesired] = useState("");
  const [gDesc, setGDesc] = useState("");
  const [gPlan, setGPlan] = useState("");
  const [gResponsible, setGResponsible] = useState("");
  const [gPriority, setGPriority] = useState<GapPriority>("ALTA");
  const [gStatus, setGStatus] = useState<GapStatus>("IDENTIFICADA");
  const [gDueDate, setGDueDate] = useState("");

  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!membership) return;
    setLoading(true);
    try {
      const res = await listSwotData(membership.organizationId);
      setFactors(res.factors);
      setGaps(res.gaps);
    } catch (error) {
      toast.error("No fue posible cargar la Matriz DOFA", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [membership]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNewFactor = (quadrant: SwotQuadrant) => {
    setEditingFactor(null);
    setFQuadrant(quadrant);
    setFTitle("");
    setFDesc("");
    setFImpact("ALTO");
    setFPriority(2);
    setFResponsible("");
    setFDate("");
    setFStatus("ACTIVO");
    setFStrategy("");
    setFactorDialogOpen(true);
  };

  const openEditFactor = (item: SwotFactor) => {
    setEditingFactor(item);
    setFQuadrant(item.quadrant);
    setFTitle(item.title);
    setFDesc(item.description ?? "");
    setFImpact(item.impact);
    setFPriority(item.priority);
    setFResponsible(item.responsible ?? "");
    setFDate(item.target_date ?? "");
    setFStatus(item.status);
    setFStrategy(item.strategic_action ?? "");
    setFactorDialogOpen(true);
  };

  const submitFactor = async (e: FormEvent) => {
    e.preventDefault();
    if (!membership || !session || !fTitle.trim()) return;
    setSaving(true);
    try {
      await saveSwotFactor(membership.organizationId, session.user.id, {
        id: editingFactor?.id,
        quadrant: fQuadrant,
        title: fTitle,
        description: fDesc,
        impact: fImpact,
        priority: fPriority,
        responsible: fResponsible,
        target_date: fDate || null,
        status: fStatus,
        strategic_action: fStrategy,
      });
      toast.success(editingFactor ? "Factor actualizado" : "Factor registrado en Matriz DOFA");
      setFactorDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Error al guardar factor DOFA", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const openNewGap = () => {
    setEditingGap(null);
    setGArea("Musical");
    setGCurrent("");
    setGDesired("");
    setGDesc("");
    setGPlan("");
    setGResponsible("");
    setGPriority("ALTA");
    setGStatus("IDENTIFICADA");
    setGDueDate("");
    setGapDialogOpen(true);
  };

  const openEditGap = (gap: SwotGap) => {
    setEditingGap(gap);
    setGArea(gap.area);
    setGCurrent(gap.current_state);
    setGDesired(gap.desired_state);
    setGDesc(gap.gap_description);
    setGPlan(gap.action_plan);
    setGResponsible(gap.responsible ?? "");
    setGPriority(gap.priority);
    setGStatus(gap.status);
    setGDueDate(gap.due_date ?? "");
    setGapDialogOpen(true);
  };

  const submitGap = async (e: FormEvent) => {
    e.preventDefault();
    if (!membership || !session || !gDesc.trim() || !gPlan.trim()) return;
    setSaving(true);
    try {
      await saveSwotGap(membership.organizationId, session.user.id, {
        id: editingGap?.id,
        area: gArea,
        current_state: gCurrent,
        desired_state: gDesired,
        gap_description: gDesc,
        action_plan: gPlan,
        responsible: gResponsible,
        priority: gPriority,
        status: gStatus,
        due_date: gDueDate || null,
      });
      toast.success(editingGap ? "Brecha actualizada" : "Brecha registrada");
      setGapDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Error al guardar brecha", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-primary">Planeación Estratégica</p>
          <h1 className="mt-2 text-3xl font-black">Matriz DOFA y Análisis de Brechas</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Diagnóstico estratégico integral de Proyecto Orquesta para convertir debilidades en planes de acción y detectar brechas operativas, artísticas y comerciales.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openNewGap} className="rounded-2xl font-bold">
              <Plus className="mr-2 size-4" />
              Nueva brecha
            </Button>
            <Button onClick={() => openNewFactor("FORTALEZA")} className="rounded-2xl font-black">
              <Plus className="mr-2 size-4" />
              Agregar factor DOFA
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="matrix" className="space-y-6">
        <TabsList className="flex h-auto w-full justify-start overflow-x-auto rounded-2xl p-1.5 sm:w-fit">
          <TabsTrigger value="matrix" className="rounded-xl">
            <Target className="mr-2 size-4" />
            Matriz DOFA Interactiva
          </TabsTrigger>
          <TabsTrigger value="gaps" className="rounded-xl">
            <Sparkles className="mr-2 size-4" />
            Análisis de Brechas ({gaps.length})
          </TabsTrigger>
          <TabsTrigger value="theory" className="rounded-xl">
            <BookOpen className="mr-2 size-4" />
            Teoría y Metodología DOFA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="space-y-5">
          {loading ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-72 rounded-[2rem]" />
              ))}
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {QUADRANTS.map((q) => {
                const items = factors.filter((f) => f.quadrant === q.key);
                const Icon = q.icon;
                return (
                  <Card key={q.key} className={`rounded-[2rem] shadow-none ${q.tone}`}>
                    <CardContent className="p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className={`grid size-11 place-items-center rounded-2xl ${q.badgeTone}`}>
                            <Icon className="size-5" />
                          </span>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{q.origin}</p>
                            <h2 className="text-lg font-black">{q.title}</h2>
                          </div>
                        </div>
                        {canManage && (
                          <Button size="sm" variant="outline" onClick={() => openNewFactor(q.key)} className="rounded-xl bg-background">
                            <Plus className="mr-1 size-3.5" />
                            Agregar
                          </Button>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{q.hint}</p>

                      <div className="mt-4 space-y-3">
                        {items.map((item) => (
                          <div key={item.id} className="rounded-2xl border bg-background p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-black">{item.title}</p>
                                {item.description && (
                                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                                )}
                              </div>
                              {canManage && (
                                <div className="flex shrink-0 gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => openEditFactor(item)} className="size-8 rounded-lg">
                                    <Pencil className="size-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={async () => {
                                      if (!membership || !session) return;
                                      await deleteSwotFactor(membership.organizationId, session.user.id, item.id);
                                      toast.success("Factor eliminado");
                                      void load();
                                    }}
                                    className="size-8 rounded-lg text-destructive"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="rounded-lg text-[10px]">Impacto {item.impact}</Badge>
                              <Badge variant="secondary" className="rounded-lg text-[10px]">Prioridad P{item.priority}</Badge>
                              <Badge className="rounded-lg bg-primary/10 text-[10px] text-primary">{item.status}</Badge>
                              {item.responsible && (
                                <span className="text-[11px] font-semibold text-muted-foreground">
                                  Resp: {item.responsible}
                                </span>
                              )}
                            </div>
                            {item.strategic_action && (
                              <p className="mt-2 rounded-xl bg-muted/50 px-3 py-2 text-xs font-medium">
                                <strong>Acción estratégica:</strong> {item.strategic_action}
                              </p>
                            )}
                          </div>
                        ))}
                        {!items.length && (
                          <p className="rounded-2xl border border-dashed bg-background/60 p-6 text-center text-xs text-muted-foreground">
                            Aún no hay registros en {q.title.toLowerCase()}.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="gaps" className="space-y-4">
          {gaps.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {gaps.map((gap) => (
                <Card key={gap.id} className="rounded-[2rem] shadow-none">
                  <CardContent className="space-y-4 p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge className="rounded-lg bg-primary/10 text-primary">{gap.area}</Badge>
                        <h3 className="mt-2 text-lg font-black">{gap.gap_description}</h3>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="rounded-lg">{gap.priority}</Badge>
                        <Badge variant="secondary" className="rounded-lg">{gap.status}</Badge>
                      </div>
                    </div>

                    <div className="grid gap-3 rounded-2xl bg-muted/40 p-4 text-xs sm:grid-cols-2">
                      <div>
                        <p className="font-black uppercase text-muted-foreground">Estado actual</p>
                        <p className="mt-1 text-sm">{gap.current_state}</p>
                      </div>
                      <div>
                        <p className="font-black uppercase text-primary">Estado deseado</p>
                        <p className="mt-1 text-sm font-medium">{gap.desired_state}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border p-3.5 text-sm">
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Plan de cierre</p>
                      <p className="mt-1">{gap.action_plan}</p>
                      <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                        <span>Responsable: <strong>{gap.responsible || "Sin asignar"}</strong></span>
                        {gap.due_date && <span>Meta: {gap.due_date}</span>}
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex justify-end gap-2 border-t pt-3">
                        <Button size="sm" variant="outline" onClick={() => openEditGap(gap)} className="rounded-xl">
                          <Pencil className="mr-1.5 size-3.5" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl text-destructive"
                          onClick={async () => {
                            if (!membership || !session) return;
                            await deleteSwotGap(membership.organizationId, session.user.id, gap.id);
                            toast.success("Brecha eliminada");
                            void load();
                          }}
                        >
                          <Trash2 className="mr-1.5 size-3.5" />
                          Eliminar
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-[2rem] shadow-none">
              <CardContent className="p-12 text-center">
                <Sparkles className="mx-auto size-10 text-primary" />
                <p className="mt-3 font-black">Sin brechas documentadas</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Registra la diferencia entre el estado actual y el estado objetivo de la orquesta para trazar planes de mejora medibles.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="theory" className="space-y-5">
          <Card className="rounded-[2rem] shadow-none">
            <CardContent className="space-y-6 p-6 sm:p-8">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-primary">Fundamentación Estratégica</p>
                <h2 className="mt-1 text-2xl font-black">¿Qué es la Matriz DOFA y cómo aplicarla en una orquesta?</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  La metodología <strong>DOFA</strong> (Debilidades, Oportunidades, Fortalezas y Amenazas — conocida internacionalmente como SWOT) permite analizar simultáneamente las capacidades internas bajo control directo de la orquesta y las variables externas del mercado de eventos y espectáculos.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <TheoryBox
                  title="1. Análisis Interno (Controlable)"
                  items={[
                    "Fortalezas (F): Ventajas artísticas, repertorio exclusivo, disciplina en ensayos, calidad de sonido y liderazgo.",
                    "Debilidades (D): Carencias internas que frenan el crecimiento, como ausencia de inventario propio, baja asistencia o procesos manuales.",
                  ]}
                />
                <TheoryBox
                  title="2. Análisis Externo (Entorno)"
                  items={[
                    "Oportunidades (O): Factores positivos del entorno: temporadas altas de bodas, eventos empresariales, festivales municipales o alianzas.",
                    "Amenazas (A): Riesgos externos como competencia informal de bajo costo, cambios normativos o cancelaciones por clima.",
                  ]}
                />
              </div>

              <div>
                <h3 className="text-lg font-black">3. Cruce Estratégico (Estrategias FO, FA, DO, DA)</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <StrategyCard code="FO · Ofensiva" desc="Usa tus Fortalezas para aprovechar al máximo las Oportunidades (ej. usar un show temático consolidado para captar grandes hoteles y convenciones)." />
                  <StrategyCard code="FA · Defensiva" desc="Emplea tus Fortalezas para mitigar las Amenazas externas (ej. diferenciarse con rider profesional y puntualidad frente a competidores informales)." />
                  <StrategyCard code="DO · Reorientación" desc="Aprovecha las Oportunidades para superar Debilidades internas (ej. reinvertir anticipos de temporada alta en backline e inventario propio)." />
                  <StrategyCard code="DA · Supervivencia" desc="Reduce Debilidades y esquiva Amenazas (ej. crear banco de reemplazantes externos para evitar incumplimientos en fechas simultáneas)." />
                </div>
              </div>

              <div className="rounded-2xl bg-primary/5 p-5">
                <h3 className="font-black text-primary">4. Identificación de Brechas (Gap Analysis)</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Una <strong>brecha</strong> es la distancia exacta entre <em>dónde está hoy la orquesta</em> (Estado Actual) y <em>dónde necesita estar</em> (Estado Deseado). Para cerrarla efectivamente, cada brecha registrada en este módulo exige: responsable asignado, fecha objetivo y un plan de acción concreto que puede convertirse en proyecto operativo.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Factor Dialog */}
      <Dialog open={factorDialogOpen} onOpenChange={setFactorDialogOpen}>
        <DialogContent className="rounded-[2rem] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">
              {editingFactor ? "Editar factor DOFA" : "Nuevo factor en Matriz DOFA"}
            </DialogTitle>
            <DialogDescription>Clasifica el factor y asigna una acción estratégica y responsable.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitFactor} className="mt-2 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Cuadrante</Label>
                <Select value={fQuadrant} onValueChange={(v) => setFQuadrant(v as SwotQuadrant)}>
                  <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FORTALEZA">Fortaleza</SelectItem>
                    <SelectItem value="DEBILIDAD">Debilidad</SelectItem>
                    <SelectItem value="OPORTUNIDAD">Oportunidad</SelectItem>
                    <SelectItem value="AMENAZA">Amenaza</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Impacto</Label>
                <Select value={fImpact} onValueChange={(v) => setFImpact(v as SwotImpact)}>
                  <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BAJO">Bajo</SelectItem>
                    <SelectItem value="MEDIO">Medio</SelectItem>
                    <SelectItem value="ALTO">Alto</SelectItem>
                    <SelectItem value="CRÍTICO">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Título del factor</Label>
              <Input value={fTitle} onChange={(e) => setFTitle(e.target.value)} required className="mt-1.5 rounded-xl" />
            </div>
            <div>
              <Label>Descripción / evidencia</Label>
              <Textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} className="mt-1.5 rounded-xl" />
            </div>
            <div>
              <Label>Acción estratégica sugerida</Label>
              <Textarea value={fStrategy} onChange={(e) => setFStrategy(e.target.value)} placeholder="Ej. Crear banco de reemplazantes en vientos" className="mt-1.5 rounded-xl" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Prioridad (1-5)</Label>
                <Input type="number" min={1} max={5} value={fPriority} onChange={(e) => setFPriority(Number(e.target.value))} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={fStatus} onValueChange={(v) => setFStatus(v as SwotFactorStatus)}>
                  <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVO">Activo</SelectItem>
                    <SelectItem value="EN PROCESO">En proceso</SelectItem>
                    <SelectItem value="RESUELTO">Resuelto</SelectItem>
                    <SelectItem value="ARCHIVADO">Archivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha meta</Label>
                <Input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
            </div>
            <div>
              <Label>Responsable</Label>
              <Input value={fResponsible} onChange={(e) => setFResponsible(e.target.value)} className="mt-1.5 rounded-xl" />
            </div>
            <Button disabled={saving} className="w-full rounded-xl font-black">
              {saving && <LoaderCircle className="mr-2 size-4 animate-spin" />}
              Guardar factor
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Gap Dialog */}
      <Dialog open={gapDialogOpen} onOpenChange={setGapDialogOpen}>
        <DialogContent className="rounded-[2rem] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">
              {editingGap ? "Editar análisis de brecha" : "Registrar brecha organizacional"}
            </DialogTitle>
            <DialogDescription>Compara el estado actual frente al estado deseado y define el plan de cierre.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitGap} className="mt-2 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Área</Label>
                <Select value={gArea} onValueChange={setGArea}>
                  <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GAP_AREAS.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridad</Label>
                <Select value={gPriority} onValueChange={(v) => setGPriority(v as GapPriority)}>
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
                <Label>Estado</Label>
                <Select value={gStatus} onValueChange={(v) => setGStatus(v as GapStatus)}>
                  <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IDENTIFICADA">Identificada</SelectItem>
                    <SelectItem value="EN PLAN">En plan</SelectItem>
                    <SelectItem value="EN PROGRESO">En progreso</SelectItem>
                    <SelectItem value="CERRADA">Cerrada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Brecha identificada</Label>
              <Input value={gDesc} onChange={(e) => setGDesc(e.target.value)} required placeholder="Ej. Falta cobertura de sonido propio para eventos medianos" className="mt-1.5 rounded-xl" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Estado actual</Label>
                <Textarea value={gCurrent} onChange={(e) => setGCurrent(e.target.value)} required className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Estado deseado</Label>
                <Textarea value={gDesired} onChange={(e) => setGDesired(e.target.value)} required className="mt-1.5 rounded-xl" />
              </div>
            </div>
            <div>
              <Label>Plan de acción para cerrar la brecha</Label>
              <Textarea value={gPlan} onChange={(e) => setGPlan(e.target.value)} required className="mt-1.5 rounded-xl" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Responsable</Label>
                <Input value={gResponsible} onChange={(e) => setGResponsible(e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Fecha objetivo</Label>
                <Input type="date" value={gDueDate} onChange={(e) => setGDueDate(e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
            </div>
            <Button disabled={saving} className="w-full rounded-xl font-black">
              {saving && <LoaderCircle className="mr-2 size-4 animate-spin" />}
              Guardar brecha
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TheoryBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border p-5">
      <h3 className="font-black">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function StrategyCard({ code, desc }: { code: string; desc: string }) {
  return (
    <div className="rounded-2xl border bg-muted/20 p-4">
      <p className="text-xs font-black uppercase text-primary">{code}</p>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
