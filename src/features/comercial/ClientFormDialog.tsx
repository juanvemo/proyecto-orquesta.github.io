import { FormEvent, useEffect, useState } from "react";
import { Building2, LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Client } from "./types";
import { saveClient } from "./service";

type ClientValues = Pick<Client, "client_type" | "full_name" | "company" | "nit" | "phone" | "whatsapp" | "email" | "city">;
const empty: ClientValues = { client_type: "PERSONA NATURAL", full_name: "", company: "", nit: "", phone: "", whatsapp: "", email: "", city: "Cali" };

export function ClientFormDialog({ open, onOpenChange, organizationId, client, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; organizationId: string; client: Client | null; onSaved: () => void }) {
  const [values, setValues] = useState<ClientValues>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValues(client ? { client_type: client.client_type, full_name: client.full_name, company: client.company ?? "", nit: client.nit ?? "", phone: client.phone, whatsapp: client.whatsapp ?? "", email: client.email, city: client.city } : empty);
  }, [open, client]);

  const change = (key: keyof ClientValues, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.full_name.trim() || !values.phone.trim() || !/^\S+@\S+\.\S+$/.test(values.email) || !values.city.trim()) { toast.error("Completa nombre, teléfono, correo y ciudad"); return; }
    setSaving(true);
    try {
      await saveClient(organizationId, values, client?.id);
      toast.success(client ? "Cliente actualizado" : "Cliente agregado");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error("No fue posible guardar el cliente", { description: error instanceof Error ? error.message : undefined });
    } finally { setSaving(false); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="rounded-[2rem] sm:max-w-2xl"><form onSubmit={submit}><DialogHeader><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Building2 className="size-5" /></span><div><DialogTitle className="text-xl font-black">{client ? "Editar cliente" : "Agregar cliente"}</DialogTitle><DialogDescription>Registra la información comercial y de contacto.</DialogDescription></div></div></DialogHeader><div className="mt-6 grid gap-5 sm:grid-cols-2"><div><Label>Tipo de cliente</Label><Select value={values.client_type} onValueChange={(value) => change("client_type", value)}><SelectTrigger className="mt-2 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{["PERSONA NATURAL","EMPRESA","INSTITUCIÓN","ORGANIZACIÓN","OTRO"].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div><Field label="Nombre o contacto *" value={values.full_name} onChange={(value) => change("full_name", value)} /><Field label="Empresa" value={values.company ?? ""} onChange={(value) => change("company", value)} /><Field label="NIT" value={values.nit ?? ""} onChange={(value) => change("nit", value)} /><Field label="Teléfono *" type="tel" value={values.phone} onChange={(value) => change("phone", value)} /><Field label="WhatsApp" type="tel" value={values.whatsapp ?? ""} onChange={(value) => change("whatsapp", value)} /><Field label="Correo *" type="email" value={values.email} onChange={(value) => change("email", value)} /><Field label="Ciudad *" value={values.city} onChange={(value) => change("city", value)} /></div><div className="mt-6 flex justify-end gap-3 border-t pt-4"><Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button><Button disabled={saving} className="rounded-xl font-black">{saving ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Guardar cliente</Button></div></form></DialogContent></Dialog>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <div><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={label.includes("*")} className="mt-2 rounded-xl" /></div>;
}
