import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  HandCoins,
  Landmark,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Undo2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { AccountDialog, BudgetDialog, TransactionDialog } from "@/features/finances/FinanceDialogs";
import {
  deleteBudgetItem,
  loadFinanceContext,
  loadRehearsalReceivables,
  setRehearsalContributionStatus,
  updateTransactionStatus,
} from "@/features/finances/service";
import type { FinanceContext, RehearsalReceivable } from "@/features/finances/types";

const empty: FinanceContext = { accounts: [], transactions: [], events: [], clients: [], musicians: [], rehearsal_contributions: { paid: 0, pending: 0 } };

export default function Finances() {
  const { membership, session } = useAuth();
  const [data, setData] = useState(empty);
  const [rehearsalReceivables, setRehearsalReceivables] = useState<RehearsalReceivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [budgetEvent, setBudgetEvent] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!membership) return;
    setLoading(true);
    try {
      const [context, contributions] = await Promise.all([
        loadFinanceContext(membership.organizationId),
        loadRehearsalReceivables(membership.organizationId),
      ]);
      setData(context);
      setRehearsalReceivables(contributions);
    } catch (error) {
      toast.error("No fue posible cargar Finanzas", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [membership]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => {
    const paid = data.transactions.filter((item) => item.status === "PAGADO");
    const income = paid.filter((item) => item.transaction_type !== "EGRESO").reduce((sum, item) => sum + Number(item.amount), 0);
    const expense = paid.filter((item) => item.transaction_type === "EGRESO").reduce((sum, item) => sum + Number(item.amount), 0);
    const financialPending = data.transactions.filter((item) => item.status === "PENDIENTE" && item.transaction_type === "CUENTA POR COBRAR").reduce((sum, item) => sum + Number(item.amount), 0);
    const rehearsalPending = rehearsalReceivables.filter((item) => item.status === "PENDIENTE").reduce((sum, item) => sum + Number(item.amount_due), 0);
    return { income, expense, profit: income - expense, receivable: financialPending + rehearsalPending, financialPending, rehearsalPending };
  }, [data.transactions, rehearsalReceivables]);

  const filtered = data.transactions.filter((item) => `${item.concept} ${item.category} ${item.event_name ?? ""} ${item.client_name ?? ""} ${item.musician_name ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const transactionReceivables = data.transactions.filter((item) => item.transaction_type === "CUENTA POR COBRAR");

  const changeTransactionStatus = async (id: string, status: "PAGADO" | "PENDIENTE" | "CANCELADO") => {
    setUpdating(id);
    try {
      await updateTransactionStatus(id, status);
      toast.success(status === "PAGADO" ? "Pago confirmado" : "Estado actualizado");
      await load();
    } catch (error) {
      toast.error("No se pudo actualizar el cobro", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setUpdating(null);
    }
  };

  const changeContributionStatus = async (id: string, status: "PAGADO" | "PENDIENTE") => {
    setUpdating(id);
    try {
      await setRehearsalContributionStatus(id, status);
      toast.success(status === "PAGADO" ? "Aporte de ensayo confirmado" : "Aporte regresado a pendiente");
      await load();
    } catch (error) {
      toast.error("No se pudo actualizar el aporte", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setUpdating(null);
    }
  };

  if (!membership || !session) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-primary">Fase 8 · Control financiero</p>
          <h1 className="mt-2 text-3xl font-black">Finanzas</h1>
          <p className="mt-2 text-sm text-muted-foreground">Cuentas, movimientos, cobros de eventos y aportes de ensayos en un solo lugar.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => setAccountOpen(true)} className="rounded-xl"><Landmark className="mr-2 size-4" />Nueva cuenta</Button>
          <Button onClick={() => setTransactionOpen(true)} className="rounded-xl font-black"><Plus className="mr-2 size-4" />Nuevo movimiento</Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28 rounded-3xl" />)}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={ArrowUpRight} label="Ingresos recibidos" value={totals.income} tone="bg-emerald-500/10 text-emerald-700" />
          <Metric icon={ArrowDownRight} label="Egresos pagados" value={totals.expense} tone="bg-rose-500/10 text-rose-700" />
          <Metric icon={TrendingUp} label="Utilidad real" value={totals.profit} tone={totals.profit >= 0 ? "bg-blue-500/10 text-blue-700" : "bg-orange-500/10 text-orange-700"} />
          <Metric icon={CalendarClock} label="Total pendiente por cobrar" value={totals.receivable} tone="bg-amber-500/10 text-amber-700" />
        </div>
      )}

      <Tabs defaultValue="receivables" className="space-y-5">
        <TabsList className="h-auto max-w-full justify-start overflow-x-auto rounded-2xl p-1.5">
          <TabsTrigger value="receivables" className="rounded-xl">Cuentas por cobrar</TabsTrigger>
          <TabsTrigger value="movements" className="rounded-xl">Movimientos</TabsTrigger>
          <TabsTrigger value="budgets" className="rounded-xl">Presupuestos</TabsTrigger>
          <TabsTrigger value="accounts" className="rounded-xl">Cuentas</TabsTrigger>
        </TabsList>

        <TabsContent value="receivables" className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <ReceivableSummary label="Cobros generales pendientes" value={totals.financialPending} icon={WalletCards} />
            <ReceivableSummary label="Aportes de ensayos pendientes" value={totals.rehearsalPending} icon={HandCoins} />
          </div>
          <ReceivableSection
            title="Cobros generales y de eventos"
            description="Confirma anticipos, saldos de eventos y otros cobros registrados."
            empty="No hay cuentas por cobrar generales."
          >
            {transactionReceivables.map((item) => (
              <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:px-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><p className="font-black">{item.concept}</p><Status status={item.status} /></div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.event_name || item.client_name || item.musician_name || "Cobro general"} · creado {date(item.transaction_date)}{item.due_date ? ` · vence ${date(item.due_date)}` : ""}</p>
                </div>
                <strong className="text-emerald-700">{money(item.amount)}</strong>
                <PaymentActions id={item.id} status={item.status} updating={updating} onChange={changeTransactionStatus} allowCancel />
              </div>
            ))}
          </ReceivableSection>
          <ReceivableSection
            title="Aportes de ensayos"
            description="Gestiona directamente lo que cada músico debe aportar por ensayo."
            empty="No hay aportes de ensayos registrados."
          >
            {rehearsalReceivables.map((item) => (
              <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:px-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><p className="font-black">{item.musician_name}</p><Status status={item.status} /></div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.rehearsal_name} · {date(item.rehearsal_date)} · recauda {item.collector_name}</p>
                </div>
                <strong className="text-amber-700">{money(item.amount_due)}</strong>
                <PaymentActions id={item.id} status={item.status} updating={updating} onChange={changeContributionStatus} />
              </div>
            ))}
          </ReceivableSection>
        </TabsContent>

        <TabsContent value="movements">
          <Card className="overflow-hidden rounded-[2rem] shadow-none">
            <div className="border-b p-4"><div className="relative max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar movimiento, evento o tercero…" className="rounded-xl pl-9" /></div></div>
            <CardContent className="p-0">
              {filtered.length ? <div className="divide-y">{filtered.map((item) => (
                <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center sm:px-6">
                  <span className={`grid size-10 place-items-center rounded-xl ${item.transaction_type === "EGRESO" ? "bg-rose-500/10 text-rose-700" : "bg-emerald-500/10 text-emerald-700"}`}>{item.transaction_type === "EGRESO" ? <ArrowDownRight className="size-4" /> : <ArrowUpRight className="size-4" />}</span>
                  <div><p className="font-black">{item.concept}</p><p className="text-xs text-muted-foreground">{item.category} · {item.event_name || item.client_name || item.musician_name || "Movimiento general"} · {date(item.transaction_date)}</p></div>
                  <div className="text-right"><p className={`font-black ${item.transaction_type === "EGRESO" ? "text-rose-600" : "text-emerald-600"}`}>{item.transaction_type === "EGRESO" ? "−" : "+"}{money(item.amount)}</p><p className="text-[10px] text-muted-foreground">{item.account_name || "Sin cuenta"}</p></div>
                  <Status status={item.status} />
                </div>
              ))}</div> : <Empty text="Aún no hay movimientos financieros." />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budgets">
          <div className="grid gap-4 lg:grid-cols-2">
            {data.events.map((event) => {
              const estimatedIncome = event.budget_items.filter((item) => item.item_type === "INGRESO").reduce((sum, item) => sum + Number(item.estimated_amount), 0) || Number(event.contracted_value);
              const estimatedExpense = event.budget_items.filter((item) => item.item_type === "EGRESO").reduce((sum, item) => sum + Number(item.estimated_amount), 0);
              const expected = estimatedIncome - estimatedExpense;
              const actual = Number(event.actual_income) - Number(event.actual_expense);
              return <Card key={event.id} className="rounded-[2rem] shadow-none"><CardContent className="p-5">
                <div className="flex items-start justify-between gap-3"><div><Badge variant="outline" className="rounded-lg">{event.status}</Badge><h2 className="mt-3 text-lg font-black">{event.name}</h2><p className="text-xs text-muted-foreground">{event.client_name} · {date(event.event_date)}</p></div><Button size="sm" onClick={() => setBudgetEvent(event.id)} className="rounded-xl"><Plus className="mr-1 size-3" />Partida</Button></div>
                <div className="mt-5 grid grid-cols-2 gap-3"><Value label="Utilidad estimada" value={expected} /><Value label="Utilidad real" value={actual} /></div>
                <Progress value={estimatedIncome ? Math.max(0, Math.min(100, actual / estimatedIncome * 100)) : 0} className="mt-4 h-2" />
                <div className="mt-4 space-y-2">{event.budget_items.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-xl bg-muted/40 p-3 text-sm"><span className={item.item_type === "EGRESO" ? "text-rose-600" : "text-emerald-600"}>{item.item_type === "EGRESO" ? "−" : "+"}</span><span className="flex-1 font-semibold">{item.description}</span><strong>{money(item.estimated_amount)}</strong><button onClick={() => void deleteBudgetItem(item.id).then(load)} className="text-destructive" aria-label="Eliminar partida"><Trash2 className="size-4" /></button></div>)}</div>
              </CardContent></Card>;
            })}
            {!data.events.length && <Empty text="Los eventos aparecerán aquí para presupuestar." />}
          </div>
        </TabsContent>

        <TabsContent value="accounts">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.accounts.map((account) => <Card key={account.id} className="rounded-[2rem] shadow-none"><CardContent className="p-5"><div className="flex justify-between"><span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Landmark className="size-5" /></span><Badge variant="outline" className="h-fit rounded-lg">{account.account_type}</Badge></div><p className="mt-5 font-black">{account.name}</p><p className="mt-2 text-2xl font-black text-primary">{money(account.balance)}</p><p className="text-xs text-muted-foreground">Saldo disponible</p></CardContent></Card>)}</div>
          {!data.accounts.length && <Empty text="Crea una cuenta para controlar caja, banco o billetera." />}
        </TabsContent>
      </Tabs>

      <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} organizationId={membership.organizationId} userId={session.user.id} onSaved={() => void load()} />
      <TransactionDialog open={transactionOpen} onOpenChange={setTransactionOpen} organizationId={membership.organizationId} userId={session.user.id} context={data} onSaved={() => void load()} />
      <BudgetDialog open={Boolean(budgetEvent)} onOpenChange={(open) => { if (!open) setBudgetEvent(null); }} organizationId={membership.organizationId} userId={session.user.id} eventId={budgetEvent ?? ""} onSaved={() => void load()} />
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof CircleDollarSign; label: string; value: number; tone: string }) { return <Card className="rounded-3xl shadow-none"><CardContent className="flex items-center gap-4 p-5"><span className={`grid size-11 place-items-center rounded-2xl ${tone}`}><Icon className="size-5" /></span><div><p className="text-xl font-black">{money(value)}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>; }
function ReceivableSummary({ icon: Icon, label, value }: { icon: typeof WalletCards; label: string; value: number }) { return <Card className="rounded-3xl border-amber-500/20 bg-amber-500/[0.04] shadow-none"><CardContent className="flex items-center gap-4 p-5"><span className="grid size-11 place-items-center rounded-2xl bg-amber-500/10 text-amber-700"><Icon className="size-5" /></span><div><p className="text-xl font-black">{money(value)}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>; }
function ReceivableSection({ title, description, empty, children }: { title: string; description: string; empty: string; children: React.ReactNode }) { const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children); return <Card className="overflow-hidden rounded-[2rem] shadow-none"><div className="border-b p-5 sm:px-6"><h2 className="font-black">{title}</h2><p className="text-xs text-muted-foreground">{description}</p></div><CardContent className="p-0">{hasChildren ? <div className="divide-y">{children}</div> : <Empty text={empty} />}</CardContent></Card>; }
function PaymentActions({ id, status, updating, onChange, allowCancel = false }: { id: string; status: string; updating: string | null; onChange: (id: string, status: any) => Promise<void>; allowCancel?: boolean }) { if (status === "PENDIENTE") return <div className="flex gap-2"><Button size="sm" disabled={updating === id} onClick={() => void onChange(id, "PAGADO")} className="rounded-xl bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="mr-1 size-3" />Confirmar</Button>{allowCancel && <Button size="sm" variant="outline" disabled={updating === id} onClick={() => void onChange(id, "CANCELADO")} className="rounded-xl">Cancelar</Button>}</div>; return <Button size="sm" variant="outline" disabled={updating === id} onClick={() => void onChange(id, "PENDIENTE")} className="rounded-xl"><Undo2 className="mr-1 size-3" />Reabrir</Button>; }
function Status({ status }: { status: string }) { return <Badge className={`w-fit rounded-lg ${status === "PAGADO" ? "bg-emerald-500/10 text-emerald-700" : status === "PENDIENTE" ? "bg-amber-500/10 text-amber-700" : "bg-slate-500/10 text-slate-700"}`}>{status}</Badge>; }
function Value({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl bg-muted/45 p-3"><p className={`font-black ${value < 0 ? "text-rose-600" : "text-emerald-600"}`}>{money(value)}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="p-10 text-center"><WalletCards className="mx-auto size-9 text-primary" /><p className="mt-3 text-sm text-muted-foreground">{text}</p></div>; }
function money(value: number) { return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value); }
function date(value: string) { return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`)); }
