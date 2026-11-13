import { FormEvent, useEffect, useState } from "react";
import { CalendarPlus, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createStandaloneEvent, listEventCreationClients } from "@/features/commercial/service";

type ClientOption = { id: string; full_name: string; company: string | null; email: string };
const initial = { client_id: "", name: "", event_type: "", event_date: "", start_time: "18:00", end_time: "20:00", city: "Cali", venue: "", address: "", attendee_count: "", contracted_value: "0", requirements: "" };

export function CreateEventDialog({ organizationId, onCreated }: { organizationId: string; onCreated: (eventId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [values, setValues] = useState(initial);
  const [loadingClients, setLoadingClients] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingClients(true);
    listEventCreationClients(organizationId)
      .then(setClients)
      .catch((error) => toast.error("No fue posible cargar los clientes", { description: error instanceof Error ? error.message : undefined }))
      .finally(() => setLoadingClients(false));
  }, [open, organizationId]);

  const change = (key: keyof typeof initial, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.client_id || [values.name, values.event_type, values.event_date, values.start_time, values.end_time, values.city, values.venue, values.address].some((value) => !value.trim())) {
      toast.error("Completa los datos obligatorios del evento");
      return;
    }
    if (values.end_time <= values.start_time) {
      toast.error("La hora de finalización debe ser posterior a la hora de inicio");
      return;
    }
    setSaving(true);
    try {
      const eventId = await createStandaloneEvent({ ...values, organization_id: organizationId });
      toast.success("Evento creado sin requerir una cotización");
      setValues(initial);
      setOpen(false);
      onCreated(eventId);
    } catch (error) {
      toast.error("No fue posible crear el evento", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button className="h-11 rounded-xl font-black"><CalendarPlus className="mr-2 size-4" />Nuevo evento</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[2rem] sm:max-w-2xl">
      <DialogHeader><DialogTitle className="text-2xl font-black">Crear evento directamente</DialogTitle><DialogDescription>La cotización es opcional. El evento conservará su conexión con músicos, rider, repertorio y finanzas.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="mt-3 space-y-5">
        <div><Label>Cliente *</Label><Select value={values.client_id || "NONE"} onValueChange={(value) => change("client_id", value === "NONE" ? "" : value)} disabled={loadingClients}><SelectTrigger className="mt-2 h-11 rounded-xl"><SelectValue placeholder={loadingClients ? "Cargando clientes…" : "Seleccionar cliente"} /></SelectTrigger><SelectContent><SelectItem value="NONE">Seleccionar cliente</SelectItem>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.full_name}{client.company ? ` · ${client.company}` : ""}</SelectItem>)}</SelectContent></Select>{!loadingClients && clients.length === 0 && <p className="mt-2 text-xs text-amber-600">Primero registra un cliente en Clientes y CRM.</p>}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del evento *" value={values.name} onChange={(value) => change("name", value)} />
          <Field label="Tipo de evento *" value={values.event_type} onChange={(value) => change("event_type", value)} placeholder="Concierto, ensayo abierto…" />
          <Field label="Fecha *" type="date" value={values.event_date} onChange={(value) => change("event_date", value)} />
          <div className="grid grid-cols-2 gap-2"><Field label="Inicio *" type="time" value={values.start_time} onChange={(value) => change("start_time", value)} /><Field label="Fin *" type="time" value={values.end_time} onChange={(value) => change("end_time", value)} /></div>
          <Field label="Ciudad *" value={values.city} onChange={(value) => change("city", value)} />
          <Field label="Lugar *" value={values.venue} onChange={(value) => change("venue", value)} />
          <div className="sm:col-span-2"><Field label="Dirección *" value={values.address} onChange={(value) => change("address", value)} /></div>
          <Field label="Asistentes" type="number" value={values.attendee_count} onChange={(value) => change("attendee_count", value)} />
          <Field label="Valor contratado" type="number" value={values.contracted_value} onChange={(value) => change("contracted_value", value)} />
        </div>
        <div><Label>Requerimientos</Label><Textarea value={values.requirements} onChange={(event) => change("requirements", event.target.value)} className="mt-2 min-h-24 rounded-xl" /></div>
        <Button disabled={saving || loadingClients || clients.length === 0} className="h-11 w-full rounded-xl font-black">{saving && <LoaderCircle className="mr-2 size-4 animate-spin" />}Crear evento</Button>
      </form>
    </DialogContent>
  </Dialog>;
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <div><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-11 rounded-xl" /></div>;
}
