import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Camera, LoaderCircle, Save, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { musicianSchema } from "./validation";
import { saveMusician } from "./service";
import { emptyMusicianForm, type Instrument, type MusicalRole, type Musician, type MusicianFormValues } from "./types";

function valuesFromMusician(musician: Musician): MusicianFormValues {
  const instrumentIds = musician.musician_instruments.map((item) => item.instrument?.id).filter(Boolean) as string[];
  const roleIds = musician.musician_roles.map((item) => item.musical_role?.id).filter(Boolean) as string[];
  return {
    first_name: musician.first_name, last_name: musician.last_name, document_type: musician.document_type,
    document_number: musician.document_number ?? "", birth_date: musician.birth_date ?? "", phone: musician.phone ?? "",
    whatsapp: musician.whatsapp ?? "", email: musician.email ?? "", city: musician.city ?? "", address: musician.address ?? "",
    eps: musician.eps ?? "", cali_commune: musician.cali_commune?.toString() ?? "", photo_url: musician.photo_url ?? "",
    emergency_contact_name: musician.emergency_contact_name ?? "", emergency_contact_phone: musician.emergency_contact_phone ?? "",
    observations: musician.observations ?? "", level: musician.level, specialty: musician.specialty ?? "",
    experience_years: musician.experience_years?.toString() ?? "", biography: musician.biography ?? "", joined_at: musician.joined_at ?? "",
    status: musician.status, participation_type: musician.participation_type ?? "", habitual_rate: musician.habitual_rate.toString(),
    event_rate: musician.event_rate.toString(), rehearsal_rate: musician.rehearsal_rate.toString(), instrument_ids: instrumentIds,
    primary_instrument_id: musician.musician_instruments.find((item) => item.is_primary)?.instrument?.id ?? instrumentIds[0] ?? "",
    role_ids: roleIds, primary_role_id: musician.musician_roles.find((item) => item.is_primary)?.musical_role?.id ?? roleIds[0] ?? "",
  };
}

export function MusicianFormDialog({ open, onOpenChange, organizationId, musician, instruments, roles, onSaved }: { open: boolean; onOpenChange: (value: boolean) => void; organizationId: string; musician?: Musician | null; instruments: Instrument[]; roles: MusicalRole[]; onSaved: (id: string) => void }) {
  const [values, setValues] = useState<MusicianFormValues>(emptyMusicianForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) { setValues(musician ? valuesFromMusician(musician) : { ...emptyMusicianForm, instrument_ids: [], role_ids: [] }); setErrors({}); }
  }, [open, musician]);

  const change = <K extends keyof MusicianFormValues>(key: K, value: MusicianFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));
  const toggle = (key: "instrument_ids" | "role_ids", id: string) => change(key, values[key].includes(id) ? values[key].filter((item) => item !== id) : [...values[key], id]);

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) { toast.error("Selecciona una imagen de máximo 5 MB"); return; }
    setUploading(true);
    const extension = file.name.split(".").pop() ?? "jpg";
    const path = `${organizationId}/musicians/${musician?.id ?? crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("organization-assets").upload(path, file, { upsert: true, contentType: file.type });
    if (error) toast.error("No se pudo cargar la foto", { description: error.message });
    else {
      const { data } = supabase.storage.from("organization-assets").getPublicUrl(path);
      change("photo_url", `${data.publicUrl}?v=${Date.now()}`);
    }
    setUploading(false);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = musicianSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => { nextErrors[String(issue.path[0])] = issue.message; });
      setErrors(nextErrors);
      toast.error("Revisa los campos obligatorios");
      return;
    }
    const normalized = { ...values, primary_instrument_id: values.primary_instrument_id || values.instrument_ids[0], primary_role_id: values.primary_role_id || values.role_ids[0] };
    setSaving(true);
    try {
      const id = await saveMusician(organizationId, normalized, musician?.id);
      toast.success(musician ? "Ficha actualizada" : "Músico creado");
      onOpenChange(false);
      onSaved(id);
    } catch (error) {
      toast.error("No fue posible guardar la ficha", { description: error instanceof Error ? error.message : "Intenta nuevamente" });
    } finally { setSaving(false); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto rounded-[2rem] p-0 sm:max-w-4xl"><form onSubmit={submit}>
    <DialogHeader className="border-b px-5 py-5 sm:px-7"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><UserRoundPlus className="size-5" /></span><div><DialogTitle className="text-xl font-black">{musician ? "Editar ficha" : "Nuevo músico"}</DialogTitle><DialogDescription>Información personal, musical y económica en un solo registro.</DialogDescription></div></div></DialogHeader>
    <Tabs defaultValue="personal" className="p-5 sm:p-7"><TabsList className="mb-6 h-auto w-full justify-start overflow-x-auto rounded-2xl p-1.5"><TabsTrigger value="personal" className="rounded-xl">Datos personales</TabsTrigger><TabsTrigger value="musical" className="rounded-xl">Información musical</TabsTrigger><TabsTrigger value="orchestra" className="rounded-xl">En la orquesta</TabsTrigger></TabsList>
      <TabsContent value="personal" className="grid gap-5 sm:grid-cols-2">
        <Field label="Nombre *" value={values.first_name} onChange={(value) => change("first_name", value)} error={errors.first_name} /><Field label="Apellidos *" value={values.last_name} onChange={(value) => change("last_name", value)} error={errors.last_name} />
        <div className="grid grid-cols-[100px_1fr] gap-2"><Select value={values.document_type} onValueChange={(value) => change("document_type", value)}><SelectTrigger className="mt-7 h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{["CC","CE","PASAPORTE","OTRO"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Field label="Documento" value={values.document_number} onChange={(value) => change("document_number", value)} /></div>
        <Field label="Fecha de nacimiento" type="date" value={values.birth_date} onChange={(value) => change("birth_date", value)} /><Field label="Teléfono" value={values.phone} onChange={(value) => change("phone", value)} /><Field label="WhatsApp" value={values.whatsapp} onChange={(value) => change("whatsapp", value)} /><Field label="Correo electrónico" type="email" value={values.email} onChange={(value) => change("email", value)} error={errors.email} /><Field label="Ciudad" value={values.city} onChange={(value) => change("city", value)} /><Field label="Dirección" value={values.address} onChange={(value) => change("address", value)} /><Field label="EPS" value={values.eps} onChange={(value) => change("eps", value)} /><div><Label>Comuna de Cali</Label><Select value={values.cali_commune || "NONE"} onValueChange={(value) => change("cali_commune", value === "NONE" ? "" : value)}><SelectTrigger className="mt-2 h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">Sin registrar</SelectItem>{Array.from({ length: 22 }, (_, index) => String(index + 1)).map((value) => <SelectItem key={value} value={value}>Comuna {value}</SelectItem>)}</SelectContent></Select></div>
        <Field label="Contacto de emergencia" value={values.emergency_contact_name} onChange={(value) => change("emergency_contact_name", value)} /><Field label="Teléfono de emergencia" value={values.emergency_contact_phone} onChange={(value) => change("emergency_contact_phone", value)} />
        <div className="sm:col-span-2"><Label>Foto</Label><div className="mt-2 flex items-center gap-4 rounded-2xl border p-3"><span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary/10 text-primary">{values.photo_url ? <img src={values.photo_url} alt="Vista previa" className="h-full w-full object-cover" /> : <Camera className="size-6" />}</span><label className="cursor-pointer rounded-xl border px-4 py-2 text-sm font-bold hover:bg-muted">{uploading ? "Cargando…" : "Cargar fotografía"}<input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(event) => void uploadPhoto(event)} /></label></div></div>
        <div className="sm:col-span-2"><Label>Observaciones</Label><Textarea value={values.observations} onChange={(event) => change("observations", event.target.value)} className="mt-2 min-h-24 rounded-xl" /></div>
      </TabsContent>
      <TabsContent value="musical" className="space-y-6"><div className="grid gap-5 sm:grid-cols-3"><div><Label>Nivel</Label><Select value={values.level} onValueChange={(value: MusicianFormValues["level"]) => change("level", value)}><SelectTrigger className="mt-2 h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{["INICIACIÓN","INTERMEDIO","AVANZADO","PROFESIONAL"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div><Field label="Especialidad" value={values.specialty} onChange={(value) => change("specialty", value)} /><Field label="Años de experiencia" type="number" value={values.experience_years} onChange={(value) => change("experience_years", value)} error={errors.experience_years} /></div>
        <MultiChoice label="Instrumentos *" items={instruments.filter((item) => item.is_active)} selected={values.instrument_ids} primary={values.primary_instrument_id} onToggle={(id) => toggle("instrument_ids", id)} onPrimary={(id) => change("primary_instrument_id", id)} error={errors.instrument_ids} />
        <MultiChoice label="Roles musicales *" items={roles.filter((item) => item.is_active)} selected={values.role_ids} primary={values.primary_role_id} onToggle={(id) => toggle("role_ids", id)} onPrimary={(id) => change("primary_role_id", id)} error={errors.role_ids} />
        <div><Label>Biografía</Label><Textarea value={values.biography} onChange={(event) => change("biography", event.target.value)} className="mt-2 min-h-28 rounded-xl" /></div>
      </TabsContent>
      <TabsContent value="orchestra" className="grid gap-5 sm:grid-cols-2"><Field label="Fecha de ingreso" type="date" value={values.joined_at} onChange={(value) => change("joined_at", value)} /><div><Label>Estado</Label><Select value={values.status} onValueChange={(value: MusicianFormValues["status"]) => change("status", value)}><SelectTrigger className="mt-2 h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{["ACTIVO","INACTIVO","INVITADO","SUPLENTE","PROFESIONAL DE APOYO"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div><Field label="Tipo de participación" value={values.participation_type} onChange={(value) => change("participation_type", value)} /><div />
        <MoneyField label="Tarifa habitual" value={values.habitual_rate} onChange={(value) => change("habitual_rate", value)} error={errors.habitual_rate} /><MoneyField label="Tarifa por evento" value={values.event_rate} onChange={(value) => change("event_rate", value)} error={errors.event_rate} /><MoneyField label="Tarifa por ensayo" value={values.rehearsal_rate} onChange={(value) => change("rehearsal_rate", value)} error={errors.rehearsal_rate} />
      </TabsContent>
    </Tabs>
    <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-background/95 px-5 py-4 backdrop-blur sm:px-7"><Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={saving || uploading} className="rounded-xl font-bold">{saving ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}{musician ? "Guardar cambios" : "Crear músico"}</Button></div>
  </form></DialogContent></Dialog>;
}

function Field({ label, value, onChange, type = "text", error }: { label: string; value: string; onChange: (value: string) => void; type?: string; error?: string }) { return <div><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 rounded-xl" /><p className="mt-1 text-xs text-destructive">{error}</p></div>; }
function MoneyField({ label, value, onChange, error }: { label: string; value: string; onChange: (value: string) => void; error?: string }) { return <div><Label>{label}</Label><div className="relative mt-2"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span><Input type="number" min="0" step="1000" value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-xl pl-7" /></div><p className="mt-1 text-xs text-destructive">{error}</p></div>; }
function MultiChoice({ label, items, selected, primary, onToggle, onPrimary, error }: { label: string; items: Array<{ id: string; name: string }>; selected: string[]; primary: string; onToggle: (id: string) => void; onPrimary: (id: string) => void; error?: string }) { return <div><div className="mb-2 flex items-center justify-between"><Label>{label}</Label><span className="text-xs text-muted-foreground">Haz clic en “Principal” para destacar uno</span></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-xl border p-3"><Checkbox checked={selected.includes(item.id)} onCheckedChange={() => onToggle(item.id)} /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.name}</span>{selected.includes(item.id) && <button type="button" onClick={() => onPrimary(item.id)}><Badge variant={primary === item.id ? "default" : "outline"} className="rounded-lg text-[9px]">Principal</Badge></button>}</div>)}</div><p className="mt-1 text-xs text-destructive">{error}</p></div>; }
