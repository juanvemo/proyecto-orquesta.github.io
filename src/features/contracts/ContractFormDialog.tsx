import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveContract } from "./service";
import { contractError, type Contract, type ContractClient } from "./types";

const newClient: ContractClient = { full_name: "", company: "", nit: "", email: "", phone: "", whatsapp: "", city: "", client_type: "PERSONA NATURAL" };
const defaultClauses = "1. El prestador realizará los servicios descritos en el objeto de este contrato, en la fecha y lugar acordados.\n\n2. El cliente garantizará el acceso al lugar y las condiciones de producción, seguridad y logística acordadas por escrito.\n\n3. Los cambios de fecha, lugar, duración, servicios o valor deberán ser aprobados por ambas partes por escrito antes de su ejecución.\n\n4. Las condiciones de cancelación, reprogramación, transporte, alimentación, hospedaje y requerimientos técnicos deben quedar expresamente acordadas en este documento antes de su aceptación.";
export function ContractFormDialog({ open, onOpenChange, organizationId, contract, clients, onSaved }: { open: boolean; onOpenChange: (value: boolean) => void; organizationId: string; contract: Contract | null; clients: ContractClient[]; onSaved: (id: string) => Promise<void> }) {
  const [clientId, setClientId] = useState("new");
  const [client, setClient] = useState<ContractClient>(newClient);
  const [title, setTitle] = useState("");
  const [object, setObject] = useState("");
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [amount, setAmount] = useState("");
  const [deposit, setDeposit] = useState("0");
  const [payment, setPayment] = useState("");
  const [clauses, setClauses] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const mutation = useRef(false);
  useEffect(() => {
    if (!open) return;
    setClientId(contract?.client_id || "new"); setClient({ ...newClient });
    setTitle(contract?.title || "Contrato de prestación de servicios musicales");
    setObject(contract?.content.object || ""); setDate(contract?.content.service_date || ""); setVenue(contract?.content.venue || "");
    setAmount(contract ? String(contract.content.amount) : ""); setDeposit(contract ? String(contract.content.deposit) : "0");
    setPayment(contract?.content.payment_terms || "El anticipo indicado se abonará al confirmar el contrato. El saldo se pagará antes de iniciar el servicio. El medio y los datos de pago serán informados por el prestador al cliente por escrito.");
    setClauses(contract?.content.clauses || defaultClauses); setValidUntil(contract?.valid_until || "");
  }, [open, contract]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mutation.current) return;
    if (Number(deposit) > Number(amount)) { toast.error("El anticipo no puede superar el valor total"); return; }
    mutation.current = true; setSaving(true);
    try {
      const id = await saveContract(organizationId, { title, client_id: clientId === "new" ? null : clientId, new_client: clientId === "new" ? client : null, content: { object, service_date: date, venue, amount: Number(amount), deposit: Number(deposit), payment_terms: payment, clauses }, valid_until: validUntil || null }, contract);
      toast.success("Contrato guardado como borrador", { description: contract?.status === "ENVIADO" ? "El enlace anterior quedó invalidado. Habilita y comparte la nueva versión." : clientId === "new" ? "El cliente también quedó registrado en el CRM." : undefined });
      await onSaved(id); onOpenChange(false);
    } catch (error) { toast.error("No se pudo guardar el contrato", { description: contractError(error) }); }
    finally { mutation.current = false; setSaving(false); }
  };
  const setClientField = (key: keyof ContractClient, value: string) => setClient((current) => ({ ...current, [key]: value }));
  return <Dialog open={open} onOpenChange={(value) => { if (!mutation.current) onOpenChange(value); }}><DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[2rem] sm:max-w-3xl"><DialogHeader><DialogTitle className="text-2xl font-black">{contract ? "Editar contrato" : "Nuevo contrato"}</DialogTitle><DialogDescription>Documento independiente con cliente del CRM o un cliente nuevo. El membrete se toma de Configuración.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-6"><fieldset disabled={saving} className="space-y-6">
      <div><Label htmlFor="contract-title">Título del contrato</Label><Input id="contract-title" value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={200} required className="mt-2 rounded-xl" /></div>
      <section className="space-y-4 rounded-2xl border bg-muted/30 p-4"><div><Label>Cliente del contrato</Label><Select value={clientId} onValueChange={setClientId}><SelectTrigger className="mt-2 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">+ Crear un cliente nuevo</SelectItem>{clients.map((item) => <SelectItem key={item.id} value={item.id!}>{item.full_name} · {item.email}</SelectItem>)}</SelectContent></Select></div>
        {clientId === "new" ? <div className="grid gap-4 sm:grid-cols-2"><Field label="Nombre completo / Representante" value={client.full_name} onChange={(value) => setClientField("full_name", value)} required minLength={3} /><Field label="Correo del destinatario" value={client.email} onChange={(value) => setClientField("email", value)} type="email" required /><Field label="Teléfono" value={client.phone} onChange={(value) => setClientField("phone", value)} required minLength={7} /><Field label="Ciudad" value={client.city} onChange={(value) => setClientField("city", value)} required /><Field label="Empresa (opcional)" value={client.company || ""} onChange={(value) => setClientField("company", value)} /><Field label="Identificación / NIT (opcional)" value={client.nit || ""} onChange={(value) => setClientField("nit", value)} /><Field label="WhatsApp (opcional)" value={client.whatsapp || ""} onChange={(value) => setClientField("whatsapp", value)} /><div><Label>Tipo de cliente</Label><Select value={client.client_type} onValueChange={(value) => setClientField("client_type", value)}><SelectTrigger className="mt-2 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{["PERSONA NATURAL", "EMPRESA", "INSTITUCIÓN", "ORGANIZACIÓN", "OTRO"].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div></div> : <p className="text-sm text-muted-foreground">Usaremos los datos registrados de este cliente. La aceptación requiere su mismo correo.</p>}
      </section>
      <Area label="Objeto y servicios contratados" value={object} onChange={setObject} placeholder="Detalla agrupación, duración, horario, repertorio y servicios incluidos." minLength={10} />
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Fecha del servicio" value={date} onChange={setDate} type="date" required /><Field label="Lugar / dirección" value={venue} onChange={setVenue} required /><Field label="Valor total" value={amount} onChange={setAmount} type="number" required max={1000000000000} /><Field label="Anticipo" value={deposit} onChange={setDeposit} type="number" required max={Number(amount) || 1000000000000} /><Field label="Fecha límite de aceptación (opcional)" value={validUntil} onChange={setValidUntil} type="date" /></div>
      <Area label="Forma de pago y plazos" value={payment} onChange={setPayment} minLength={3} />
      <Area label="Cláusulas y obligaciones" value={clauses} onChange={setClauses} minLength={10} />
      <p className="rounded-xl bg-orange-500/10 p-4 text-sm text-orange-800">Revisa y completa todas las cláusulas y datos antes de enviar. Esta es una plantilla editable, no una certificación ni asesoría jurídica. Editar un contrato enviado invalida su enlace anterior; un contrato firmado no puede modificarse.</p>
    </fieldset><Button disabled={saving} className="h-11 w-full rounded-xl font-black">{saving ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Guardar borrador</Button></form>
  </DialogContent></Dialog>;
}
function Field({ label, value, onChange, type = "text", required, minLength, max }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; minLength?: number; max?: number }) { return <label className="block text-sm font-semibold">{label}<Input value={value} onChange={(event) => onChange(event.target.value)} type={type} required={required} minLength={minLength} maxLength={type === "number" || type === "date" ? undefined : 300} min={type === "number" ? 0 : undefined} step={type === "number" ? "0.01" : undefined} max={max} className="mt-2 rounded-xl" /></label>; }
function Area({ label, value, onChange, placeholder, minLength }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; minLength: number }) { return <label className="block text-sm font-semibold">{label}<Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required minLength={minLength} maxLength={20000} className="mt-2 min-h-36 rounded-xl font-normal" /></label>; }
