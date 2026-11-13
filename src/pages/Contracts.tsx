import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, ExternalLink, FileDown, FilePenLine, LoaderCircle, Pencil, Plus, Search, Send, ShieldCheck, Smartphone, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { ContractDocumentView } from "@/features/contracts/ContractDocumentView";
import { ContractFormDialog } from "@/features/contracts/ContractFormDialog";
import { downloadContractPdf } from "@/features/contracts/pdf";
import { getContractClients, listContracts, setContractStatus } from "@/features/contracts/service";
import { contractError, contractMoney, type Contract, type ContractClient } from "@/features/contracts/types";
import { getAppRouteUrl } from "@/lib/authRedirect";

export default function Contracts() {
  const { membership } = useAuth();
  const organizationId = membership?.organizationId;
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<ContractClient[]>([]);
  const [selected, setSelected] = useState<Contract | null>(null);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mutation = useRef(false);
  const load = useCallback(async (preferredId?: string) => {
    if (!organizationId) return;
    setError(null);
    try {
      const [rows, people] = await Promise.all([listContracts(organizationId), getContractClients(organizationId)]);
      setContracts(rows); setClients(people);
      setSelected((current) => rows.find((row) => row.id === (preferredId || current?.id)) || null);
    } catch (loadError) { setError(contractError(loadError)); }
    finally { setLoading(false); }
  }, [organizationId]);
  useEffect(() => { setLoading(true); setSelected(null); void load(); }, [load]);
  const filtered = contracts.filter((item) => `${item.contract_number} ${item.title} ${item.client_snapshot.full_name} ${item.status}`.toLowerCase().includes(query.toLowerCase()));
  const changeStatus = async (status: "ENVIADO" | "CANCELADO") => {
    if (!selected || mutation.current) return;
    if (status === "CANCELADO" && !window.confirm(`¿Cancelar ${selected.contract_number}? El enlace del cliente dejará de estar disponible; se conservará el registro.`)) return;
    mutation.current = true; setBusy(true);
    try { await setContractStatus(selected, status); await load(selected.id); toast.success(status === "ENVIADO" ? "Enlace privado habilitado" : "Contrato cancelado", { description: status === "ENVIADO" ? "Ahora puedes copiarlo o compartirlo por WhatsApp. El enlace no se envía automáticamente." : undefined }); }
    catch (operationError) { toast.error("No se pudo actualizar el contrato", { description: contractError(operationError) }); }
    finally { mutation.current = false; setBusy(false); }
  };
  const download = async () => {
    if (!selected || mutation.current) return;
    mutation.current = true; setBusy(true);
    try { await downloadContractPdf(selected); } catch (pdfError) { toast.error("No se pudo generar el PDF", { description: contractError(pdfError) }); }
    finally { mutation.current = false; setBusy(false); }
  };
  const link = selected ? getAppRouteUrl(`/contrato/${selected.public_token}`) : "";
  const canShare = selected?.status === "ENVIADO" || selected?.status === "FIRMADO";
  const copy = async () => { try { await navigator.clipboard.writeText(link); toast.success("Enlace copiado"); } catch { toast.error("No se pudo copiar automáticamente", { description: "Selecciona y copia el enlace que aparece debajo de los botones." }); } };
  const shareWhatsApp = () => {
    if (!selected) return;
    let phone = (selected.client_snapshot.whatsapp || selected.client_snapshot.phone).replace(/\D/g, "");
    if (phone.length === 10 && phone.startsWith("3")) phone = `57${phone}`;
    if (phone.length < 10 || phone.length > 15) { toast.error("El cliente no tiene un teléfono válido para WhatsApp. Puedes copiar el enlace."); return; }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`Hola ${selected.client_snapshot.full_name}, te compartimos el contrato ${selected.contract_number} de ${selected.organization_snapshot.name}. Revísalo y registra tu aceptación aquí: ${link}`)}`, "_blank", "noopener,noreferrer");
  };
  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Gestión comercial · Documentos</p><h1 className="mt-2 text-3xl font-black">Contratos</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Prepara, comparte y conserva contratos con aceptación electrónica, independientes de las cotizaciones.</p></div><Button disabled={loading || Boolean(error) || busy} onClick={() => { setEditing(null); setFormOpen(true); }} className="h-11 rounded-xl font-black"><Plus className="mr-2 size-4" />Nuevo contrato</Button></header>
    <div className="grid gap-3 sm:grid-cols-3">{[["Borradores", contracts.filter((item) => item.status === "BORRADOR").length], ["Por aceptar", contracts.filter((item) => item.status === "ENVIADO").length], ["Firmados", contracts.filter((item) => item.status === "FIRMADO").length]].map(([label, count]) => <Card key={label} className="rounded-3xl shadow-none"><CardContent className="flex items-center gap-4 p-5"><ShieldCheck className="size-8 text-primary" /><div><p className="text-2xl font-black">{count}</p><p className="text-sm text-muted-foreground">{label}</p></div></CardContent></Card>)}</div>
    {error ? <Card className="rounded-3xl shadow-none"><CardContent className="space-y-3 p-6"><p className="text-sm text-destructive">{error}</p><Button className="rounded-xl" onClick={() => void load()}>Reintentar carga</Button></CardContent></Card> : loading ? <Skeleton className="h-96 rounded-3xl" /> : <div className="grid items-start gap-5 xl:grid-cols-[320px_1fr]">
      <Card className="rounded-3xl shadow-none"><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, contrato o estado" className="rounded-xl pl-9" /></div><div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto">{filtered.map((contract) => <button key={contract.id} disabled={busy} onClick={() => setSelected(contract)} className={`w-full rounded-2xl border p-4 text-left transition-colors ${selected?.id === contract.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}><div className="flex flex-wrap items-center justify-between gap-2"><p className="break-all text-xs font-black text-primary">{contract.contract_number}</p><Badge variant="outline" className={`rounded-lg text-[10px] ${contract.status === "FIRMADO" ? "border-emerald-300 text-emerald-700" : ""}`}>{contract.status}</Badge></div><p className="mt-3 font-black">{contract.title}</p><p className="mt-1 text-sm text-muted-foreground">{contract.client_snapshot.full_name}</p><p className="mt-3 text-sm font-bold">{contractMoney(contract.content.amount, contract.organization_snapshot.currency_code)} · v{contract.version}</p></button>)}{!filtered.length && <div className="p-6 text-center"><FilePenLine className="mx-auto size-10 text-primary" /><p className="mt-3 font-bold">Sin contratos para mostrar</p><p className="mt-2 text-sm text-muted-foreground">Crea el primero con un cliente existente o nuevo.</p></div>}</div></CardContent></Card>
      {selected ? <div className="min-w-0 space-y-4"><Card className="rounded-3xl shadow-none"><CardContent className="space-y-3 p-4"><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => void download()} className="rounded-xl">{busy ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <FileDown className="mr-2 size-4" />}Descargar PDF</Button>{["BORRADOR", "ENVIADO"].includes(selected.status) && <><Button disabled={busy} variant="outline" className="rounded-xl" onClick={() => { setEditing(selected); setFormOpen(true); }}><Pencil className="mr-2 size-4" />Editar</Button><Button disabled={busy} onClick={() => void changeStatus("ENVIADO")} className="rounded-xl"><Send className="mr-2 size-4" />{canShare ? "Actualizar estado" : "Habilitar enlace"}</Button><Button disabled={busy} variant="outline" className="rounded-xl text-destructive" onClick={() => void changeStatus("CANCELADO")}><XCircle className="mr-2 size-4" />Cancelar</Button></>}{canShare && <><Button variant="outline" disabled={busy} onClick={() => void copy()} className="rounded-xl"><Copy className="mr-2 size-4" />Copiar enlace</Button><Button disabled={busy} onClick={shareWhatsApp} className="rounded-xl bg-emerald-600 hover:bg-emerald-700"><Smartphone className="mr-2 size-4" />WhatsApp</Button><Button asChild variant="outline" className="rounded-xl"><a href={link} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 size-4" />Vista del cliente</a></Button></>}</div>{canShare && <Input aria-label="Enlace privado del contrato" readOnly value={link} onFocus={(event) => event.target.select()} className="rounded-xl text-xs" />}<p className="text-xs text-muted-foreground">{selected.status === "FIRMADO" ? "Aceptación conservada. No se permiten modificaciones del documento firmado." : "Revisa el PDF y las cláusulas antes de compartir. La firma registra nombre, correo, fecha y huella del documento; no es una firma digital certificada."}</p></CardContent></Card><ContractDocumentView contract={selected} /></div> : <Card className="rounded-[2rem] border-dashed shadow-none"><CardContent className="p-10 text-center sm:p-16"><FilePenLine className="mx-auto size-14 text-primary" /><h2 className="mt-5 text-xl font-black">Tu documento, listo para compartir</h2><p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">Selecciona un contrato para ver su membrete, enviarlo al cliente o descargar su PDF.</p></CardContent></Card>}
    </div>}
    {organizationId && <ContractFormDialog open={formOpen} onOpenChange={setFormOpen} organizationId={organizationId} contract={editing} clients={clients} onSaved={load} />}
  </div>;
}
