import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit";
import { isMissingTableOrRpcError } from "@/lib/orgStore";
import type { Availability, Instrument, MusicalRole, Musician, MusicianFormValues } from "./types";

const musicianSelect = "*,musician_instruments(id,is_primary,proficiency,instrument:instruments(id,organization_id,name,category,description,is_active)),musician_roles(id,is_primary,musical_role:musical_roles(id,organization_id,name,description,is_active)),availability(*)";
const DELETED_TAG = "[ELIMINADO_DEFINITIVO]";

function normalizeMusician(value: unknown): Musician {
  const musician = value as Musician;
  return {
    ...musician,
    musician_instruments: Array.isArray(musician.musician_instruments) ? musician.musician_instruments : [],
    musician_roles: Array.isArray(musician.musician_roles) ? musician.musician_roles : [],
    availability: Array.isArray(musician.availability) ? musician.availability : [],
  };
}

function isSoftDeletedMusician(musician: Musician): boolean {
  return Boolean(musician.observations?.includes(DELETED_TAG));
}

export async function listMusicians(organizationId: string) {
  const { data, error } = await supabase.from("musicians").select(musicianSelect).eq("organization_id", organizationId).order("first_name");
  if (error) throw error;
  return (data ?? []).map(normalizeMusician).filter((m) => !isSoftDeletedMusician(m));
}

export async function listMusicianDirectory(organizationId: string) {
  const { data, error } = await supabase.rpc("list_musician_directory", { target_organization_id: organizationId });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(normalizeMusician).filter((m) => !isSoftDeletedMusician(m));
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

export async function deleteMusician(
  organizationId: string,
  musician: Pick<Musician, "id" | "user_id" | "first_name" | "last_name">,
  options: { anonymize?: boolean; actorUserId?: string } = {},
) {
  const anonymize = Boolean(options.anonymize);
  const fullName = `${musician.first_name ?? ""} ${musician.last_name ?? ""}`.trim() || "Músico";

  // 1. Try unified non-destructive historical snapshot RPC (deployed in master migration)
  const rpcResult = await supabase.rpc("admin_force_delete_musician", {
    target_organization_id: organizationId,
    target_musician_id: musician.id,
    anonymize_history: anonymize,
  });

  if (!rpcResult.error) {
    if (musician.user_id) {
      await supabase.functions.invoke("admin-manage-user", {
        body: { action: "delete", organization_id: organizationId, user_id: musician.user_id, anonymize },
      }).catch(() => undefined);
    }
    return;
  }

  // If error is unrelated to missing RPC, still try edge function and safe cleanup fallback
  const rpcMissing = isMissingTableOrRpcError(rpcResult.error);

  if (musician.user_id) {
    const fnRes = await supabase.functions.invoke("admin-manage-user", {
      body: { action: "delete", organization_id: organizationId, user_id: musician.user_id, anonymize },
    });
    if (!fnRes.error) return;
  } else if (!rpcMissing) {
    const directDel = await supabase.from("musicians").delete().eq("organization_id", organizationId).eq("id", musician.id);
    if (!directDel.error) {
      await logAuditEvent({
        organizationId,
        userId: options.actorUserId ?? null,
        action: "DELETE",
        entityType: "musician",
        entityId: musician.id,
        previousValue: { name: fullName, anonymize },
      });
      return;
    }
  }

  // 2. Guaranteed fallback when historical FK constraints exist and Edge Function / RPC aren't upgraded yet:
  // Clean up future operational assignments & availability, revoke access, and archive cleanly so musician disappears
  // from active directory without ever losing financial/attendance/event history.
  const today = new Date().toISOString().slice(0, 10);
  const { data: futureRehearsals } = await supabase
    .from("rehearsals")
    .select("id")
    .eq("organization_id", organizationId)
    .gte("rehearsal_date", today);
  const futureRehearsalIds = (futureRehearsals ?? []).map((r) => r.id);

  if (futureRehearsalIds.length) {
    await supabase
      .from("rehearsal_musicians")
      .delete()
      .eq("musician_id", musician.id)
      .in("rehearsal_id", futureRehearsalIds);
  }

  await supabase.from("availability").delete().eq("musician_id", musician.id);
  await supabase
    .from("music_task_assignees")
    .delete()
    .eq("musician_id", musician.id)
    .eq("status", "PENDIENTE");

  if (musician.user_id) {
    await supabase
      .from("organization_memberships")
      .update({ approval_status: "REJECTED" })
      .eq("organization_id", organizationId)
      .eq("user_id", musician.user_id);
  }

  // Attempt hard delete first (succeeds if there are no remaining historical references)
  const hardDelete = await supabase.from("musicians").delete().eq("organization_id", organizationId).eq("id", musician.id);
  if (hardDelete.error) {
    const updatePayload: Record<string, unknown> = {
      status: "INACTIVO",
      current_availability_status: "NO DISPONIBLE",
      observations: `${DELETED_TAG} Eliminado el ${new Date().toLocaleDateString("es-CO")}${anonymize ? " (anonimizado)" : ""}`,
      updated_at: new Date().toISOString(),
    };
    if (anonymize) {
      updatePayload.first_name = "Músico";
      updatePayload.last_name = "Retirado";
      updatePayload.email = null;
      updatePayload.phone = null;
      updatePayload.whatsapp = null;
      updatePayload.document_number = null;
      updatePayload.address = null;
      updatePayload.emergency_contact_name = null;
      updatePayload.emergency_contact_phone = null;
      updatePayload.photo_url = null;
    }
    const { error: archiveErr } = await supabase
      .from("musicians")
      .update(updatePayload)
      .eq("organization_id", organizationId)
      .eq("id", musician.id);
    if (archiveErr) throw archiveErr;
  }

  await logAuditEvent({
    organizationId,
    userId: options.actorUserId ?? null,
    action: "DELETE",
    entityType: "musician",
    entityId: musician.id,
    previousValue: { name: fullName, anonymize },
    newValue: { mode: "safe_historical_archive" },
  });
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
