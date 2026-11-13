export type InventoryStatus = "DISPONIBLE" | "RESERVADO" | "EN USO" | "MANTENIMIENTO" | "DAÑADO" | "BAJA";
export type ReservationStatus = "RESERVADO" | "ENTREGADO" | "DEVUELTO";

export const INVENTORY_CATEGORIES = [
  "Sonido",
  "Iluminación",
  "Backline",
  "Cables",
  "Accesorios",
  "Vestuario",
  "Transporte",
  "Otros",
] as const;

export interface MaintenanceEntry {
  id: string;
  date: string;
  detail: string;
  performed_by: string;
}

export interface InventoryItem {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  code: string | null;
  serial_number: string | null;
  quantity: number;
  status: InventoryStatus;
  location: string | null;
  photo_url: string | null;
  notes: string | null;
  maintenance_history: MaintenanceEntry[];
  created_at: string;
  updated_at: string;
}

export interface InventoryReservation {
  id: string;
  organization_id: string;
  item_id: string;
  event_id: string | null;
  quantity: number;
  status: ReservationStatus;
  responsible_name: string | null;
  notes: string | null;
  checked_out_at: string | null;
  returned_at: string | null;
  created_at: string;
  updated_at: string;
  item?: { id: string; name: string; category: string; code: string | null } | null;
  event?: { id: string; name: string; event_date: string; venue: string } | null;
}
