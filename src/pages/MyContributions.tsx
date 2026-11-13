import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock3, HandCoins, ReceiptText, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoidContributionButton } from "@/components/contributions/VoidContributionButton";
import { useAuth } from "@/contexts/AuthContext";
import { contributionErrorMessage } from "@/features/rehearsals/costs";
import { supabase } from "@/integrations/supabase/client";

type Contribution = {
  id: string;
  amount_due: number;
  status: "PENDIENTE" | "PAGADO";
  paid_at: string | null;
  contribution_date: string | null;
  notes: string | null;
  payer_name: string;
  collector_name: string;
  own_contribution: boolean | null;
  rehearsal_name: string;
  rehearsal_date: string;
  description: string | null;
};
type Flows = { outgoing: Contribution[]; incoming: Contribution[] };

export default function MyContributions() {
  const { membership } = useAuth();
  const organizationId = membership?.organizationId;
  const [flows, setFlows] = useState<Flows>({ outgoing: [], incoming: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState(membership?.roleCode === "ADMIN" ? "incoming" : "outgoing");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFlows({ outgoing: [], incoming: [] });
    if (!organizationId) { setLoading(false); return; }
    try {
      const { data, error: queryError } = await supabase.rpc("get_my_contribution_flows", { target_organization_id: organizationId });
      if (queryError) throw queryError;
      setFlows(data as unknown as Flows);
    } catch (queryError) {
      setError(contributionErrorMessage(queryError));
    } finally {
      setLoading(false);
    }
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  const outgoingPending = flows.outgoing.filter((item) => item.status === "PENDIENTE");
  const outgoingPaid = flows.outgoing.filter((item) => item.status === "PAGADO");
  const incomingPending = flows.incoming.filter((item) => item.status === "PENDIENTE");
  const incomingPaid = flows.incoming.filter((item) => item.status === "PAGADO");

  return <div className="space-y-6 animate-in fade-in duration-300">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Mi espacio · Pagos y cobros</p><h1 className="mt-2 text-3xl font-black tracking-tight">Mis aportes</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Tus aportes personales y lo que otros músicos te pagan como recaudador, sin mezclar ambos movimientos.</p></div>
      <Button variant="outline" className="w-fit shrink-0 rounded-xl" disabled={loading} onClick={() => void load()}><RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} /> Actualizar</Button>
    </div>
    {loading ? <Skeleton className="h-72 rounded-[2rem]" /> : error ? <Card className="rounded-3xl border-orange-300 shadow-none"><CardContent className="space-y-3 p-6"><h2 className="font-black">No se pudieron consultar tus movimientos</h2><p className="break-words text-sm text-muted-foreground">{error}</p><Button onClick={() => void load()} className="rounded-xl">Reintentar</Button></CardContent></Card> : organizationId ? <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary icon={ArrowUpRight} label="Tengo por pagar" items={outgoingPending} tone="bg-orange-500/10 text-orange-700" />
        <Summary icon={CheckCircle2} label="Yo he pagado" items={outgoingPaid} tone="bg-primary/10 text-primary" />
        <Summary icon={Clock3} label="Me deben pagar" items={incomingPending} tone="bg-orange-500/10 text-orange-700" />
        <Summary icon={ArrowDownLeft} label="He recibido" items={incomingPaid} tone="bg-emerald-500/10 text-emerald-700" />
      </div>
      <Tabs value={direction} onValueChange={setDirection} className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-muted/60 p-1.5 sm:max-w-md">
          <TabsTrigger value="outgoing" className="gap-2 rounded-xl px-3 py-3 font-bold"><ArrowUpRight className="size-4" /> Yo pago</TabsTrigger>
          <TabsTrigger value="incoming" className="gap-2 rounded-xl px-3 py-3 font-bold"><ArrowDownLeft className="size-4" /> Me pagan</TabsTrigger>
        </TabsList>
        <TabsContent value="outgoing" className="space-y-5"><p className="text-sm text-muted-foreground">Solo aparecen los aportes asignados a tu ficha de músico. Ser Administrador no convierte los aportes de todos en deudas tuyas.</p><ContributionSection title="Mis aportes por pagar" direction="outgoing" items={outgoingPending} organizationId={organizationId} onChanged={load} /><ContributionSection title="Mis aportes pagados" direction="outgoing" items={outgoingPaid} organizationId={organizationId} onChanged={load} /></TabsContent>
        <TabsContent value="incoming" className="space-y-5"><p className="text-sm text-muted-foreground">Aportes de otros músicos en los ensayos donde figuras como recaudador. Solo los confirmados se suman a «He recibido»; tu aporte propio no se cuenta como dinero recibido.</p><ContributionSection title="Pendiente de recibir" direction="incoming" items={incomingPending} organizationId={organizationId} onChanged={load} /><ContributionSection title="Pagos recibidos y confirmados" direction="incoming" items={incomingPaid} organizationId={organizationId} onChanged={load} /></TabsContent>
      </Tabs>
    </> : <p className="text-sm text-muted-foreground">Se necesita una organización activa para consultar tus aportes.</p>}
  </div>;
}

function ContributionSection({ title, direction, items, organizationId, onChanged }: { title: string; direction: "incoming" | "outgoing"; items: Contribution[]; organizationId: string; onChanged: () => Promise<void> }) {
  return <Card className="overflow-hidden rounded-[2rem] shadow-none"><CardContent className="p-0">
    <div className="flex items-center justify-between gap-3 border-b p-5 sm:px-6"><h2 className="text-lg font-black">{title}</h2><Badge variant="outline" className="shrink-0 rounded-lg">{items.length} registros</Badge></div>
    {items.length ? <div className="divide-y">{items.map((item) => <div key={item.id} className="space-y-3 p-4 sm:px-6">
      <div className="flex items-start gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${item.status === "PAGADO" ? "bg-emerald-500/10 text-emerald-700" : "bg-orange-500/10 text-orange-700"}`}>{direction === "incoming" ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}</span>
        <div className="min-w-0 flex-1"><p className="break-words font-bold">{item.rehearsal_name}</p><p className="mt-1 text-sm font-semibold text-primary">{direction === "incoming" ? `De: ${item.payer_name}` : item.own_contribution ? "Aporte propio al costo del ensayo" : `A: ${item.collector_name}`}</p>{item.description && <p className="mt-1 break-words text-xs text-muted-foreground">{item.description}</p>}<p className="mt-1 text-xs text-muted-foreground">{item.status === "PAGADO" && item.paid_at ? `Pago confirmado el ${new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" }).format(new Date(item.paid_at))}` : item.contribution_date ? `Fecha del aporte: ${item.contribution_date}` : "Pendiente de confirmación"}</p></div>
      </div>
      {item.notes && <p className="whitespace-pre-wrap break-words rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">{item.notes}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-3"><p className="text-xl font-black">{money(Number(item.amount_due))}</p><Badge className={`rounded-lg ${item.status === "PAGADO" ? "bg-emerald-500/10 text-emerald-800" : "bg-orange-500/10 text-orange-800"}`}>{item.status === "PAGADO" ? direction === "incoming" ? "RECIBIDO" : "PAGADO" : "PENDIENTE"}</Badge></div><VoidContributionButton organizationId={organizationId} contributionId={item.id} label={`${item.rehearsal_name} · ${item.payer_name}`} amount={Number(item.amount_due)} status={item.status} onVoided={onChanged} /></div>
    </div>)}</div> : <div className="p-8 text-center sm:p-10"><ReceiptText className="mx-auto size-8 text-primary" /><p className="mt-3 font-bold">No hay aportes en esta sección</p><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{direction === "incoming" ? "Aquí verás lo que otros músicos deben entregarte o ya te pagaron cuando seas el recaudador registrado." : "Aquí verás únicamente tus aportes personales, pendientes o confirmados."}</p></div>}
  </CardContent></Card>;
}

function Summary({ icon: Icon, label, items, tone }: { icon: typeof HandCoins; label: string; items: Contribution[]; tone: string }) {
  return <Card className="rounded-3xl shadow-none"><CardContent className="flex items-center gap-3 p-5"><span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${tone}`}><Icon className="size-5" /></span><div className="min-w-0"><p className="break-words text-xl font-black">{money(items.reduce((sum, item) => sum + Number(item.amount_due), 0))}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div></CardContent></Card>;
}
function money(value: number) { return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 }).format(value); }
