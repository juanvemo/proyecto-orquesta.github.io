import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit";
import { isMissingTableOrRpcError, readOrgFeatureFlag, writeOrgFeatureFlag } from "@/lib/orgStore";
import type { InventoryItem, InventoryReservation, MaintenanceEntry, ReservationStatus } from "./types";

const ITEMS_KEY = "inventory_items_store";
const RESERVATIONS_KEY = "inventory_reservations_store";

function normalizeMaintenance(raw: unknown): MaintenanceEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const obj = (entry ?? {}) as Record<string, unknown>;
    return {
      id: String(obj.id || crypto.randomUUID()),
      date: String(obj.date || new Date().toISOString().slice(0, 10)),
      detail: String(obj.detail || ""),
      performed_by: String(obj.performed_by || ""),
    };
  });
}

export async function listInventory(organizationId: string): Promise<{
  items: InventoryItem[];
  reservations: InventoryReservation[];
  events: Array<{ id: string; name: string; event_date: string; venue: string }>;
}> {
  const [itemsRes, resRes, eventsRes] = await Promise.all([
    supabase
      .from("inventory_items" as never)
      .select("*")
      .eq("organization_id", organizationId)
      .order("category")
      .order("name"),
    supabase
      .from("inventory_reservations" as never)
      .select("*, item:inventory_items(id,name,category,code), event:events(id,name,event_date,venue)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select("id,name,event_date,venue")
      .eq("organization_id", organizationId)
      .order("event_date", { ascending: false }),
  ]);

  if (eventsRes.error) throw eventsRes.error;
  const events = (eventsRes.data ?? []) as Array<{ id: string; name: string; event_date: string; venue: string }>;

  let items: InventoryItem[];
  if (!itemsRes.error) {
    items = ((itemsRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ...(row as unknown as Omit<InventoryItem, "maintenance_history">),
      quantity: Number(row.quantity ?? 1),
      maintenance_history: normalizeMaintenance(row.maintenance_history),
    }));
  } else if (isMissingTableOrRpcError(itemsRes.error)) {
    items = await readOrgFeatureFlag<InventoryItem[]>(organizationId, ITEMS_KEY, []);
  } else {
    throw itemsRes.error;
  }

  let reservations: InventoryReservation[];
  if (!resRes.error) {
    reservations = ((resRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ...(row as unknown as InventoryReservation),
      quantity: Number(row.quantity ?? 1),
    }));
  } else if (isMissingTableOrRpcError(resRes.error)) {
    const rawRes = await readOrgFeatureFlag<InventoryReservation[]>(organizationId, RESERVATIONS_KEY, []);
    reservations = rawRes.map((r) => ({
      ...r,
      item: items.find((i) => i.id === r.item_id) ?? r.item ?? null,
      event: events.find((e) => e.id === r.event_id) ?? r.event ?? null,
    }));
  } else {
    throw resRes.error;
  }

  return { items, reservations, events };
}

export function getAvailableUnits(item: InventoryItem, reservations: InventoryReservation[]): number {
  if (["MANTENIMIENTO", "DAÑADO", "BAJA"].includes(item.status)) return 0;
  const committed = reservations
    .filter((r) => r.item_id === item.id && (r.status === "RESERVADO" || r.status === "ENTREGADO"))
    .reduce((sum, r) => sum + Number(r.quantity || 0), 0);
  return Math.max(0, Number(item.quantity || 0) - committed);
}

export async function saveInventoryItem(
  organizationId: string,
  userId: string,
  input: Partial<InventoryItem> & Pick<InventoryItem, "name" | "category">,
): Promise<void> {
  const now = new Date().toISOString();
  const payload = {
    organization_id: organizationId,
    name: input.name.trim(),
    category: input.category,
    code: input.code?.trim() || null,
    serial_number: input.serial_number?.trim() || null,
    quantity: Math.max(0, Number(input.quantity ?? 1)),
    status: input.status ?? "DISPONIBLE",
    location: input.location?.trim() || null,
    photo_url: input.photo_url?.trim() || null,
    notes: input.notes?.trim() || null,
    maintenance_history: input.maintenance_history ?? [],
    updated_at: now,
  };

  if (input.id) {
    const { error } = await supabase
      .from("inventory_items" as never)
      .update(payload as never)
      .eq("id", input.id)
      .eq("organization_id", organizationId);
    if (!error) {
      await logAuditEvent({ organizationId, userId, action: "UPDATE", entityType: "inventory_item", entityId: input.id, newValue: payload });
      return;
    }
    if (!isMissingTableOrRpcError(error)) throw error;
    const current = await readOrgFeatureFlag<InventoryItem[]>(organizationId, ITEMS_KEY, []);
    await writeOrgFeatureFlag(
      organizationId,
      ITEMS_KEY,
      current.map((i) => (i.id === input.id ? { ...i, ...payload } : i)),
    );
    return;
  }

  const insertRow = { ...payload, created_at: now };
  const { error } = await supabase.from("inventory_items" as never).insert(insertRow as never);
  if (!error) {
    await logAuditEvent({ organizationId, userId, action: "CREATE", entityType: "inventory_item", newValue: payload });
    return;
  }
  if (!isMissingTableOrRpcError(error)) throw error;
  const current = await readOrgFeatureFlag<InventoryItem[]>(organizationId, ITEMS_KEY, []);
  await writeOrgFeatureFlag(organizationId, ITEMS_KEY, [{ ...(insertRow as Omit<InventoryItem, "id">), id: crypto.randomUUID() }, ...current]);
}

export async function deleteInventoryItem(organizationId: string, userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("inventory_items" as never)
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (!error) {
    await logAuditEvent({ organizationId, userId, action: "DELETE", entityType: "inventory_item", entityId: id });
    return;
  }
  if (!isMissingTableOrRpcError(error)) throw error;
  const current = await readOrgFeatureFlag<InventoryItem[]>(organizationId, ITEMS_KEY, []);
  await writeOrgFeatureFlag(organizationId, ITEMS_KEY, current.filter((i) => i.id !== id));
}

export async function createInventoryReservation(
  organizationId: string,
  userId: string,
  input: {
    itemId: string;
    eventId: string;
    quantity: number;
    responsibleName: string;
    notes: string;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const payload = {
    organization_id: organizationId,
    item_id: input.itemId,
    event_id: input.eventId || null,
    quantity: Math.max(1, Number(input.quantity || 1)),
    status: "RESERVADO" as ReservationStatus,
    responsible_name: input.responsibleName.trim() || null,
    notes: input.notes.trim() || null,
    created_at: now,
    updated_at: now,
  };
  const { error } = await supabase.from("inventory_reservations" as never).insert(payload as never);
  if (!error) {
    await logAuditEvent({ organizationId, userId, action: "CREATE", entityType: "inventory_reservation", newValue: payload });
    return;
  }
  if (!isMissingTableOrRpcError(error)) throw error;

  const current = await readOrgFeatureFlag<InventoryReservation[]>(organizationId, RESERVATIONS_KEY, []);
  const created: InventoryReservation = {
    ...payload,
    id: crypto.randomUUID(),
    checked_out_at: null,
    returned_at: null,
  };
  await writeOrgFeatureFlag(organizationId, RESERVATIONS_KEY, [created, ...current]);
}

export async function updateReservationStatus(
  organizationId: string,
  userId: string,
  reservationId: string,
  status: ReservationStatus,
): Promise<void> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status,
    updated_at: now,
  };
  if (status === "ENTREGADO") patch.checked_out_at = now;
  if (status === "DEVUELTO") patch.returned_at = now;

  const { error } = await supabase
    .from("inventory_reservations" as never)
    .update(patch as never)
    .eq("id", reservationId)
    .eq("organization_id", organizationId);
  if (!error) {
    await logAuditEvent({ organizationId, userId, action: "UPDATE_STATUS", entityType: "inventory_reservation", entityId: reservationId, newValue: { status } });
    return;
  }
  if (!isMissingTableOrRpcError(error)) throw error;

  const current = await readOrgFeatureFlag<InventoryReservation[]>(organizationId, RESERVATIONS_KEY, []);
  await writeOrgFeatureFlag(
    organizationId,
    RESERVATIONS_KEY,
    current.map((r) => (r.id === reservationId ? { ...r, ...patch } : r)),
  );
}
