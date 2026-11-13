import { supabase } from "@/integrations/supabase/client";
import type { RiderContent, RiderStatus, TechnicalEvent } from "./types";

export async function listTechnicalEvents(organizationId: string) {
  const [eventsResult, organizationResult] = await Promise.all([
    supabase.rpc("get_technical_events", { target_organization_id: organizationId }),
    supabase.from("organizations").select("name,logo_url").eq("id", organizationId).single(),
  ]);
  if (eventsResult.error) throw eventsResult.error;
  if (organizationResult.error) throw organizationResult.error;
  return ((eventsResult.data ?? []) as TechnicalEvent[]).map((event) => ({ ...event, organization_name: organizationResult.data.name, organization_logo_url: organizationResult.data.logo_url }));
}

export async function generateTechnicalRider(eventId: string) {
  const { error } = await supabase.rpc("generate_event_rider", { target_event_id: eventId });
  if (error) throw error;
}

export async function saveRiderVersion(eventId: string, content: RiderContent, status: RiderStatus, notes: string) {
  const { error } = await supabase.rpc("save_rider_version", { target_event_id: eventId, rider_data: content, next_status: status, version_notes: notes || null });
  if (error) throw error;
}

export function createInitialRider(event: TechnicalEvent): RiderContent {
  const snapshot = event.rider?.technical_snapshot;
  if (snapshot?.general && snapshot?.stage_plot && snapshot?.input_list) return snapshot as unknown as RiderContent;
  const confirmed = event.musicians.filter((musician) => musician.status !== "NO DISPONIBLE");
  return {
    general: { technical_contact: "", technical_phone: "", summary: event.requirements ?? "" },
    stage_plot: confirmed.map((musician, index) => ({ id: crypto.randomUUID(), performer: musician.name, position: `Posición ${index + 1}`, instruments: musician.instruments.join(", ") || musician.specialty || "", power: "", notes: "" })),
    input_list: confirmed.flatMap((musician) => (musician.instruments.length ? musician.instruments : [musician.specialty || musician.name]).map((instrument, index) => ({ id: crypto.randomUUID(), channel: "", source: `${instrument}${index ? ` ${index + 1}` : ""}`, microphone: "", stand: "", phantom: false, notes: musician.name }))),
    monitor_mixes: confirmed.map((musician, index) => ({ id: crypto.randomUUID(), mix: `Mix ${index + 1}`, musician: musician.name, type: "Monitor de piso", requirements: "" })),
    sound: { pa: "", console: "", microphones: "", di_boxes: "", backline: "" },
    lighting: { requirements: "" },
    power: { voltage: "110V", circuits: "", grounding: "Tierra física requerida", notes: "" },
    logistics: { arrival_time: "", soundcheck_time: "", load_in: "", access: event.address, parking: "", transport: "", hospitality: "" },
    contacts: [],
    final_notes: "",
  };
}
