import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, CircleDollarSign, Clock3, HandCoins, LoaderCircle, Plus, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Musician } from "@/features/musicians/types";
import type { RehearsalInvitation } from "./types";
import {
  addOrUpdateSingleContribution,
  confirmContributionPayment,
  loadRehearsalCost,
  saveRehearsalCost,
  type RehearsalCost,
} from "./costs";

export function RehearsalCostPanel({
  organizationId,
  rehearsalId,
  invitations,
  musicians = [],
  userId,
  userName,
  canManage,
}: {
  organizationId: string;
  rehearsalId: string;
  invitations: RehearsalInvitation[];
  musicians?: Musician[];
  userId: string;
  userName: string;
  canManage: boolean;
}) {
  const [cost, setCost] = useState<RehearsalCost | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [total, setTotal] = useState("0");
  const [description, setDescription] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  // Quick individual contribution form state
  const [singleMusicianId, setSingleMusicianId] = useState("");
  const [singleConcept, setSingleConcept] = useState("Aporte ensayo");
  const [singleAmount, setSingleAmount] = useState("");
  const [singleDate, setSingleDate] = useState(new Date().toISOString().slice(0, 10));
  const [singleNotes, setSingleNotes] = useState("");
  const [savingSingle, setSavingSingle] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadRehearsalCost(rehearsalId, organizationId);
      setCost(data);
      setTotal(String(data?.total_amount ?? 0));
      setDescription(data?.description ?? "");
      const invitationIds = new Set(invitations.map((inv) => inv.musician_id));
      const initialAmounts: Record<string, string> = {};
      for (const inv of invitations) {
        const found = data?.rehearsal_contributions.find((c) => c.musician_id === inv.musician_id);
        initialAmounts[inv.musician_id] = found ? String(found.amount_due) : "0";
      }
      for (const c of data?.rehearsal_contributions ?? []) {
        if (!invitationIds.has(c.musician_id)) {
          initialAmounts[c.musician_id] = String(c.amount_due);
        }
      }
      setAmounts(initialAmounts);
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      toast.error("No fue posible cargar los aportes", { description: message });
    } finally {
      setLoading(false);
    }
  }, [rehearsalId, organizationId, invitations]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = cost?.rehearsal_contributions.filter((item) => item.status === "PENDIENTE") ?? [];
  const paid = cost?.rehearsal_contributions.filter((item) => item.status === "PAGADO") ?? [];

  const contributorList = useMemo(() => {
    const map = new Map<string, { musicianId: string; name: string; initial: string; paidContribution?: RehearsalCost["rehearsal_contributions"][number] }>();
    for (const inv of invitations) {
      const paidContribution = cost?.rehearsal_contributions.find((entry) => entry.musician_id === inv.musician_id && entry.status === "PAGADO");
      map.set(inv.musician_id, {
        musicianId: inv.musician_id,
        name: `${inv.musician?.first_name ?? "Músico"} ${inv.musician?.last_name ?? ""}`.trim(),
        initial: `${inv.musician?.first_name?.[0] ?? "M"}${inv.musician?.last_name?.[0] ?? ""}`,
        paidContribution,
      });
    }
    for (const entry of cost?.rehearsal_contributions ?? []) {
      if (!map.has(entry.musician_id)) {
        const display = entry.musician
          ? `${entry.musician.first_name} ${entry.musician.last_name}`.trim()
          : entry.musician_name_snapshot || "Músico retirado";
        map.set(entry.musician_id, {
          musicianId: entry.musician_id,
          name: display,
          initial: display.slice(0, 2).toUpperCase(),
          paidContribution: entry.status === "PAGADO" ? entry : undefined,
        });
      }
    }
    return Array.from(map.values());
  }, [invitations, cost]);

  const selectableMusicians = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const inv of invitations) {
      const label = `${inv.musician?.first_name ?? "Músico"} ${inv.musician?.last_name ?? ""}`.trim();
      map.set(inv.musician_id, { id: inv.musician_id, label: `${label} (Convocado)` });
    }
    for (const m of musicians) {
      if (m.status === "ACTIVO" && !map.has(m.id)) {
        map.set(m.id, { id: m.id, label: `${m.first_name} ${m.last_name}`.trim() });
      }
    }
    return Array.from(map.values());
  }, [invitations, musicians]);

  const assigned = useMemo(
    () => contributorList.reduce((sum, item) => sum + Number(amounts[item.musicianId] || 0), 0),
    [contributorList, amounts],
  );

  const numericTotal = Number(total || 0);

  const split = () => {
    setSaveError(null);
    if (numericTotal <= 0) {
      toast.error("Ingresa primero un costo total mayor a 0 para dividirlo.");
      return;
    }
    const paidIds = new Set(paid.map((item) => item.musician_id));
    const people = invitations.filter((item) => item.response_status !== "NO PUEDO ASISTIR" && !paidIds.has(item.musician_id));
    if (!people.length) {
      toast.error("No hay músicos pendientes disponibles para dividir el costo.");
      return;
    }
    const paidTotal = paid.reduce((sum, item) => sum + Number(item.amount_due), 0);
    const distributable = Math.max(0, numericTotal - paidTotal);
    const base = Math.floor(distributable / people.length);
    const remainder = distributable - base * people.length;
    setAmounts((current) => ({
      ...current,
      ...Object.fromEntries(people.map((item, index) => [item.musician_id, String(base + (index === 0 ? remainder : 0))])),
    }));
  };

  const save = async (matchTotalToAssigned = false) => {
    setSaveError(null);
    let nextTotal = Number(total || 0);
    if (Number.isNaN(nextTotal) || nextTotal < 0) {
      const msg = "El costo total no es válido.";
      setSaveError(msg);
      toast.error(msg);
      return;
    }
    if ((nextTotal === 0 && assigned > 0) || matchTotalToAssigned) {
      nextTotal = assigned;
      setTotal(String(assigned));
    }
    if (assigned > nextTotal + 0.01) {
      nextTotal = assigned;
      setTotal(String(assigned));
    }
    if (nextTotal <= 0 && assigned <= 0) {
      const msg = "Ingresa un costo total o al menos un aporte mayor a $0 antes de guardar.";
      setSaveError(msg);
      toast.error(msg);
      return;
    }

    setSaving(true);
    try {
      await saveRehearsalCost({
        organizationId,
        rehearsalId,
        totalAmount: nextTotal,
        description,
        collectorUserId: userId,
        collectorName: userName,
        contributions: contributorList.map((item) => ({
          musicianId: item.musicianId,
          musicianName: item.name,
          amount: Number(amounts[item.musicianId] || 0),
        })),
      });
      toast.success("Costo y aportes guardados correctamente");
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido al guardar.";
      setSaveError(message);
      toast.error("No fue posible guardar los aportes", { description: message });
    } finally {
      setSaving(false);
    }
  };

  const submitSingle = async (event: FormEvent) => {
    event.preventDefault();
    setSaveError(null);
    if (!singleMusicianId) {
      toast.error("Selecciona un músico");
      return;
    }
    const val = Number(singleAmount || 0);
    if (Number.isNaN(val) || val <= 0) {
      toast.error("Ingresa un valor válido mayor a cero");
      return;
    }
    setSavingSingle(true);
    try {
      const chosenMusician = selectableMusicians.find((m) => m.id === singleMusicianId);
      await addOrUpdateSingleContribution({
        organizationId,
        rehearsalId,
        musicianId: singleMusicianId,
        musicianName: chosenMusician?.label.replace(/\s*\(Convocado\)$/, ""),
        amount: val,
        concept: singleConcept,
        contributionDate: singleDate,
        notes: singleNotes,
        collectorUserId: userId,
        collectorName: userName,
      });
      toast.success("Aporte individual registrado");
      setSingleAmount("");
      setSingleNotes("");
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido al registrar.";
      setSaveError(message);
      toast.error("No se pudo registrar el aporte", { description: message });
    } finally {
      setSavingSingle(false);
    }
  };

  const confirm = async (id: string) => {
    setSaveError(null);
    try {
      await confirmContributionPayment(id, userId, organizationId, rehearsalId);
      toast.success("Pago confirmado", { description: "La deuda salió del listado pendiente y quedó en el historial." });
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido al confirmar.";
      setSaveError(message);
      toast.error("No se pudo confirmar el pago", { description: message });
    }
  };

  if (loading) return <div className="grid min-h-48 place-items-center"><LoaderCircle className="size-6 animate-spin text-primary" /></div>;

  if (!canManage) {
    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Summary icon={HandCoins} label="Saldo pendiente" value={money(pending.reduce((sum, item) => sum + Number(item.amount_due), 0))} tone="bg-orange-500/10 text-orange-600" />
          <Summary icon={CheckCircle2} label="Aportes pagados" value={money(paid.reduce((sum, item) => sum + Number(item.amount_due), 0))} tone="bg-emerald-500/10 text-emerald-600" />
        </div>
        <ContributionList title="Pendiente por pagar" items={pending} />
        <ContributionList title="Historial de pagos" items={paid} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {saveError && (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertCircle className="size-4" />
          <AlertTitle>No se pudo completar el guardado</AlertTitle>
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Summary icon={ReceiptText} label="Costo total" value={money(numericTotal)} tone="bg-primary/10 text-primary" />
        <Summary icon={HandCoins} label="Aportes pendientes" value={money(pending.reduce((sum, item) => sum + Number(item.amount_due), 0))} tone="bg-orange-500/10 text-orange-600" />
        <Summary icon={CheckCircle2} label="Recaudado" value={money(paid.reduce((sum, item) => sum + Number(item.amount_due), 0))} tone="bg-emerald-500/10 text-emerald-600" />
      </div>

      <Card className="rounded-[2rem] shadow-none">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h2 className="text-lg font-black">Costo y distribución del ensayo</h2>
              <p className="text-sm text-muted-foreground">Define el costo total y asigna o divide automáticamente los aportes entre los músicos convocados.</p>
            </div>
            <Button type="button" variant="outline" className="rounded-xl" onClick={split}>
              Dividir entre convocados
            </Button>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <Label>Costo total del ensayo</Label>
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">$</span>
                <Input type="number" min="0" step="1000" value={total} onChange={(event) => setTotal(event.target.value)} className="h-11 rounded-xl pl-7" />
              </div>
            </div>
            <div>
              <Label>Recauda</Label>
              <Input value={cost?.collector_name ?? userName} disabled className="mt-2 h-11 rounded-xl bg-muted" />
            </div>
            <div className="sm:col-span-2">
              <Label>Descripción / concepto del costo</Label>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 rounded-xl" placeholder="Ej. Alquiler de sala, hidratación y transporte de instrumentos" />
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border">
            <div className="grid grid-cols-[1fr_130px] bg-muted/50 px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span>Músico</span>
              <span className="text-right">Aporte (COP)</span>
            </div>
            {contributorList.length ? (
              contributorList.map((item) => (
                <div key={item.musicianId} className="grid grid-cols-[1fr_130px] items-center gap-3 border-t p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-xs font-black text-primary">
                      {item.initial}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{item.name}</p>
                      {item.paidContribution && <Badge className="mt-1 rounded-lg bg-emerald-500/10 text-[9px] text-emerald-700">PAGADO</Badge>}
                    </div>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={amounts[item.musicianId] ?? "0"}
                    disabled={Boolean(item.paidContribution)}
                    onChange={(event) => setAmounts((current) => ({ ...current, [item.musicianId]: event.target.value }))}
                    className="h-9 rounded-xl text-right"
                  />
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">No hay músicos convocados en este ensayo. Usa el formulario inferior para registrar un aporte individual o convoca músicos primero.</div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-sm font-bold ${assigned === numericTotal ? "text-emerald-600" : "text-orange-600"}`}>
              {assigned === numericTotal
                ? `Distribución completa: ${money(assigned)}`
                : assigned > numericTotal
                  ? `Asignado: ${money(assigned)} (al guardar, el costo total se ajustará a ${money(assigned)})`
                  : `Asignado: ${money(assigned)} · Diferencia sin asignar: ${money(numericTotal - assigned)}`}
            </p>
            <div className="flex flex-wrap gap-2">
              {assigned > 0 && assigned !== numericTotal && (
                <Button type="button" variant="outline" onClick={() => void save(true)} disabled={saving} className="rounded-xl font-semibold">
                  Igualar total a {money(assigned)}
                </Button>
              )}
              <Button type="button" onClick={() => void save(false)} disabled={saving} className="rounded-xl font-bold">
                {saving ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <CircleDollarSign className="mr-2 size-4" />}
                Guardar distribución
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] shadow-none">
        <CardContent className="p-5 sm:p-6">
          <h3 className="font-black">Registrar aporte individual rápido</h3>
          <p className="mt-1 text-xs text-muted-foreground">Útil cuando un músico realiza un aporte puntual sin redistribuir toda la planilla.</p>
          <form onSubmit={submitSingle} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>Músico *</Label>
              <Select value={singleMusicianId} onValueChange={setSingleMusicianId}>
                <SelectTrigger className="mt-1.5 h-10 rounded-xl"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {selectableMusicians.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Concepto</Label>
              <Input value={singleConcept} onChange={(e) => setSingleConcept(e.target.value)} className="mt-1.5 h-10 rounded-xl" />
            </div>
            <div>
              <Label>Valor (COP) *</Label>
              <Input type="number" min="1" step="1000" value={singleAmount} onChange={(e) => setSingleAmount(e.target.value)} placeholder="15000" className="mt-1.5 h-10 rounded-xl" />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} className="mt-1.5 h-10 rounded-xl" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Label>Observaciones</Label>
              <Input value={singleNotes} onChange={(e) => setSingleNotes(e.target.value)} placeholder="Ej. Aporte sala / refrigerio" className="mt-1.5 h-10 rounded-xl" />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={savingSingle} className="h-10 w-full rounded-xl font-bold">
                {savingSingle ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
                Registrar aporte
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <ContributionList title="Pendientes de pago" items={pending} onConfirm={confirm} />
      <ContributionList title="Historial confirmado" items={paid} />
    </div>
  );
}

function ContributionList({
  title,
  items,
  onConfirm,
}: {
  title: string;
  items: RehearsalCost["rehearsal_contributions"];
  onConfirm?: (id: string) => void;
}) {
  return (
    <Card className="rounded-[2rem] shadow-none">
      <CardContent className="p-0">
        <div className="border-b p-5 sm:px-6">
          <h3 className="font-black">{title}</h3>
          <p className="text-xs text-muted-foreground">{items.length} registros</p>
        </div>
        {items.length ? (
          <div className="divide-y">
            {items.map((item) => {
              const name = item.musician
                ? `${item.musician.first_name} ${item.musician.last_name}`.trim()
                : item.musician_name_snapshot || "Músico retirado";
              return (
                <div key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.status === "PAGADO" && item.paid_at
                        ? `Confirmado ${new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(item.paid_at))}`
                        : "Debe pagar al director"}
                      {item.notes ? ` · ${item.notes}` : ""}
                    </p>
                  </div>
                  <p className="text-lg font-black">{money(Number(item.amount_due))}</p>
                  {onConfirm && (
                    <Button className="rounded-xl bg-emerald-600 font-bold hover:bg-emerald-700" onClick={() => onConfirm(item.id)}>
                      <CheckCircle2 className="mr-2 size-4" /> Confirmar pago
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Clock3 className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">No hay registros en esta sección</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Summary({ icon: Icon, label, value, tone }: { icon: typeof HandCoins; label: string; value: string; tone: string }) {
  return (
    <Card className="rounded-3xl shadow-none">
      <CardContent className="flex items-center gap-4 p-5">
        <span className={`grid size-11 place-items-center rounded-2xl ${tone}`}><Icon className="size-5" /></span>
        <div>
          <p className="text-xl font-black">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}
