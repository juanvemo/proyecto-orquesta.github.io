export type MusicianStatus = "ACTIVO" | "INACTIVO" | "INVITADO" | "SUPLENTE" | "PROFESIONAL DE APOYO";
export type MusicianLevel = "INICIACIÓN" | "INTERMEDIO" | "AVANZADO" | "PROFESIONAL";
export type AvailabilityStatus = "DISPONIBLE" | "NO DISPONIBLE" | "TAL VEZ" | "DISPONIBLE CON RESTRICCIONES";

export interface Instrument {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  description: string | null;
  is_active: boolean;
}

export interface MusicalRole {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface MusicianInstrument {
  id: string;
  is_primary: boolean;
  proficiency: string;
  instrument: Instrument | null;
}

export interface MusicianRoleAssignment {
  id: string;
  is_primary: boolean;
  musical_role: MusicalRole | null;
}

export interface Availability {
  id: string;
  organization_id: string;
  musician_id: string;
  kind: "RECURRING" | "SPECIFIC";
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: AvailabilityStatus;
  restrictions: string | null;
  valid_from: string | null;
  valid_until: string | null;
}

export interface Musician {
  id: string;
  organization_id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  document_type: string;
  document_number: string | null;
  birth_date: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  eps: string | null;
  cali_commune: number | null;
  photo_url: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  observations: string | null;
  level: MusicianLevel;
  specialty: string | null;
  experience_years: number | null;
  biography: string | null;
  joined_at: string | null;
  status: MusicianStatus;
  current_availability_status: AvailabilityStatus;
  participation_type: string | null;
  habitual_rate: number;
  event_rate: number;
  rehearsal_rate: number;
  created_at: string;
  updated_at: string;
  musician_instruments: MusicianInstrument[];
  musician_roles: MusicianRoleAssignment[];
  availability: Availability[];
}

export interface MusicianFormValues {
  first_name: string;
  last_name: string;
  document_type: string;
  document_number: string;
  birth_date: string;
  phone: string;
  whatsapp: string;
  email: string;
  city: string;
  address: string;
  eps: string;
  cali_commune: string;
  photo_url: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  observations: string;
  level: MusicianLevel;
  specialty: string;
  experience_years: string;
  biography: string;
  joined_at: string;
  status: MusicianStatus;
  participation_type: string;
  habitual_rate: string;
  event_rate: string;
  rehearsal_rate: string;
  instrument_ids: string[];
  primary_instrument_id: string;
  role_ids: string[];
  primary_role_id: string;
}

export const emptyMusicianForm: MusicianFormValues = {
  first_name: "", last_name: "", document_type: "CC", document_number: "", birth_date: "",
  phone: "", whatsapp: "", email: "", city: "Cali", address: "", eps: "", cali_commune: "", photo_url: "", emergency_contact_name: "",
  emergency_contact_phone: "", observations: "", level: "INTERMEDIO", specialty: "",
  experience_years: "", biography: "", joined_at: new Date().toISOString().slice(0, 10), status: "ACTIVO",
  participation_type: "PLANTA", habitual_rate: "0", event_rate: "0", rehearsal_rate: "0",
  instrument_ids: [], primary_instrument_id: "", role_ids: [], primary_role_id: "",
};
