import { supabase } from "@/integrations/supabase/client";
import type { AttendanceStatus, InvitationStatus, PublicRehearsalInvitation, Rehearsal, RehearsalFormValues } from "./types";

const personFields = "id,organization_id,user_id,first_name,last_name,document_type,document_number,birth_date,phone,whatsapp,email,city,photo_url,emergency_contact_name,emergency_contact_phone,observations,level,specialty,experience_years,biography,joined_at,status,participation_type,habitual_rate,event_rate,rehearsal_rate,current_availability_status,created_at,updated_at";
const rehearsalSelect = `*,responsible:musicians!rehearsals_responsible_musician_id_fkey(${personFields}),rehearsal_musicians(*,musician:musicians(${personFields})),rehearsal_attendance(*,musician:musicians(${personFields}))`;

export async function listRehearsals(organizationId: string) {
  const { data, error } = await supabase.from("rehearsals").select(rehearsalSelect).eq("organization_id", organizationId).order("rehearsal_date").order("start_time");
  if (error) throw error;
  return ((data ?? []) as unknown as Rehearsal[]).map(normalizeRehearsal);
}

export async function getRehearsal(organizationId: string, rehearsalId: string) {
  const { data, error } = await supabase.from("rehearsals").select(rehearsalSelect).eq("organization_id", organizationId).eq("id", rehearsalId).single();
  if (error) throw error;
  return normalizeRehearsal(data as unknown as Rehearsal);
}

export async function saveRehearsal(organizationId: string, userId: string, values: RehearsalFormValues, rehearsalId?: string) {
  const payload = { organization_id: organizationId, name: values.name.trim(), rehearsal_date: values.rehearsal_date, start_time: values.start_time, end_time: values.end_time, location: values.location.trim(), address: values.address.trim() || null, responsible_musician_id: values.responsible_musician_id || null, objective: values.objective.trim(), observations: values.observations.trim() || null, status: values.status, created_by: userId, updated_at: new Date().toISOString() };
  const result = rehearsalId ? await supabase.from("rehearsals").update(payload).eq("id", rehearsalId).select("id").single() : await supabase.from("rehearsals").insert(payload).select("id").single();
  if (result.error) throw result.error;
  const id = result.data.id;
  const { data: current, error: currentError } = await supabase.from("rehearsal_musicians").select("musician_id").eq("rehearsal_id", id);
  if (currentError) throw currentError;
  const currentIds = new Set((current ?? []).map((item) => item.musician_id));
  const desiredIds = new Set(values.musician_ids);
  const removed = [...currentIds].filter((musicianId) => !desiredIds.has(musicianId));
  const added = [...desiredIds].filter((musicianId) => !currentIds.has(musicianId));
  if (removed.length) { const { error } = await supabase.from("rehearsal_musicians").delete().eq("rehearsal_id", id).in("musician_id", removed); if (error) throw error; }
  if (added.length) {
    const { data: invitations, error } = await supabase.from("rehearsal_musicians").insert(added.map((musicianId) => ({ organization_id: organizationId, rehearsal_id: id, musician_id: musicianId }))).select("id");
    if (error) throw error;
    await Promise.allSettled((invitations ?? []).map((invitation) => sendRehearsalInvitation(invitation.id)));
  }
  return id;
}

export async function updateInvitation(id: string, responseStatus: InvitationStatus, note?: string) {
  const { error } = await supabase.from("rehearsal_musicians").update({ response_status: responseStatus, response_note: note?.trim() || null, responded_at: responseStatus === "PENDIENTE" ? null : new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function sendRehearsalInvitation(invitationId: string) {
  const { error } = await supabase.rpc("send_rehearsal_invitation", { target_invitation_id: invitationId });
  if (error) throw error;
}

export async function getPublicRehearsalInvitation(token: string) {
  const { data, error } = await supabase.rpc("get_public_rehearsal_invitation", { access_token: token });
  if (error) throw error;
  return data as PublicRehearsalInvitation | null;
}

export async function respondToRehearsalInvitation(token: string, action: "ACCEPT" | "DECLINE", note = "") {
  const { data, error } = await supabase.rpc("respond_to_rehearsal_invitation", { access_token: token, response_action: action, response_message: note || null });
  if (error) throw error;
  return data as InvitationStatus;
}

export async function upsertAttendance(organizationId: string, rehearsalId: string, musicianId: string, status: AttendanceStatus, recordedBy: string, arrivalTime?: string, departureTime?: string, notes?: string) {
  const { error } = await supabase.from("rehearsal_attendance").upsert({ organization_id: organizationId, rehearsal_id: rehearsalId, musician_id: musicianId, status, arrival_time: arrivalTime || null, departure_time: departureTime || null, notes: notes?.trim() || null, recorded_by: recordedBy, updated_at: new Date().toISOString() }, { onConflict: "rehearsal_id,musician_id" });
  if (error) throw error;
}

export async function updateRehearsalStatus(id: string, status: Rehearsal["status"]) {
  const { error } = await supabase.from("rehearsals").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

function normalizeRehearsal(rehearsal: Rehearsal): Rehearsal {
  return { ...rehearsal, rehearsal_musicians: rehearsal.rehearsal_musicians ?? [], rehearsal_attendance: rehearsal.rehearsal_attendance ?? [] };
}
