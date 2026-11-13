export type RiderStatus = "BORRADOR" | "LISTO" | "ENVIADO";

export interface StagePosition { id: string; performer: string; position: string; instruments: string; power: string; notes: string; }
export interface InputChannel { id: string; channel: string; source: string; microphone: string; stand: string; phantom: boolean; notes: string; }
export interface MonitorMix { id: string; mix: string; musician: string; type: string; requirements: string; }
export interface ProductionContact { id: string; name: string; role: string; phone: string; email: string; }

export interface RiderContent {
  general: { technical_contact: string; technical_phone: string; summary: string };
  stage_plot: StagePosition[];
  input_list: InputChannel[];
  monitor_mixes: MonitorMix[];
  sound: { pa: string; console: string; microphones: string; di_boxes: string; backline: string };
  lighting: { requirements: string };
  power: { voltage: string; circuits: string; grounding: string; notes: string };
  logistics: { arrival_time: string; soundcheck_time: string; load_in: string; access: string; parking: string; transport: string; hospitality: string };
  contacts: ProductionContact[];
  final_notes: string;
}

export interface RiderVersion {
  id: string;
  version_number: number;
  status: RiderStatus;
  content_snapshot: RiderContent;
  notes: string | null;
  created_at: string;
}

export interface EventRider {
  id: string;
  status: RiderStatus;
  current_version: number;
  technical_snapshot: Partial<RiderContent> & Record<string, unknown>;
  updated_at: string;
  versions: RiderVersion[];
}

export interface TechnicalMusician {
  id: string;
  name: string;
  specialty: string | null;
  photo_url: string | null;
  status: string;
  instruments: string[];
}

export interface TechnicalEvent {
  id: string;
  name: string;
  organization_name: string;
  organization_logo_url: string | null;
  event_type: string;
  event_date: string;
  start_time: string;
  end_time: string;
  city: string;
  venue: string;
  address: string;
  attendee_count: number | null;
  requirements: string | null;
  services: Array<Record<string, unknown>>;
  status: string;
  client_name: string;
  musicians: TechnicalMusician[];
  rider: EventRider | null;
}
