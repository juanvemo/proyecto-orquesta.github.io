import type { Musician } from "@/features/musicians/types";

export type RehearsalStatus = "PLANIFICADO" | "CONFIRMADO" | "EN CURSO" | "FINALIZADO" | "CANCELADO";
export type InvitationStatus = "PENDIENTE" | "CONFIRMADO" | "NO PUEDO ASISTIR";
export type AttendanceStatus = "PRESENTE" | "AUSENTE" | "JUSTIFICADO" | "TARDE";

export interface RehearsalInvitation {
  id: string;
  organization_id: string;
  rehearsal_id: string;
  musician_id: string;
  response_status: InvitationStatus;
  response_note: string | null;
  invited_at: string;
  responded_at: string | null;
  public_token: string;
  musician: Musician | null;
}

export interface PublicRehearsalInvitation {
  invitation: { status: InvitationStatus; responded_at: string | null };
  musician: { name: string };
  rehearsal: { name: string; date: string; start_time: string; end_time: string; location: string; address: string | null; objective: string; observations: string | null; status: RehearsalStatus };
  organization: { name: string; logo_url: string | null };
}

export interface RehearsalAttendance {
  id: string;
  organization_id: string;
  rehearsal_id: string;
  musician_id: string;
  status: AttendanceStatus;
  arrival_time: string | null;
  departure_time: string | null;
  notes: string | null;
  musician: Musician | null;
}

export interface Rehearsal {
  id: string;
  organization_id: string;
  name: string;
  rehearsal_date: string;
  start_time: string;
  end_time: string;
  location: string;
  address: string | null;
  responsible_musician_id: string | null;
  objective: string;
  observations: string | null;
  status: RehearsalStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  responsible: Musician | null;
  rehearsal_musicians: RehearsalInvitation[];
  rehearsal_attendance: RehearsalAttendance[];
}

export interface RehearsalFormValues {
  name: string;
  rehearsal_date: string;
  start_time: string;
  end_time: string;
  location: string;
  address: string;
  responsible_musician_id: string;
  objective: string;
  observations: string;
  status: RehearsalStatus;
  musician_ids: string[];
}

export const emptyRehearsalForm: RehearsalFormValues = {
  name: "Ensayo general", rehearsal_date: new Date().toISOString().slice(0, 10), start_time: "19:00", end_time: "22:00",
  location: "", address: "", responsible_musician_id: "", objective: "", observations: "", status: "PLANIFICADO", musician_ids: [],
};
