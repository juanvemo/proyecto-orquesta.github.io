import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CircleDollarSign, Clock3, HandCoins, LoaderCircle, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VoidContributionButton } from "@/components/contributions/VoidContributionButton";
import type { RehearsalInvitation } from "./types";
import { confirmContributionPayment, contributionErrorMessage, loadRehearsalCost, saveRehearsalCost, type RehearsalCost } from "./costs";

export function RehearsalCostPanel({ organizationId, rehearsalId, invitations, userName, canManage }: { organizationId: string; rehearsalId: string; invitations: RehearsalInvitation[]; userId: string; userName: string; canManage: boolean }) {
  const [cost, setCost] = useState<RehearsalCost | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const mutation = useRef(false);
  const [total, setTotal] = useState("0");
  const [description, setDescription] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await loadRehearsalCost(rehearsalId, organizationId);
      setCost(data);
      setTotal(String(data?.total_amount ?? 0));
      setDescription(data?.description ?? "");
      setAmounts(Object.fromEntries((data?.rehearsal_contributions ?? []).map((item) => [item.musician_id, String(item.amount_due)])));
      setDates(Object.fromEntries((data?.rehearsal_contributions ?? []).map((item) => [item.musician_id, item.contribution_date ?? ""])));
      setNotes(Object.fromEntries((data?.rehearsal_contributions ?? []).map((item) => [item.musician_id, item.notes ?? ""])));
    } catch (error) {
      setLoadError(contributionErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [rehearsalId, organizationId]);
  useEffect(() => { void load(); }, [load]);
  const pending = cost?.rehearsal_contributions.filter((item) => item.status === "PENDIENTE") ?? [];
  const paid = cost?.rehearsal_contributions.filter((item) => item.status === "PAGADO") ?? [];
  const people = useMemo(() => {
    const rows = new Map<string, { id: string; musician: RehearsalCost["rehearsal_contributions"][number]["musician"] }>(invitations.map((item) => [item.musician_id, { id: item.musician_id, musician: item.musician }]));
    // Un músico retirado de la convocatoria conserva su aporte y aparece en el historial.
    for (const item of cost?.rehearsal_contributions ?? []) {
      if (!rows.has(item.musician_id)) rows.set(item.musician_id, { id: item.musician_id, musician: item.musician });
    }
    return [...rows.values()];
  }, [invitations, cost]);
  const assignedCents = useMemo(() => Object.values(amounts).reduce((sum, value) => sum + Math.round(Number(value || 0) * 100), 0), [amounts]);
  const totalCents = Math.round(Number(total) * 100);
  const busy = saving || confirming !== null;
  const split = () => {
    if (!Number.isFinite(Number(total)) || Number(total) < 0) { toast.error("Ingresa un costo válido"); return; }
    const existingIds = new Set((cost?.rehearsal_contributions ?? []).map((item) => item.musician_id));
    const eligible = [...new Set(invitations.filter((item) => item.response_status !== "NO PUEDO ASISTIR" && !existingIds.has(item.musician_id)).map((item) => item.musician_id))];
    const registeredCents = (cost?.rehearsal_contributions ?? []).reduce((sum, item) => sum + Math.round(Number(item.amount_due) * 100), 0);
    const distributable = totalCents - registeredCents;
    if (distributable < 0) { toast.error("El costo no puede ser menor que los aportes ya registrados"); return; }
    if (!eligible.length) { toast.info("No hay nuevos convocados entre quienes repartir; se conserva lo registrado"); return; }
    const base = Math.floor(distributable / eligible.length);
    const remainder = distributable % eligible.length;
    setAmounts((current) => ({ ...current, ...Object.fromEntries(people.filter((item) => !existingIds.has(item.id)).map((item) => [item.id, "0"])), ...Object.fromEntries(eligible.map((id, index) => [id, String((base + (index < remainder ? 1 : 0)) / 100)])) }));
  };
  const save = async () => {
    if (mutation.current || !canManage) return;
    const values = people.map((item) => Number(amounts[item.id] || 0));
    if (!Number.isFinite(Number(total)) || Number(total) < 0 || values.some((value) => !Number.isFinite(value) || value < 0)) { toast.error("Ingresa importes válidos y no negativos"); return; }
    if (assignedCents !== totalCents) { toast.error("La suma de aportes debe coincidir con el costo total"); return; }
    mutation.current = true;
    setSaving(true);
    try {
      await saveRehearsalCost({ organizationId, rehearsalId, totalAmount: Number(total), description, collectorName: cost?.collector_name ?? userName, contributions: people.map((item) => ({ id: cost?.rehearsal_contributions.find((entry) => entry.musician_id === item.id)?.id, musicianId: item.id, amount: Number(amounts[item.id] || 0), date: dates[item.id] || today(), notes: notes[item.id] || "" })) });
      toast.success("Costo y aportes guardados en el servidor");
      await load();
    } catch (error) {
      toast.error("No fue posible guardar los aportes", { description: contributionErrorMessage(error) });
    } finally {
      mutation.current = false;
      setSaving(false);
    }
  };
  const confirm = async (id: string, date: string, note: string) => {
    if (mutation.current || !canManage) return;
    mutation.current = true;
    setConfirming(id);
    try {
      await confirmContributionPayment(id, organizationId, date, note);
      toast.success("Pago confirmado", { description: "El aporte pasó de pendiente al historial. El importe original se conservó." });
      await load();
    } catch (error) {
      toast.error("No se pudo confirmar el pago", { description: contributionErrorMessage(error) });
    } finally {
      mutation.current = false;
      setConfirming(null);
    }
  };
  if (loading) return <div className="grid min-h-48 place-items-center"><LoaderCircle className="size-6 animate-spin text-primary" /></div>;
  if (loadError) return <Card className="rounded-3xl border-orange-200"><CardContent className="space-y-3 p-6"><p className="font-bold">No se pudieron leer los aportes del servidor</p><p className="break-words text-sm text-muted-foreground">{loadError}</p><p className="text-sm">Si acabas de guardar, el guardado fue confirmado; falta actualizar esta vista. No vuelvas a registrar el aporte.</p><Button variant="outline" className="rounded-xl" onClick={() => void load()}>Volver a consultar</Button></CardContent></Card>;

  if (!canManage) return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Summary icon={HandCoins} label="Saldo pendiente" value={money(pending.reduce((sum, item) => sum + Number(item.amount_due), 0))} tone="bg-orange-500/10 text-orange-700" /><Summary icon={CheckCircle2} label="Aportes pagados" value={money(paid.reduce((sum, item) => sum + Number(item.amount_due), 0))} tone="bg-emerald-500/10 text-emerald-700" /></div><ContributionList title="Pendiente por pagar" items={pending} /><ContributionList title="Historial de pagos" items={paid} /></div>;

  return <div className="space-y-5">
    <div className="grid gap-4 md:grid-cols-3"><Summary icon={ReceiptText} label="Costo total" value={money(Number(total))} tone="bg-primary/10 text-primary" /><Summary icon={HandCoins} label="Aportes pendientes" value={money(cost ? pending.reduce((sum, item) => sum + Number(item.amount_due), 0) : assignedCents / 100)} tone="bg-orange-500/10 text-orange-700" /><Summary icon={CheckCircle2} label="Recaudado" value={money(paid.reduce((sum, item) => sum + Number(item.amount_due), 0))} tone="bg-emerald-500/10 text-emerald-700" /></div>
    <Card className="rounded-[2rem] shadow-none"><CardContent className="p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><h2 className="text-lg font-black">Costo y distribución</h2><p className="text-sm text-muted-foreground">Registra importe, fecha y observación por músico. Los aportes ya guardados se conservan sin sobrescribirlos.</p></div><Button variant="outline" className="shrink-0 rounded-xl" disabled={busy} onClick={split}>Dividir entre nuevos convocados</Button></div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2"><div><Label htmlFor="rehearsal-cost-total">Costo total del ensayo</Label><Input id="rehearsal-cost-total" type="number" min="0" step="0.01" value={total} disabled={busy} onChange={(event) => setTotal(event.target.value)} className="mt-2 h-11 rounded-xl" /></div><div><Label>Recauda</Label><Input value={cost?.collector_name ?? userName} disabled className="mt-2 h-11 rounded-xl bg-muted" /></div><div className="sm:col-span-2"><Label htmlFor="rehearsal-cost-description">Descripción del costo</Label><Textarea id="rehearsal-cost-description" value={description} disabled={busy} onChange={(event) => setDescription(event.target.value)} className="mt-2 rounded-xl" placeholder="Ej. Alquiler de sala" /></div></div>
      <div className="mt-6 divide-y overflow-hidden rounded-2xl border">{people.map((item) => {
        const registered = cost?.rehearsal_contributions.find((entry) => entry.musician_id === item.id);
        return <div key={item.id} className="space-y-3 p-4"><div className="flex flex-wrap items-center gap-2"><p className="min-w-0 font-bold">{item.musician ? `${item.musician.first_name} ${item.musician.last_name}` : "Músico del historial"}</p>{registered && <Badge className={`rounded-lg text-[10px] ${registered.status === "PAGADO" ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-800"}`}>{registered.status} · REGISTRADO</Badge>}</div><div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor={`amount-${item.id}`}>Aporte</Label><Input id={`amount-${item.id}`} type="number" min="0" step="0.01" value={amounts[item.id] ?? "0"} disabled={Boolean(registered) || busy} onChange={(event) => setAmounts((current) => ({ ...current, [item.id]: event.target.value }))} className="mt-1 h-10 rounded-xl" /></div><div><Label htmlFor={`date-${item.id}`}>Fecha del aporte</Label><Input id={`date-${item.id}`} type="date" value={registered ? dates[item.id] || "" : dates[item.id] || today()} disabled={Boolean(registered) || busy} onChange={(event) => setDates((current) => ({ ...current, [item.id]: event.target.value }))} className="mt-1 h-10 min-w-0 rounded-xl" />{registered && !dates[item.id] && <p className="mt-1 text-xs text-muted-foreground">El registro original no tiene fecha informada.</p>}</div><div className="sm:col-span-2"><Label htmlFor={`notes-${item.id}`}>Concepto u observación</Label><Input id={`notes-${item.id}`} value={notes[item.id] ?? ""} disabled={Boolean(registered) || busy} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} className="mt-1 rounded-xl" placeholder="Observación opcional" /></div></div></div>;
      })}{!people.length && <p className="p-5 text-sm text-muted-foreground">Convoca músicos al ensayo para asignar sus aportes.</p>}</div>
      <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between"><p className={`text-sm font-bold ${assignedCents === totalCents ? "text-emerald-700" : "text-orange-700"}`}>Asignado: {money(assignedCents / 100)} · Diferencia: {money((totalCents - assignedCents) / 100)}</p><Button onClick={() => void save()} disabled={busy} className="rounded-xl font-bold">{saving ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <CircleDollarSign className="mr-2 size-4" />} Guardar distribución</Button></div>
    </CardContent></Card>
    <ContributionList title="Pendientes de pago" items={pending} onConfirm={confirm} busy={busy} confirming={confirming} organizationId={organizationId} onChanged={load} />
    <ContributionList title="Historial confirmado" items={paid} busy={busy} organizationId={organizationId} onChanged={load} />
  </div>;
}

function ContributionList({ title, items, onConfirm, busy, confirming, organizationId, onChanged }: { title: string; items: RehearsalCost["rehearsal_contributions"]; onConfirm?: (id: string, date: string, note: string) => Promise<void>; busy?: boolean; confirming?: string | null; organizationId?: string; onChanged?: () => Promise<void> }) {
  const [paymentDates, setPaymentDates] = useState<Record<string, string>>({});
  const [paymentNotes, setPaymentNotes] = useState<Record<string, string>>({});
  return <Card className="rounded-[2rem] shadow-none"><CardContent className="p-0">
    <div className="border-b p-5 sm:px-6"><h3 className="font-black">{title}</h3><p className="text-xs text-muted-foreground">{items.length} registros</p></div>
    {items.length ? <div className="divide-y">{items.map((item) => <div key={item.id} className="space-y-3 p-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="break-words font-bold">{item.musician ? `${item.musician.first_name} ${item.musician.last_name}` : "Músico del historial"}</p><p className="text-xs text-muted-foreground">{item.status === "PAGADO" && item.paid_at ? `Confirmado ${new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" }).format(new Date(item.paid_at))}` : "Debe pagar al recaudador"}</p>{item.contribution_date && <p className="mt-1 text-xs text-muted-foreground">Fecha del aporte: {item.contribution_date}</p>}{item.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.notes}</p>}</div><p className="text-lg font-black">{money(Number(item.amount_due))}</p></div>
      {onConfirm && <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[160px_1fr_auto]"><div><Label htmlFor={`payment-date-${item.id}`}>Fecha del pago</Label><Input id={`payment-date-${item.id}`} type="date" max={today()} value={paymentDates[item.id] ?? today()} disabled={busy} onChange={(event) => setPaymentDates((current) => ({ ...current, [item.id]: event.target.value }))} className="mt-1 min-w-0 rounded-xl" /></div><div><Label htmlFor={`payment-note-${item.id}`}>Observación del pago</Label><Input id={`payment-note-${item.id}`} value={paymentNotes[item.id] ?? ""} disabled={busy} onChange={(event) => setPaymentNotes((current) => ({ ...current, [item.id]: event.target.value }))} className="mt-1 rounded-xl" placeholder="Opcional; se agrega al historial" /></div><Button disabled={busy} className="rounded-xl bg-emerald-600 font-bold hover:bg-emerald-700 sm:col-span-2 lg:col-span-1" onClick={() => void onConfirm(item.id, paymentDates[item.id] || today(), paymentNotes[item.id] || "")}>{confirming === item.id ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />} Confirmar pago</Button></div>}
      {organizationId && onChanged && <div className="flex justify-end"><VoidContributionButton organizationId={organizationId} contributionId={item.id} label={item.musician ? `${item.musician.first_name} ${item.musician.last_name}` : "Músico del historial"} amount={Number(item.amount_due)} status={item.status} disabled={busy} onVoided={onChanged} /></div>}
    </div>)}</div> : <div className="p-8 text-center"><Clock3 className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">No hay registros en esta sección</p></div>}
  </CardContent></Card>;
}
function Summary({ icon: Icon, label, value, tone }: { icon: typeof HandCoins; label: string; value: string; tone: string }) { return <Card className="rounded-3xl shadow-none"><CardContent className="flex items-center gap-4 p-5"><span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${tone}`}><Icon className="size-5" /></span><div className="min-w-0"><p className="break-words text-xl font-black">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>; }
function money(value: number) { return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 }).format(value); }
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
