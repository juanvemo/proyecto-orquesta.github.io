import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, HandCoins, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import type { RehearsalCost } from "@/features/rehearsals/costs";
import { supabase } from "@/integrations/supabase/client";
import { readOrgFeatureFlag } from "@/lib/orgStore";

type Contribution = {
  id: string;
  amount_due: number;
  status: "PENDIENTE" | "PAGADO";
  paid_at: string | null;
  rehearsal_cost: { collector_name: string; rehearsal: { id: string; name: string; rehearsal_date: string } | null } | null;
};

export default function MyContributions() {
  const { membership, user } = useAuth();
  const [items, setItems] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data, error }, myMusicianRes] = await Promise.all([
      supabase
        .from("rehearsal_contributions")
        .select("id,amount_due,status,paid_at,rehearsal_cost:rehearsal_costs(collector_name,rehearsal:rehearsals(id,name,rehearsal_date))")
        .order("created_at", { ascending: false }),
      membership && user
        ? supabase.from("musicians").select("id").eq("organization_id", membership.organizationId).eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const dbRows = (!error ? (data ?? []) : []) as unknown as Contribution[];
    const merged = [...dbRows];

    if (membership && myMusicianRes.data?.id) {
      const myMusicianId = myMusicianRes.data.id;
      const fallbackMap = await readOrgFeatureFlag<Record<string, RehearsalCost>>(
        membership.organizationId,
        "rehearsal_costs_fallback",
        {},
      );
      const fallbackRehearsalIds = Object.keys(fallbackMap);
      if (fallbackRehearsalIds.length) {
        const { data: rehearsalsData } = await supabase
          .from("rehearsals")
          .select("id,name,rehearsal_date")
          .in("id", fallbackRehearsalIds);
        const rehearsalById = new Map((rehearsalsData ?? []).map((r) => [r.id, r]));
        const seenIds = new Set(merged.map((m) => m.id));
        for (const [rehearsalId, cost] of Object.entries(fallbackMap)) {
          for (const contrib of cost.rehearsal_contributions ?? []) {
            if (contrib.musician_id === myMusicianId && !seenIds.has(contrib.id)) {
              merged.push({
                id: contrib.id,
                amount_due: Number(contrib.amount_due),
                status: contrib.status,
                paid_at: contrib.paid_at,
                rehearsal_cost: {
                  collector_name: cost.collector_name,
                  rehearsal: rehearsalById.get(rehearsalId) ?? null,
                },
              });
            }
          }
        }
      }
    }

    if (error && merged.length === 0) {
      toast.error("No fue posible cargar tus aportes");
    } else {
      setItems(merged);
    }
    setLoading(false);
  }, [membership, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = items.filter((item) => item.status === "PENDIENTE");
  const paid = items.filter((item) => item.status === "PAGADO");

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Mi espacio</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Mis aportes</h1>
        <p className="mt-2 text-sm text-muted-foreground">Aportes pendientes por costos de ensayo e historial confirmado por dirección.</p>
      </div>
      {loading ? (
        <Skeleton className="h-64 rounded-[2rem]" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Summary icon={HandCoins} label="Pendiente por pagar" value={pending.reduce((sum, item) => sum + Number(item.amount_due), 0)} tone="bg-orange-500/10 text-orange-600" />
            <Summary icon={CheckCircle2} label="Pagado y confirmado" value={paid.reduce((sum, item) => sum + Number(item.amount_due), 0)} tone="bg-emerald-500/10 text-emerald-600" />
          </div>
          <ContributionSection title="Deudas pendientes" items={pending} />
          <ContributionSection title="Historial de aportes" items={paid} />
        </>
      )}
    </div>
  );
}

function ContributionSection({ title, items }: { title: string; items: Contribution[] }) {
  return (
    <Card className="rounded-[2rem] shadow-none">
      <CardContent className="p-0">
        <div className="border-b p-5 sm:px-6"><h2 className="text-lg font-black">{title}</h2></div>
        {items.length ? (
          <div className="divide-y">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-4 sm:px-6">
                <span className={`grid size-11 place-items-center rounded-2xl ${item.status === "PAGADO" ? "bg-emerald-500/10 text-emerald-600" : "bg-orange-500/10 text-orange-600"}`}>
                  {item.status === "PAGADO" ? <CheckCircle2 className="size-5" /> : <Clock3 className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{item.rehearsal_cost?.rehearsal?.name ?? "Ensayo"}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.status === "PAGADO" && item.paid_at
                      ? `Confirmado el ${new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(item.paid_at))}`
                      : `Pagar a ${item.rehearsal_cost?.collector_name ?? "Dirección"}`}
                  </p>
                </div>
                <p className="text-lg font-black">{money(Number(item.amount_due))}</p>
                <Badge className={`rounded-lg ${item.status === "PAGADO" ? "bg-emerald-500/10 text-emerald-700" : "bg-orange-500/10 text-orange-700"}`}>{item.status}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center">
            <ReceiptText className="mx-auto size-8 text-primary" />
            <p className="mt-3 font-bold">No hay registros</p>
            <p className="text-sm text-muted-foreground">Los aportes confirmados desaparecen de pendientes y permanecen aquí como historial.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Summary({ icon: Icon, label, value, tone }: { icon: typeof HandCoins; label: string; value: number; tone: string }) {
  return (
    <Card className="rounded-3xl shadow-none">
      <CardContent className="flex items-center gap-4 p-5">
        <span className={`grid size-11 place-items-center rounded-2xl ${tone}`}><Icon className="size-5" /></span>
        <div>
          <p className="text-2xl font-black">{money(value)}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}
