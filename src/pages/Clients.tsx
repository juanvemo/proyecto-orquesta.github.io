import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Mail, Pencil, Phone, Plus, Search, Trash2, UserRound, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { ClientFormDialog } from "@/features/commercial/ClientFormDialog";
import { deleteClient, listClients } from "@/features/commercial/service";
import type { Client } from "@/features/commercial/types";

export default function Clients() {
  const { membership } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!membership) return;
    setLoading(true);
    try { setClients(await listClients(membership.organizationId)); }
    catch (error) { toast.error("No fue posible cargar clientes", { description: error instanceof Error ? error.message : undefined }); }
    finally { setLoading(false); }
  }, [membership]);

  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => clients.filter((client) => `${client.full_name} ${client.company ?? ""} ${client.email} ${client.phone}`.toLowerCase().includes(query.toLowerCase())), [clients, query]);

  const remove = async (client: Client) => {
    if (!window.confirm(`¿Eliminar a ${client.full_name}? Solo se permite si no tiene solicitudes, cotizaciones ni eventos.`)) return;
    setDeleting(client.id);
    try { await deleteClient(client.id); toast.success("Cliente eliminado"); void load(); }
    catch (error) { toast.error("No se puede eliminar este cliente", { description: error instanceof Error ? error.message : "Puede tener historial comercial relacionado." }); }
    finally { setDeleting(null); }
  };

  return <div className="space-y-6 animate-in fade-in duration-300">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.16em] text-primary">CRM comercial</p><h1 className="mt-2 text-3xl font-black">Clientes</h1><p className="mt-2 text-sm text-muted-foreground">Agrega contactos, actualiza sus datos y conserva la relación con solicitudes, cotizaciones y eventos.</p></div><Button onClick={() => { setEditing(null); setFormOpen(true); }} className="h-11 rounded-xl font-black"><Plus className="mr-2 size-4" />Agregar cliente</Button></div>
    <div className="grid gap-4 sm:grid-cols-3"><Metric icon={UsersRound} label="Clientes" value={clients.length} /><Metric icon={Building2} label="Empresas" value={clients.filter((client) => Boolean(client.company)).length} /><Metric icon={UserRound} label="Con solicitudes" value={clients.filter((client) => (client.quote_requests?.length ?? 0) > 0).length} /></div>
    <Card className="rounded-[2rem] shadow-none"><div className="border-b p-4"><div className="relative max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, empresa o contacto…" className="rounded-xl pl-9" /></div></div><CardContent className="p-0">{loading ? <div className="space-y-3 p-5">{[1,2,3].map((item) => <Skeleton key={item} className="h-20 rounded-2xl" />)}</div> : filtered.length ? <div className="divide-y">{filtered.map((client) => { const hasHistory=(client.quote_requests?.length??0)>0||(client.quotes?.length??0)>0; return <div key={client.id} className="grid gap-4 p-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center sm:px-6"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><UserRound className="size-5" /></span><div><p className="font-black">{client.full_name}</p><p className="text-xs text-muted-foreground">{client.company || client.client_type}</p></div></div><div className="space-y-1 text-sm"><p className="flex items-center gap-2"><Mail className="size-3 text-primary" />{client.email}</p><p className="flex items-center gap-2"><Phone className="size-3 text-primary" />{client.phone}</p></div><div className="flex flex-wrap gap-2"><Badge variant="outline" className="rounded-lg">{client.quote_requests?.length ?? 0} solicitudes</Badge><Badge className="rounded-lg bg-emerald-500/10 text-emerald-700">{client.quotes?.length ?? 0} cotizaciones</Badge></div><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => { setEditing(client); setFormOpen(true); }} className="rounded-xl"><Pencil className="size-4" /><span className="sr-only">Editar cliente</span></Button><Button variant="ghost" size="icon" disabled={deleting===client.id||hasHistory} onClick={() => void remove(client)} className="rounded-xl text-destructive" title={hasHistory?"No se puede eliminar porque tiene historial comercial":"Eliminar cliente"}><Trash2 className="size-4" /><span className="sr-only">Eliminar cliente</span></Button></div></div>; })}</div> : <div className="p-12 text-center"><UserRound className="mx-auto size-9 text-primary" /><p className="mt-4 font-bold">No encontramos clientes</p><p className="text-sm text-muted-foreground">Agrega el primer contacto o prueba otra búsqueda.</p></div>}</CardContent></Card>
    {membership && <ClientFormDialog open={formOpen} onOpenChange={setFormOpen} organizationId={membership.organizationId} client={editing} onSaved={() => void load()} />}
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof UsersRound; label: string; value: number }) {
  return <Card className="rounded-3xl shadow-none"><CardContent className="flex items-center gap-4 p-5"><span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-5" /></span><div><p className="text-2xl font-black">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>;
}
