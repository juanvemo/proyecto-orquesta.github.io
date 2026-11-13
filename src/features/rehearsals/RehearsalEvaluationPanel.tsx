import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { RehearsalInvitation } from "./types";
import {
  loadRehearsalEvaluations,
  saveMusicianEvaluation,
  saveRehearsalEvaluation,
  type MusicianEvaluation,
  type SemaphoreColor,
} from "./evaluations";

const semaphoreMeta: Record<SemaphoreColor, { label: string; badge: string; dot: string; activeBtn: string }> = {
  VERDE: {
    label: "Verde · Óptimo",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    dot: "bg-emerald-500",
    activeBtn: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
  },
  AMARILLO: {
    label: "Amarillo · Con observaciones",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    dot: "bg-amber-500",
    activeBtn: "border-amber-500 bg-amber-500 text-white hover:bg-amber-600",
  },
  ROJO: {
    label: "Rojo · Crítico / Refuerzo",
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
    dot: "bg-rose-500",
    activeBtn: "border-rose-600 bg-rose-600 text-white hover:bg-rose-700",
  },
};

export function RehearsalEvaluationPanel({
  organizationId,
  rehearsalId,
  rehearsalName,
  rehearsalDate,
  invitations,
  userId,
  evaluatorName,
  canEvaluate,
}: {
  organizationId: string;
  rehearsalId: string;
  rehearsalName: string;
  rehearsalDate: string;
  invitations: RehearsalInvitation[];
  userId: string;
  evaluatorName: string;
  canEvaluate: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingMusicianId, setSavingMusicianId] = useState<string | null>(null);

  const [semaphore, setSemaphore] = useState<SemaphoreColor>("VERDE");
  const [score, setScore] = useState("85");
  const [progress, setProgress] = useState("80");
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [hasSavedGeneral, setHasSavedGeneral] = useState(false);

  const [musicianForms, setMusicianForms] = useState<
    Record<string, { semaphore: SemaphoreColor; score: string; progress: string; notes: string; saved: boolean }>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { rehearsalEval, musicianEvals } = await loadRehearsalEvaluations(organizationId, rehearsalId);
      if (rehearsalEval) {
        setSemaphore(rehearsalEval.semaphore);
        setScore(rehearsalEval.score !== null ? String(rehearsalEval.score) : "85");
        setProgress(String(rehearsalEval.progress_percentage ?? 80));
        setStrengths(rehearsalEval.strengths ?? "");
        setImprovements(rehearsalEval.improvements ?? "");
        setGeneralNotes(rehearsalEval.general_notes ?? "");
        setHasSavedGeneral(true);
      } else {
        setHasSavedGeneral(false);
      }

      const byMusician = new Map<string, MusicianEvaluation>(musicianEvals.map((e) => [e.musician_id, e]));
      const formMap: Record<string, { semaphore: SemaphoreColor; score: string; progress: string; notes: string; saved: boolean }> = {};
      for (const inv of invitations) {
        const prev = byMusician.get(inv.musician_id);
        formMap[inv.musician_id] = {
          semaphore: prev?.semaphore ?? "VERDE",
          score: prev?.score !== null && prev?.score !== undefined ? String(prev.score) : "85",
          progress: String(prev?.progress_percentage ?? 80),
          notes: prev?.notes ?? "",
          saved: Boolean(prev),
        };
      }
      setMusicianForms(formMap);
    } catch (error) {
      toast.error("No se pudieron cargar las evaluaciones", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [organizationId, rehearsalId, invitations]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveGeneral = async () => {
    setSavingGeneral(true);
    try {
      await saveRehearsalEvaluation({
        organization_id: organizationId,
        rehearsal_id: rehearsalId,
        evaluator_user_id: userId,
        evaluator_name: evaluatorName,
        semaphore,
        score: score.trim() === "" ? null : Math.max(0, Math.min(100, Number(score))),
        progress_percentage: Math.max(0, Math.min(100, Number(progress || 0))),
        strengths: strengths.trim(),
        improvements: improvements.trim(),
        general_notes: generalNotes.trim(),
        songs_worked: [],
      });
      setHasSavedGeneral(true);
      toast.success("Evaluación general del ensayo guardada");
    } catch (error) {
      toast.error("No se pudo guardar la evaluación", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSaveMusician = async (inv: RehearsalInvitation) => {
    const form = musicianForms[inv.musician_id];
    if (!form) return;
    setSavingMusicianId(inv.musician_id);
    try {
      await saveMusicianEvaluation({
        organization_id: organizationId,
        rehearsal_id: rehearsalId,
        rehearsal_name: rehearsalName,
        rehearsal_date: rehearsalDate,
        musician_id: inv.musician_id,
        musician_name: `${inv.musician?.first_name ?? ""} ${inv.musician?.last_name ?? ""}`.trim(),
        evaluator_user_id: userId,
        evaluator_name: evaluatorName,
        semaphore: form.semaphore,
        score: form.score.trim() === "" ? null : Math.max(0, Math.min(100, Number(form.score))),
        progress_percentage: Math.max(0, Math.min(100, Number(form.progress || 0))),
        notes: form.notes.trim(),
      });
      setMusicianForms((prev) => ({ ...prev, [inv.musician_id]: { ...form, saved: true } }));
      toast.success(`Evaluación guardada para ${inv.musician?.first_name ?? "el músico"}`);
    } catch (error) {
      toast.error("No se pudo guardar la evaluación del músico", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setSavingMusicianId(null);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-48 place-items-center">
        <LoaderCircle className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[2rem] shadow-none">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black">Evaluación general del ensayo (Semáforo)</h2>
                {hasSavedGeneral && (
                  <Badge variant="outline" className={`rounded-lg ${semaphoreMeta[semaphore].badge}`}>
                    <span className={`mr-1.5 inline-block size-2 rounded-full ${semaphoreMeta[semaphore].dot}`} />
                    {semaphoreMeta[semaphore].label}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Calificación de desempeño colectivo, avance del montaje y aspectos por reforzar.
              </p>
            </div>
            {canEvaluate && (
              <Button onClick={() => void handleSaveGeneral()} disabled={savingGeneral} className="rounded-xl font-bold">
                {savingGeneral ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                Guardar evaluación general
              </Button>
            )}
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <Label>Indicador Semáforo</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {(["VERDE", "AMARILLO", "ROJO"] as SemaphoreColor[]).map((color) => (
                  <button
                    key={color}
                    type="button"
                    disabled={!canEvaluate}
                    onClick={() => setSemaphore(color)}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition ${
                      semaphore === color ? semaphoreMeta[color].activeBtn : "bg-background hover:bg-muted/50"
                    }`}
                  >
                    <span className={`size-3 rounded-full ${semaphore === color ? "bg-white" : semaphoreMeta[color].dot}`} />
                    {semaphoreMeta[color].label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Puntaje (0 – 100)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                disabled={!canEvaluate}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="mt-2 h-11 rounded-xl"
              />
            </div>

            <div className="sm:col-span-2">
              <div className="flex justify-between">
                <Label>Porcentaje de avance del ensayo</Label>
                <span className="text-xs font-black text-primary">{progress}%</span>
              </div>
              <Input
                type="range"
                min="0"
                max="100"
                disabled={!canEvaluate}
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
                className="mt-3 h-2 w-full cursor-pointer accent-primary"
              />
              <Progress value={Number(progress || 0)} className="mt-2 h-2" />
            </div>

            <div>
              <Label>Fortalezas observadas</Label>
              <Textarea
                disabled={!canEvaluate}
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                placeholder="Ej. Excelente ensamble de vientos y tempo estable"
                className="mt-2 min-h-24 rounded-xl"
              />
            </div>

            <div>
              <Label>Aspectos por mejorar</Label>
              <Textarea
                disabled={!canEvaluate}
                value={improvements}
                onChange={(e) => setImprovements(e.target.value)}
                placeholder="Ej. Cuidar dinámicas en el coro y cortes finales"
                className="mt-2 min-h-24 rounded-xl"
              />
            </div>

            <div>
              <Label>Observaciones generales</Label>
              <Textarea
                disabled={!canEvaluate}
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder="Notas de Dirección Musical para el próximo ensayo"
                className="mt-2 min-h-24 rounded-xl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] shadow-none">
        <CardContent className="p-0">
          <div className="border-b p-5 sm:px-6">
            <h3 className="text-lg font-black">Evaluación individual por músico</h3>
            <p className="text-xs text-muted-foreground">
              Registra el desempeño individual en este ensayo; quedará visible en el perfil de cada músico.
            </p>
          </div>
          {invitations.length ? (
            <div className="divide-y">
              {invitations.map((inv) => {
                const form = musicianForms[inv.musician_id] ?? {
                  semaphore: "VERDE" as SemaphoreColor,
                  score: "85",
                  progress: "80",
                  notes: "",
                  saved: false,
                };
                return (
                  <div key={inv.id} className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[220px_auto_90px_1fr_auto] lg:items-center">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/10 text-xs font-black text-primary">
                        {inv.musician?.photo_url ? (
                          <img src={inv.musician.photo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          `${inv.musician?.first_name?.[0] ?? "M"}${inv.musician?.last_name?.[0] ?? ""}`
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold">{inv.musician?.first_name} {inv.musician?.last_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{inv.musician?.specialty || "Músico"}</p>
                      </div>
                    </div>

                    <div className="flex gap-1.5">
                      {(["VERDE", "AMARILLO", "ROJO"] as SemaphoreColor[]).map((color) => (
                        <button
                          key={color}
                          type="button"
                          disabled={!canEvaluate}
                          onClick={() =>
                            setMusicianForms((prev) => ({
                              ...prev,
                              [inv.musician_id]: { ...form, semaphore: color },
                            }))
                          }
                          className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                            form.semaphore === color ? semaphoreMeta[color].activeBtn : "bg-background hover:bg-muted"
                          }`}
                        >
                          <span className={`size-2 rounded-full ${form.semaphore === color ? "bg-white" : semaphoreMeta[color].dot}`} />
                          {color}
                        </button>
                      ))}
                    </div>

                    <Input
                      type="number"
                      min="0"
                      max="100"
                      disabled={!canEvaluate}
                      aria-label="Puntaje"
                      value={form.score}
                      onChange={(e) =>
                        setMusicianForms((prev) => ({
                          ...prev,
                          [inv.musician_id]: { ...form, score: e.target.value },
                        }))
                      }
                      className="h-9 rounded-xl text-center"
                    />

                    <Input
                      disabled={!canEvaluate}
                      placeholder="Observación individual del desempeño..."
                      value={form.notes}
                      onChange={(e) =>
                        setMusicianForms((prev) => ({
                          ...prev,
                          [inv.musician_id]: { ...form, notes: e.target.value },
                        }))
                      }
                      className="h-9 rounded-xl"
                    />

                    {canEvaluate && (
                      <Button
                        size="sm"
                        variant={form.saved ? "outline" : "default"}
                        disabled={savingMusicianId === inv.musician_id}
                        onClick={() => void handleSaveMusician(inv)}
                        className="rounded-xl"
                      >
                        {savingMusicianId === inv.musician_id ? (
                          <LoaderCircle className="mr-1.5 size-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-1.5 size-3.5" />
                        )}
                        {form.saved ? "Actualizar" : "Guardar"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">Convoca músicos en este ensayo para evaluarlos individualmente.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
