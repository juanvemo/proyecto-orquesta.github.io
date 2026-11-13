import { FormEvent, useState } from "react";
import { CirclePower, ListMusic, Plus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveCatalogItem, toggleCatalogItem } from "./service";
import type { Instrument, MusicalRole } from "./types";

export function CatalogManager({ organizationId, instruments, roles, canManage, onChanged }: { organizationId: string; instruments: Instrument[]; roles: MusicalRole[]; canManage: boolean; onChanged: () => void }) {
  return <Tabs defaultValue="instruments" className="space-y-5"><TabsList className="h-auto rounded-2xl p-1.5"><TabsTrigger value="instruments" className="rounded-xl"><ListMusic className="mr-2 size-4" /> Instrumentos</TabsTrigger><TabsTrigger value="roles" className="rounded-xl"><SlidersHorizontal className="mr-2 size-4" /> Roles musicales</TabsTrigger></TabsList><TabsContent value="instruments"><CatalogSection title="Instrumentos" description="Catálogo utilizado en fichas, convocatorias y producción técnica." table="instruments" organizationId={organizationId} items={instruments} canManage={canManage} onChanged={onChanged} /></TabsContent><TabsContent value="roles"><CatalogSection title="Roles musicales" description="Funciones artísticas y técnicas dentro de la agrupación." table="musical_roles" organizationId={organizationId} items={roles} canManage={canManage} onChanged={onChanged} /></TabsContent></Tabs>;
}

function CatalogSection({ title, description, table, organizationId, items, canManage, onChanged }: { title: string; description: string; table: "instruments" | "musical_roles"; organizationId: string; items: Array<Instrument | MusicalRole>; canManage: boolean; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [descriptionValue, setDescription] = useState("");
  const [category, setCategory] = useState("OTROS");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try { await saveCatalogItem(table, organizationId, name, descriptionValue, category); setName(""); setDescription(""); toast.success(`${table === "instruments" ? "Instrumento" : "Rol"} creado`); onChanged(); }
    catch (error) { toast.error("No fue posible crear el registro", { description: error instanceof Error ? error.message : undefined }); }
    finally { setSaving(false); }
  };
  const toggle = async (id: string, active: boolean) => { try { await toggleCatalogItem(table, id, active); onChanged(); } catch { toast.error("No fue posible actualizar el estado"); } };

  return <div className="grid gap-5 xl:grid-cols-[1fr_340px]"><Card className="rounded-[2rem] shadow-none"><CardContent className="p-0"><div className="border-b p-5 sm:p-6"><h2 className="text-lg font-black">{title}</h2><p className="text-sm text-muted-foreground">{description}</p></div><div className="divide-y">{items.map((item) => <div key={item.id} className="flex items-center gap-4 p-4 sm:px-6"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><CirclePower className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{item.name}</p>{"category" in item && <Badge variant="outline" className="rounded-lg text-[9px]">{item.category}</Badge>}</div><p className="truncate text-xs text-muted-foreground">{item.description || "Sin descripción"}</p></div><Switch checked={item.is_active} disabled={!canManage} onCheckedChange={(checked) => void toggle(item.id, checked)} /></div>)}</div></CardContent></Card>{canManage && <Card className="h-fit rounded-[2rem] shadow-none"><CardContent className="p-5 sm:p-6"><h3 className="font-black">Agregar {table === "instruments" ? "instrumento" : "rol"}</h3><p className="mt-1 text-xs text-muted-foreground">Quedará disponible inmediatamente en nuevas fichas.</p><form onSubmit={submit} className="mt-5 space-y-4"><div><Label>Nombre</Label><Input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 rounded-xl" required /></div>{table === "instruments" && <div><Label>Categoría</Label><Select value={category} onValueChange={setCategory}><SelectTrigger className="mt-2 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{["VOCES","ARMONÍA","PERCUSIÓN","METALES","CUERDAS","OTROS"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>}<div><Label>Descripción</Label><Input value={descriptionValue} onChange={(event) => setDescription(event.target.value)} className="mt-2 rounded-xl" /></div><Button type="submit" disabled={saving} className="w-full rounded-xl font-bold"><Plus className="mr-2 size-4" /> Agregar</Button></form></CardContent></Card>}</div>;
}
