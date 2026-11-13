import { supabase } from "@/integrations/supabase/client";
import type { Availability, Instrument, MusicalRole, Musician, MusicianFormValues } from "./types";

const musicianSelect = "*,musician_instruments(id,is_primary,proficiency,instrument:instruments(id,organization_id,name,category,description,is_active)),musician_roles(id,is_primary,musical_role:musical_roles(id,organization_id,name,description,is_active)),availability(*)";

function normalizeMusician(value: unknown): Musician {
  const musician = value as Musician;
  return {
    ...musician,
    musician_instruments: Array.isArray(musician.musician_instruments) ? musician.musician_instruments : [],
    musician_roles: Array.isArray(musician.musician_roles) ? musician.musician_roles : [],
    availability: Array.isArray(musician.availability) ? musician.availability : [],
  };
}

export async function listMusicians(organizationId: string) {
  const { data, error } = await supabase.from("musicians").select(musicianSelect).eq("organization_id", organizationId).order("first_name");
  if (error) throw error;
  return (data ?? []).map(normalizeMusician);
}

export async function listMusicianDirectory(organizationId: string) {
  const { data, error } = await supabase.rpc("list_musician_directory", { target_organization_id: organizationId });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(normalizeMusician);
}

export async function getMusician(organizationId: string, musicianId: string) {
  const { data, error } = await supabase.from("musicians").select(musicianSelect).eq("organization_id", organizationId).eq("id", musicianId).single();
  if (error) throw error;
  return normalizeMusician(data);
}

export async function getMusicianCatalogs(organizationId: string) {
  const [instrumentResult, roleResult] = await Promise.all([
    supabase.from("instruments").select("*").eq("organization_id", organizationId).order("name"),
    supabase.from("musical_roles").select("*").eq("organization_id", organizationId).order("name"),
  ]);
  if (instrumentResult.error) throw instrumentResult.error;
  if (roleResult.error) throw roleResult.error;
  return { instruments: instrumentResult.data as Instrument[], roles: roleResult.data as MusicalRole[] };
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

export async function saveMusician(organizationId: string, values: MusicianFormValues, musicianId?: string) {
  const payload = {
    organization_id: organizationId,
    first_name: values.first_name.trim(), last_name: values.last_name.trim(), document_type: values.document_type,
    document_number: nullable(values.document_number), birth_date: values.birth_date || null, phone: nullable(values.phone),
    whatsapp: nullable(values.whatsapp), email: nullable(values.email), city: nullable(values.city), address: nullable(values.address),
    eps: nullable(values.eps), cali_commune: values.cali_commune ? Number(values.cali_commune) : null, photo_url: nullable(values.photo_url),
    emergency_contact_name: nullable(values.emergency_contact_name), emergency_contact_phone: nullable(values.emergency_contact_phone),
    observations: nullable(values.observations), level: values.level, specialty: nullable(values.specialty),
    experience_years: values.experience_years ? Number(values.experience_years) : null, biography: nullable(values.biography),
    joined_at: values.joined_at || null, status: values.status, participation_type: nullable(values.participation_type),
    habitual_rate: Number(values.habitual_rate || 0), event_rate: Number(values.event_rate || 0),
    rehearsal_rate: Number(values.rehearsal_rate || 0), updated_at: new Date().toISOString(),
  };

  const result = musicianId
    ? await supabase.from("musicians").update(payload).eq("id", musicianId).eq("organization_id", organizationId).select("id").single()
    : await supabase.from("musicians").insert(payload).select("id").single();
  if (result.error) throw result.error;
  const id = result.data.id;

  const [deleteInstruments, deleteRoles] = await Promise.all([
    supabase.from("musician_instruments").delete().eq("musician_id", id),
    supabase.from("musician_roles").delete().eq("musician_id", id),
  ]);
  if (deleteInstruments.error) throw deleteInstruments.error;
  if (deleteRoles.error) throw deleteRoles.error;

  const instrumentRows = values.instrument_ids.map((instrumentId) => ({ organization_id: organizationId, musician_id: id, instrument_id: instrumentId, is_primary: instrumentId === values.primary_instrument_id, proficiency: values.level === "INICIACIÓN" ? "BÁSICO" : values.level }));
  const roleRows = values.role_ids.map((roleId) => ({ organization_id: organizationId, musician_id: id, musical_role_id: roleId, is_primary: roleId === values.primary_role_id }));
  const [instrumentResult, roleResult] = await Promise.all([
    instrumentRows.length ? supabase.from("musician_instruments").insert(instrumentRows) : Promise.resolve({ error: null }),
    roleRows.length ? supabase.from("musician_roles").insert(roleRows) : Promise.resolve({ error: null }),
  ]);
  if (instrumentResult.error) throw instrumentResult.error;
  if (roleResult.error) throw roleResult.error;
  return id;
}

export async function setMusicianStatus(organizationId: string, musicianId: string, status: Musician["status"]) {
  const { error } = await supabase.from("musicians").update({ status, updated_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("id", musicianId);
  if (error) throw error;
}

export async function deleteMusician(organizationId: string, musician: Pick<Musician, "id" | "user_id">) {
  if (!musician.user_id) {
    const { error } = await supabase.from("musicians").delete().eq("organization_id", organizationId).eq("id", musician.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.functions.invoke("admin-manage-user", {
    body: { action: "delete", organization_id: organizationId, user_id: musician.user_id },
  });
  if (!error) return;

  let message = error.message;
  const context = (error as { context?: Response }).context;
  if (context) {
    try {
      const payload = await context.clone().json() as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // Preserve the invocation error when the response has no JSON body.
    }
  }
  throw new Error(message);
}

export async function saveAvailability(entry: Omit<Availability, "id">, id?: string) {
  const result = id ? await supabase.from("availability").update({ ...entry, updated_at: new Date().toISOString() }).eq("id", id) : await supabase.from("availability").insert(entry);
  if (result.error) throw result.error;
}

export async function deleteAvailability(id: string) {
  const { error } = await supabase.from("availability").delete().eq("id", id);
  if (error) throw error;
}

export async function saveCatalogItem(table: "instruments" | "musical_roles", organizationId: string, name: string, description: string, category?: string) {
  const payload = { organization_id: organizationId, name: name.trim(), description: nullable(description), ...(table === "instruments" ? { category: category || "OTROS" } : {}) };
  const { error } = await supabase.from(table).insert(payload);
  if (error) throw error;
}

export async function toggleCatalogItem(table: "instruments" | "musical_roles", id: string, isActive: boolean) {
  const { error } = await supabase.from(table).update({ is_active: isActive, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
