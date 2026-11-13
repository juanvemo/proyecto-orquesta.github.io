import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Eye,
  FileDown,
  FileSignature,
  LoaderCircle,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildDefaultClauses,
  listContracts,
  listEventsAndClientsForContracts,
  saveContract,
  updateContractStatus,
} from "@/features/contracts/service";
import type {
  ContractClause,
  ContractClientSummary,
  ContractEventSummary,
  ContractRecord,
  ContractStatus,
} from "@/features/contracts/types";
import { usePublicIdentity } from "@/hooks/usePublicIdentity";
import { assetUrl } from "@/lib/assets";

const STATUS_STYLE: Record<ContractStatus, string> = {
  BORRADOR: "bg-slate-500/10 text-slate-700",
  ENVIADO: "bg-blue-500/10 text-blue-700",
  FIRMADO: "bg-emerald-500/10 text-emerald-700",
  ANULADO: "bg-rose-500/10 text-rose-700",
};

export default function Contracts() {
  const { membership, session } = useAuth();
  const { identity } = usePublicIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const eventoParam = searchParams.get("evento");

  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [events, setEvents] = useState<Array<ContractEventSummary & { id: string; status: string }>>([]);
  const [clients, setClients] = useState<Array<ContractClientSummary & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ContractRecord | null>(null);
  const [previewing, setPreviewing] = useState<ContractRecord | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState("Contrato de prestación de servicios musicales");
  const [contractNumber, setContractNumber] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string>("none");
  const [selectedClientId, setSelectedClientId] = useState<string>("none");
  const [totalAmount, setTotalAmount] = useState(0);
  const [depositAmount, setDepositAmount] = useState(0);
  const [bodyText, setBodyText] = useState("");
  const [clauses, setClauses] = useState<ContractClause[]>([]);

  const load = useCallback(async () => {
    if (!membership) return;
    setLoading(true);
    try {
      const [rows, refs] = await Promise.all([
        listContracts(membership.organizationId),
        listEventsAndClientsForContracts(membership.organizationId),
      ]);
      setContracts(rows);
      setEvents(refs.events);
      setClients(refs.clients);
    } catch (error) {
      toast.error("No fue posible cargar contratos", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [membership]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyEventTemplate = useCallback(
    (eventId: string, clientList = clients, eventList = events) => {
      const ev = eventList.find((e) => e.id === eventId);
      if (!ev) return;
      const cl = ev.client_id ? clientList.find((c) => c.id === ev.client_id) : undefined;
      if (cl) setSelectedClientId(cl.id);
      const total = Number(ev.agreed_amount ?? 0);
      const deposit = Number(ev.deposit_amount ?? 0);
      setTotalAmount(total);
      setDepositAmount(deposit);
      setTitle(`Contrato artístico — ${ev.name}`);
      setBodyText(
        `Entre ${identity.name}, en adelante LA ORQUESTA, y ${cl?.full_name || "EL CONTRATANTE"}${cl?.nit ? ` (Doc/NIT ${cl.nit})` : ""}, se celebra el presente contrato para la presentación musical en el evento "${ev.name}" el día ${formatDate(ev.event_date)} en ${ev.venue || ev.city || "el lugar acordado"}.`,
      );
      setClauses(
        buildDefaultClauses({
          orgName: identity.name,
          eventName: ev.name,
          eventDate: formatDate(ev.event_date),
          venue: `${ev.venue || ""} ${ev.city ? `(${ev.city})` : ""}`.trim(),
          totalAmount: total,
          depositAmount: deposit,
        }),
      );
    },
    [clients, events, identity.name],
  );

  const openNewContract = useCallback(
    (preselectedEventId?: string) => {
      setEditing(null);
      setContractNumber(`CTR-${new Date().getFullYear()}-${String(contracts.length + 1).padStart(3, "0")}`);
      if (preselectedEventId) {
        setSelectedEventId(preselectedEventId);
        applyEventTemplate(preselectedEventId);
      } else {
        setSelectedEventId("none");
        setSelectedClientId("none");
        setTotalAmount(0);
        setDepositAmount(0);
        setTitle("Contrato de prestación de servicios musicales");
        setBodyText(
          `Entre ${identity.name}, en adelante LA ORQUESTA, y EL CONTRATANTE, se suscribe el presente contrato de prestación de servicios musicales bajo las siguientes cláusulas.`,
        );
        setClauses(buildDefaultClauses({ orgName: identity.name }));
      }
      setEditorOpen(true);
    },
    [applyEventTemplate, contracts.length, identity.name],
  );

  useEffect(() => {
    if (!eventoParam || loading || !events.length) return;
    const existingForEvent = contracts.find((c) => c.event_id === eventoParam);
    if (existingForEvent) {
      setPreviewing(existingForEvent);
    } else {
      openNewContract(eventoParam);
    }
    setSearchParams((prev) => {
      prev.delete("evento");
      return prev;
    }, { replace: true });
  }, [eventoParam, loading, events.length, contracts, openNewContract, setSearchParams]);

  const openEditContract = (contract: ContractRecord) => {
    setEditing(contract);
    setContractNumber(contract.contract_number);
    setTitle(contract.title);
    setSelectedEventId(contract.event_id ?? "none");
    setSelectedClientId(contract.client_id ?? "none");
    setTotalAmount(contract.total_amount);
    setDepositAmount(contract.deposit_amount);
    setBodyText(contract.body_text);
    setClauses(contract.clauses.length ? contract.clauses : buildDefaultClauses({ orgName: identity.name }));
    setEditorOpen(true);
  };

  const handleSave = async (nextStatus: ContractStatus) => {
    if (!membership || !session) return;
    if (!title.trim()) {
      toast.error("El título del contrato es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const eventObj = selectedEventId !== "none" ? events.find((e) => e.id === selectedEventId) ?? null : null;
      const clientObj = selectedClientId !== "none" ? clients.find((c) => c.id === selectedClientId) ?? null : null;
      const balance = Math.max(0, Number(totalAmount) - Number(depositAmount));
      const saved = await saveContract(
        membership.organizationId,
        session.user.id,
        {
          id: editing?.id,
          contract_number: contractNumber,
          client_id: clientObj?.id ?? null,
          quote_id: eventObj?.quote_id ?? null,
          event_id: eventObj?.id ?? null,
          title,
          status: nextStatus,
          total_amount: totalAmount,
          deposit_amount: depositAmount,
          balance_amount: balance,
          clauses,
          body_text: bodyText,
        },
        clientObj,
        eventObj,
      );
      toast.success(
        nextStatus === "ENVIADO"
          ? "Contrato guardado y listo para firma"
          : "Borrador de contrato guardado",
      );
      setEditorOpen(false);
      await load();
      if (nextStatus === "ENVIADO") {
        setPreviewing(saved);
      }
    } catch (error) {
      toast.error("No fue posible guardar el contrato", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const copySigningLink = async (contract: ContractRecord) => {
    const usesHash = window.location.hash.startsWith("#/");
    const url = usesHash
      ? `${window.location.origin}${window.location.pathname}#/contrato/${contract.public_token}`
      : `${window.location.origin}/contrato/${contract.public_token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Enlace público de firma copiado");
  };

  const filtered = useMemo(
    () =>
      contracts.filter((c) => {
        if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
        const text = `${c.contract_number} ${c.title} ${c.client?.full_name ?? ""} ${c.event?.name ?? ""} ${c.signer_name ?? ""}`.toLowerCase();
        return text.includes(query.toLowerCase());
      }),
    [contracts, query, statusFilter],
  );

  const signedCount = contracts.filter((c) => c.status === "FIRMADO").length;
  const sentCount = contracts.filter((c) => c.status === "ENVIADO").length;
  const signedTotal = contracts.filter((c) => c.status === "FIRMADO").reduce((acc, c) => acc + Number(c.total_amount || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-primary">Gestión Comercial</p>
          <h1 className="mt-2 text-3xl font-black">Contratos y Firma Digital</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Genera contratos automáticamente desde eventos o pagos confirmados y envía un enlace público para que el cliente los firme digitalmente.
          </p>
        </div>
        <Button onClick={() => openNewContract()} className="h-11 rounded-2xl font-black">
          <Plus className="mr-2 size-4" />
          Nuevo contrato
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total contratos" value={String(contracts.length)} />
        <KpiCard label="Pendientes de firma" value={String(sentCount)} tone="text-blue-700" />
        <KpiCard label="Contratos firmados" value={String(signedCount)} tone="text-emerald-700" />
        <KpiCard label="Valor contratado" value={money(signedTotal)} tone="text-primary" />
      </div>

      <Card className="rounded-[2rem] shadow-none">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por número, evento, cliente o firmante…"
              className="rounded-xl pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full rounded-xl sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los estados</SelectItem>
              <SelectItem value="BORRADOR">Borradores</SelectItem>
              <SelectItem value="ENVIADO">Enviados</SelectItem>
              <SelectItem value="FIRMADO">Firmados</SelectItem>
              <SelectItem value="ANULADO">Anulados</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-52 rounded-[2rem]" />
          ))}
        </div>
      ) : filtered.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((contract) => (
            <Card key={contract.id} className="rounded-[2rem] shadow-none">
              <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-primary">
                        {contract.contract_number} · v{contract.version}
                      </p>
                      <h2 className="mt-1 text-lg font-black">{contract.title}</h2>
                    </div>
                    <Badge className={`rounded-lg ${STATUS_STYLE[contract.status]}`}>{contract.status}</Badge>
                  </div>

                  <div className="mt-4 grid gap-2 rounded-2xl bg-muted/40 p-3.5 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Cliente</p>
                      <p className="font-bold">{contract.client?.full_name || "Sin cliente"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Evento</p>
                      <p className="font-bold">{contract.event?.name || "Contrato independiente"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Valor total</p>
                      <p className="font-black text-primary">{money(contract.total_amount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Anticipo / Saldo</p>
                      <p className="font-semibold">
                        {money(contract.deposit_amount)} / {money(contract.balance_amount)}
                      </p>
                    </div>
                  </div>

                  {contract.status === "FIRMADO" && contract.signer_name && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs font-bold text-emerald-700">
                      <ShieldCheck className="size-4 shrink-0" />
                      <span>
                        Firmado por {contract.signer_name} ·{" "}
                        {contract.signed_at ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(contract.signed_at)) : ""}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 border-t pt-3">
                  <Button variant="outline" size="sm" onClick={() => setPreviewing(contract)} className="rounded-xl">
                    <Eye className="mr-1.5 size-3.5" />
                    Ver documento
                  </Button>
                  {contract.status !== "FIRMADO" && contract.status !== "ANULADO" && (
                    <Button variant="outline" size="sm" onClick={() => openEditContract(contract)} className="rounded-xl">
                      Editar
                    </Button>
                  )}
                  {contract.status !== "ANULADO" && (
                    <Button
                      size="sm"
                      variant={contract.status === "FIRMADO" ? "outline" : "default"}
                      onClick={() => void copySigningLink(contract)}
                      className="rounded-xl font-bold"
                    >
                      <Copy className="mr-1.5 size-3.5" />
                      Copiar enlace de firma
                    </Button>
                  )}
                  {contract.status === "BORRADOR" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        if (!membership || !session) return;
                        await updateContractStatus(membership.organizationId, session.user.id, contract.id, "ENVIADO");
                        toast.success("Contrato marcado como enviado");
                        void load();
                      }}
                      className="rounded-xl"
                    >
                      <Send className="mr-1.5 size-3.5" />
                      Enviar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="rounded-[2rem] shadow-none">
          <CardContent className="p-12 text-center">
            <FileSignature className="mx-auto size-11 text-primary" />
            <p className="mt-4 text-lg font-black">No hay contratos registrados</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crea el primer contrato vinculado a un evento o pago confirmado para enviarlo a firma digital.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[2rem] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">
              {editing ? `Editar contrato ${editing.contract_number}` : "Generar nuevo contrato"}
            </DialogTitle>
            <DialogDescription>
              Vincula un evento confirmado para autocompletar cliente, fecha, lugar y valores del anticipo.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void handleSave("ENVIADO");
            }}
            className="mt-3 space-y-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Vincular evento (autocompletado)</Label>
                <Select
                  value={selectedEventId}
                  onValueChange={(val) => {
                    setSelectedEventId(val);
                    if (val !== "none") applyEventTemplate(val);
                  }}
                >
                  <SelectTrigger className="mt-2 rounded-xl">
                    <SelectValue placeholder="Selecciona un evento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Contrato independiente</SelectItem>
                    {events.map((ev) => (
                      <SelectItem key={ev.id} value={ev.id}>
                        {ev.name} ({ev.event_date})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cliente contratante</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="mt-2 rounded-xl">
                    <SelectValue placeholder="Selecciona un cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin cliente seleccionado</SelectItem>
                    {clients.map((cl) => (
                      <SelectItem key={cl.id} value={cl.id}>
                        {cl.full_name} {cl.company ? `· ${cl.company}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Número de contrato</Label>
                <Input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} className="mt-2 rounded-xl" required />
              </div>
              <div>
                <Label>Título del documento</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 rounded-xl" required />
              </div>
              <div>
                <Label>Valor total (COP)</Label>
                <Input
                  type="number"
                  min={0}
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(Number(e.target.value))}
                  className="mt-2 rounded-xl"
                />
              </div>
              <div>
                <Label>Anticipo abonado / requerido (COP)</Label>
                <Input
                  type="number"
                  min={0}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(Number(e.target.value))}
                  className="mt-2 rounded-xl"
                />
              </div>
            </div>

            <div>
              <Label>Encabezado / comparecencia</Label>
              <Textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className="mt-2 min-h-24 rounded-xl"
              />
            </div>

            <div className="space-y-3 rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-base font-black">Cláusulas del contrato</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setClauses((prev) => [
                      ...prev,
                      { id: crypto.randomUUID(), title: `CLÁUSULA ${prev.length + 1}`, content: "" },
                    ])
                  }
                  className="rounded-xl"
                >
                  <Plus className="mr-1.5 size-3.5" />
                  Agregar cláusula
                </Button>
              </div>
              {clauses.map((clause, index) => (
                <div key={clause.id} className="space-y-2 rounded-xl bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={clause.title}
                      onChange={(e) =>
                        setClauses((prev) =>
                          prev.map((c) => (c.id === clause.id ? { ...c, title: e.target.value } : c)),
                        )
                      }
                      placeholder={`Título cláusula ${index + 1}`}
                      className="rounded-lg bg-background font-bold"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setClauses((prev) => prev.filter((c) => c.id !== clause.id))}
                      className="shrink-0 text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <Textarea
                    value={clause.content}
                    onChange={(e) =>
                      setClauses((prev) =>
                        prev.map((c) => (c.id === clause.id ? { ...c, content: e.target.value } : c)),
                      )
                    }
                    placeholder="Redacción de la cláusula…"
                    className="min-h-20 rounded-lg bg-background"
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" disabled={saving} onClick={() => void handleSave("BORRADOR")} className="rounded-xl">
                Guardar borrador
              </Button>
              <Button type="submit" disabled={saving} className="rounded-xl font-black">
                {saving ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
                Guardar y habilitar firma
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview & Print Dialog */}
      <Dialog open={Boolean(previewing)} onOpenChange={(open) => !open && setPreviewing(null)}>
        <DialogContent className="max-h-[94vh] overflow-y-auto rounded-[2rem] sm:max-w-4xl print:max-w-none print:rounded-none print:border-0 print:shadow-none">
          {previewing && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4 print:hidden">
                <div className="flex items-center gap-2">
                  <Badge className={`rounded-lg ${STATUS_STYLE[previewing.status]}`}>{previewing.status}</Badge>
                  <span className="text-sm font-black text-muted-foreground">{previewing.contract_number}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.print()} className="rounded-xl">
                    <FileDown className="mr-1.5 size-4" />
                    Imprimir / PDF
                  </Button>
                  {previewing.status !== "ANULADO" && (
                    <Button size="sm" onClick={() => void copySigningLink(previewing)} className="rounded-xl font-bold">
                      <Copy className="mr-1.5 size-4" />
                      Copiar enlace para cliente
                    </Button>
                  )}
                  {previewing.status !== "ANULADO" && previewing.status !== "FIRMADO" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-xl text-rose-600"
                      onClick={async () => {
                        if (!membership || !session) return;
                        await updateContractStatus(membership.organizationId, session.user.id, previewing.id, "ANULADO");
                        toast.success("Contrato anulado");
                        setPreviewing(null);
                        void load();
                      }}
                    >
                      <XCircle className="mr-1.5 size-4" />
                      Anular
                    </Button>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-6 text-slate-900 sm:p-8 print:border-0 print:p-0">
                <div className="flex items-center justify-between border-b-2 border-[#5B21F4] pb-5">
                  <div className="flex items-center gap-4">
                    <img src={assetUrl(identity.logo_url)} alt={identity.name} className="h-16 w-auto object-contain" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-[.2em] text-[#5B21F4]">Contrato de Servicios</p>
                      <h2 className="text-2xl font-black text-[#24163d]">{previewing.title}</h2>
                      <p className="text-xs text-slate-500">N.º {previewing.contract_number}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-500">Contratante</p>
                    <p className="font-bold">{previewing.client?.full_name || "Por definir"}</p>
                    {previewing.client?.nit && <p className="text-xs text-slate-600">Doc/NIT: {previewing.client.nit}</p>}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-500">Evento</p>
                    <p className="font-bold">{previewing.event?.name || "Servicio musical"}</p>
                    {previewing.event?.event_date && (
                      <p className="text-xs text-slate-600">
                        {formatDate(previewing.event.event_date)} · {previewing.event.venue || ""}
                      </p>
                    )}
                  </div>
                </div>

                {previewing.body_text && <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed">{previewing.body_text}</p>}

                <div className="mt-6 space-y-4">
                  {previewing.clauses.map((clause) => (
                    <div key={clause.id}>
                      <h3 className="text-sm font-black uppercase text-[#24163d]">{clause.title}</h3>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{clause.content}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-3 rounded-2xl border p-4 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-500">Valor total</p>
                    <p className="text-base font-black">{money(previewing.total_amount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-500">Anticipo</p>
                    <p className="text-base font-bold text-emerald-700">{money(previewing.deposit_amount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-500">Saldo pendiente</p>
                    <p className="text-base font-bold">{money(previewing.balance_amount)}</p>
                  </div>
                </div>

                <div className="mt-8 border-t pt-6">
                  {previewing.status === "FIRMADO" ? (
                    <div className="flex flex-col gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-50/40 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-700">
                          <CheckCircle2 className="size-4" />
                          Firmado digitalmente
                        </p>
                        <p className="mt-1 font-bold">{previewing.signer_name}</p>
                        <p className="text-xs text-slate-600">
                          Doc/NIT: {previewing.signer_document || "—"} · Correo: {previewing.signer_email || "—"}
                        </p>
                        <p className="text-xs text-slate-500">
                          Fecha de firma: {previewing.signed_at ? new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short" }).format(new Date(previewing.signed_at)) : ""}
                        </p>
                      </div>
                      {previewing.signature_data_url && (
                        <img
                          src={previewing.signature_data_url}
                          alt="Firma digital"
                          className="h-24 w-auto rounded-xl border bg-white p-2 object-contain"
                        />
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-xs text-slate-500">
                      Documento pendiente de firma digital del contratante.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="rounded-3xl shadow-none">
      <CardContent className="p-5">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function money(v: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v || 0);
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date(`${value}T12:00:00`));
}
