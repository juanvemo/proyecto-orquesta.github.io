import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  LoaderCircle,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  createInventoryReservation,
  deleteInventoryItem,
  getAvailableUnits,
  listInventory,
  saveInventoryItem,
  updateReservationStatus,
} from "@/features/inventory/service";
import {
  INVENTORY_CATEGORIES,
  type InventoryItem,
  type InventoryReservation,
  type InventoryStatus,
  type ReservationStatus,
} from "@/features/inventory/types";

const STATUS_BADGE: Record<InventoryStatus, string> = {
  DISPONIBLE: "bg-emerald-500/10 text-emerald-700",
  RESERVADO: "bg-blue-500/10 text-blue-700",
  "EN USO": "bg-violet-500/10 text-violet-700",
  MANTENIMIENTO: "bg-amber-500/10 text-amber-700",
  DAÑADO: "bg-rose-500/10 text-rose-700",
  BAJA: "bg-slate-500/10 text-slate-600",
};

export default function Inventory() {
  const { membership, session, hasPermission } = useAuth();
  const canManage =
    hasPermission("inventory.manage") ||
    hasPermission("technical.manage") ||
    membership?.roleCode === "PRODUCTION_TECH";

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [reservations, setReservations] = useState<InventoryReservation[]>([]);
  const [events, setEvents] = useState<Array<{ id: string; name: string; event_date: string; venue: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("Sonido");
  const [code, setCode] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<InventoryStatus>("DISPONIBLE");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [maintDetail, setMaintDetail] = useState("");

  const [reserveOpen, setReserveOpen] = useState(false);
  const [resItemId, setResItemId] = useState("");
  const [resEventId, setResEventId] = useState("");
  const [resQuantity, setResQuantity] = useState(1);
  const [resResponsible, setResResponsible] = useState("");
  const [resNotes, setResNotes] = useState("");

  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!membership) return;
    setLoading(true);
    try {
      const res = await listInventory(membership.organizationId);
      setItems(res.items);
      setReservations(res.reservations);
      setEvents(res.events);
    } catch (error) {
      toast.error("No fue posible cargar el inventario técnico", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [membership]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNewItem = () => {
    setEditing(null);
    setName("");
    setCategory("Sonido");
    setCode("");
    setSerialNumber("");
    setQuantity(1);
    setStatus("DISPONIBLE");
    setLocation("Bodega principal");
    setNotes("");
    setMaintDetail("");
    setItemDialogOpen(true);
  };

  const openEditItem = (item: InventoryItem) => {
    setEditing(item);
    setName(item.name);
    setCategory(item.category);
    setCode(item.code ?? "");
    setSerialNumber(item.serial_number ?? "");
    setQuantity(item.quantity);
    setStatus(item.status);
    setLocation(item.location ?? "");
    setNotes(item.notes ?? "");
    setMaintDetail("");
    setItemDialogOpen(true);
  };

  const handleSaveItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!membership || !session || !name.trim()) return;
    setSaving(true);
    try {
      const nextMaintenance = [...(editing?.maintenance_history ?? [])];
      if (maintDetail.trim()) {
        nextMaintenance.unshift({
          id: crypto.randomUUID(),
          date: new Date().toISOString().slice(0, 10),
          detail: maintDetail.trim(),
          performed_by: session.user.email || "Equipo técnico",
        });
      }
      await saveInventoryItem(membership.organizationId, session.user.id, {
        id: editing?.id,
        name,
        category,
        code,
        serial_number: serialNumber,
        quantity,
        status,
        location,
        notes,
        maintenance_history: nextMaintenance,
      });
      toast.success(editing ? "Equipo actualizado" : "Equipo agregado al inventario");
      setItemDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("No fue posible guardar el equipo", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateReservation = async (e: FormEvent) => {
    e.preventDefault();
    if (!membership || !session || !resItemId || !resEventId) {
      toast.error("Selecciona equipo y evento");
      return;
    }
    setSaving(true);
    try {
      await createInventoryReservation(membership.organizationId, session.user.id, {
        itemId: resItemId,
        eventId: resEventId,
        quantity: resQuantity,
        responsibleName: resResponsible,
        notes: resNotes,
      });
      toast.success("Equipo reservado para el evento");
      setReserveOpen(false);
      setResNotes("");
      setResResponsible("");
      await load();
    } catch (error) {
      toast.error("No fue posible registrar la reserva", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (categoryFilter !== "ALL" && item.category !== categoryFilter) return false;
        const text = `${item.name} ${item.category} ${item.code ?? ""} ${item.serial_number ?? ""} ${item.location ?? ""}`.toLowerCase();
        return text.includes(query.toLowerCase());
      }),
    [items, categoryFilter, query],
  );

  const totalUnits = items.reduce((acc, i) => acc + i.quantity, 0);
  const maintenanceCount = items.filter((i) => i.status === "MANTENIMIENTO" || i.status === "DAÑADO").length;
  const activeReservations = reservations.filter((r) => r.status !== "DEVUELTO").length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-primary">Producción Técnica y Logística</p>
          <h1 className="mt-2 text-3xl font-black">Inventario de Equipos y Logística</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Controla sonido, iluminación, backline, cables, vestuario, reservas por evento, entregas y devoluciones en tiempo real.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setResItemId(items[0]?.id ?? "");
                setResEventId(events[0]?.id ?? "");
                setResQuantity(1);
                setReserveOpen(true);
              }}
              className="rounded-2xl font-bold"
              disabled={!items.length || !events.length}
            >
              <Plus className="mr-2 size-4" />
              Reservar a evento
            </Button>
            <Button onClick={openNewItem} className="rounded-2xl font-black">
              <Plus className="mr-2 size-4" />
              Nuevo equipo
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricBox label="Referencias registradas" value={items.length} />
        <MetricBox label="Unidades totales" value={totalUnits} />
        <MetricBox label="Reservas activas / en campo" value={activeReservations} tone="text-blue-700" />
        <MetricBox label="En mantenimiento / dañados" value={maintenanceCount} tone="text-amber-700" />
      </div>

      <Tabs defaultValue="catalog" className="space-y-5">
        <TabsList className="flex h-auto w-full justify-start overflow-x-auto rounded-2xl p-1.5 sm:w-fit">
          <TabsTrigger value="catalog" className="rounded-xl">
            <PackageCheck className="mr-2 size-4" />
            Catálogo de equipos
          </TabsTrigger>
          <TabsTrigger value="reservations" className="rounded-xl">
            <CheckCircle2 className="mr-2 size-4" />
            Reservas y salidas por evento ({reservations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-4">
          <Card className="rounded-[2rem] shadow-none">
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar equipo, código, serial o ubicación…"
                  className="rounded-xl pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full rounded-xl sm:w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas las categorías</SelectItem>
                  {INVENTORY_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-52 rounded-[2rem]" />
              ))}
            </div>
          ) : filtered.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item) => {
                const available = getAvailableUnits(item, reservations);
                return (
                  <Card key={item.id} className="rounded-[2rem] shadow-none">
                    <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <Badge variant="outline" className="rounded-lg">{item.category}</Badge>
                          <Badge className={`rounded-lg ${STATUS_BADGE[item.status]}`}>{item.status}</Badge>
                        </div>
                        <h3 className="mt-3 text-lg font-black">{item.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {item.code ? `Cód: ${item.code} · ` : ""}
                          {item.serial_number ? `S/N: ${item.serial_number} · ` : ""}
                          {item.location || "Sin ubicación"}
                        </p>

                        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-3 text-center text-xs">
                          <div>
                            <p className="text-muted-foreground">Total</p>
                            <p className="text-lg font-black">{item.quantity}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Disponible hoy</p>
                            <p className={`text-lg font-black ${available > 0 ? "text-emerald-700" : "text-rose-600"}`}>
                              {available}
                            </p>
                          </div>
                        </div>

                        {item.maintenance_history.length > 0 && (
                          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Wrench className="size-3.5 text-amber-600" />
                            Último registro: {item.maintenance_history[0].date} · {item.maintenance_history[0].detail}
                          </p>
                        )}
                      </div>

                      {canManage && (
                        <div className="flex flex-wrap gap-2 border-t pt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditItem(item)}
                            className="rounded-xl"
                          >
                            <Pencil className="mr-1.5 size-3.5" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!events.length || available <= 0}
                            onClick={() => {
                              setResItemId(item.id);
                              setResEventId(events[0]?.id ?? "");
                              setResQuantity(1);
                              setReserveOpen(true);
                            }}
                            className="rounded-xl"
                          >
                            Reservar
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="ml-auto size-8 rounded-xl text-destructive"
                            onClick={async () => {
                              if (!membership || !session) return;
                              await deleteInventoryItem(membership.organizationId, session.user.id, item.id);
                              toast.success("Equipo eliminado");
                              void load();
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="rounded-[2rem] shadow-none">
              <CardContent className="p-12 text-center">
                <PackageCheck className="mx-auto size-11 text-primary" />
                <p className="mt-3 font-black">No hay equipos registrados</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Registra consolas, micrófonos, luces, cables, backline o vestuario para controlar salidas a eventos.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reservations" className="space-y-4">
          {reservations.length ? (
            <div className="space-y-3">
              {reservations.map((res) => (
                <Card key={res.id} className="rounded-3xl shadow-none">
                  <CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="rounded-lg">{res.status}</Badge>
                        <Badge variant="outline" className="rounded-lg">Cant: {res.quantity}</Badge>
                        <span className="font-black">{res.item?.name || "Equipo"}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Evento: <strong>{res.event?.name || "Evento"}</strong> ({res.event?.event_date || "—"}) · Resp:{" "}
                        {res.responsible_name || "Sin responsable"}
                      </p>
                      {res.notes && <p className="mt-1 text-xs text-muted-foreground">{res.notes}</p>}
                    </div>
                    {canManage && (
                      <div className="flex flex-wrap gap-2">
                        {(["RESERVADO", "ENTREGADO", "DEVUELTO"] as ReservationStatus[]).map((next) => (
                          <Button
                            key={next}
                            size="sm"
                            variant={res.status === next ? "default" : "outline"}
                            onClick={async () => {
                              if (!membership || !session) return;
                              await updateReservationStatus(membership.organizationId, session.user.id, res.id, next);
                              toast.success(`Estado actualizado a ${next}`);
                              void load();
                            }}
                            className="rounded-xl text-xs font-bold"
                          >
                            {next}
                          </Button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-[2rem] shadow-none">
              <CardContent className="p-12 text-center text-sm text-muted-foreground">
                No hay reservas registradas todavía.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[2rem] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">{editing ? "Editar equipo" : "Registrar equipo técnico"}</DialogTitle>
            <DialogDescription>Administra stock, ubicación, estado y bitácora de mantenimiento.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveItem} className="mt-2 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Nombre del equipo / recurso</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej. Consola digital X32 / Micrófono inalámbrico" className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Categoría</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INVENTORY_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado operativo</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as InventoryStatus)}>
                  <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DISPONIBLE">Disponible</SelectItem>
                    <SelectItem value="RESERVADO">Reservado</SelectItem>
                    <SelectItem value="EN USO">En uso</SelectItem>
                    <SelectItem value="MANTENIMIENTO">Mantenimiento</SelectItem>
                    <SelectItem value="DAÑADO">Dañado</SelectItem>
                    <SelectItem value="BAJA">Dado de baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Código interno</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="EQ-001" className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Número de serie</Label>
                <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Cantidad total</Label>
                <Input type="number" min={0} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Ubicación física</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
            </div>
            <div>
              <Label>Observaciones</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1.5 rounded-xl" />
            </div>
            <div>
              <Label>Agregar entrada rápida a bitácora de mantenimiento (opcional)</Label>
              <Input
                value={maintDetail}
                onChange={(e) => setMaintDetail(e.target.value)}
                placeholder="Ej. Cambio de cápsula / revisión de fuente"
                className="mt-1.5 rounded-xl"
              />
            </div>
            <Button disabled={saving} className="w-full rounded-xl font-black">
              {saving && <LoaderCircle className="mr-2 size-4 animate-spin" />}
              Guardar equipo
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reserve Dialog */}
      <Dialog open={reserveOpen} onOpenChange={setReserveOpen}>
        <DialogContent className="rounded-[2rem] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Reservar equipo para evento</DialogTitle>
            <DialogDescription>Asigna unidades disponibles al evento y registra responsable de entrega.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateReservation} className="mt-2 space-y-4">
            <div>
              <Label>Equipo</Label>
              <Select value={resItemId} onValueChange={setResItemId}>
                <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} (Disp: {getAvailableUnits(i, reservations)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Evento</Label>
              <Select value={resEventId} onValueChange={setResEventId}>
                <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>{ev.name} ({ev.event_date})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Cantidad</Label>
                <Input type="number" min={1} value={resQuantity} onChange={(e) => setResQuantity(Number(e.target.value))} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Responsable técnico</Label>
                <Input value={resResponsible} onChange={(e) => setResResponsible(e.target.value)} required className="mt-1.5 rounded-xl" />
              </div>
            </div>
            <div>
              <Label>Notas de salida</Label>
              <Textarea value={resNotes} onChange={(e) => setResNotes(e.target.value)} className="mt-1.5 rounded-xl" />
            </div>
            <Button disabled={saving} className="w-full rounded-xl font-black">
              {saving && <LoaderCircle className="mr-2 size-4 animate-spin" />}
              Confirmar reserva
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricBox({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return (
    <Card className="rounded-3xl shadow-none">
      <CardContent className="p-5">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
