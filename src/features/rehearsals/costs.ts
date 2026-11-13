import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit";
import { isMissingTableOrRpcError, readOrgFeatureFlag, writeOrgFeatureFlag } from "@/lib/orgStore";

export interface RehearsalContribution {
  id: string;
  musician_id: string;
  musician_name_snapshot?: string | null;
  amount_due: number;
  status: "PENDIENTE" | "PAGADO";
  paid_at: string | null;
  confirmed_by: string | null;
  notes?: string | null;
  concept?: string | null;
  contribution_date?: string | null;
  created_at?: string;
  musician: { id: string; first_name: string; last_name: string; photo_url: string | null; user_id: string | null } | null;
}

export interface RehearsalCost {
  id: string;
  organization_id: string;
  rehearsal_id: string;
  total_amount: number;
  description: string | null;
  collector_user_id: string | null;
  collector_name: string;
  rehearsal_contributions: RehearsalContribution[];
}

type FallbackRehearsalCostsMap = Record<string, RehearsalCost>;
const FALLBACK_FLAG_KEY = "rehearsal_costs_fallback";

function getUnknownColumnName(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const err = error as { code?: string; message?: string };
  const code = String(err.code ?? "");
  const msg = String(err.message ?? "");
  if (code === "PGRST204" || code === "42703" || msg.includes("schema cache") || msg.includes("does not exist")) {
    const matchSingle = msg.match(/'([^']+)'/);
    if (matchSingle?.[1]) return matchSingle[1];
    const matchDouble = msg.match(/column\s+"?([a-zA-Z0-9_]+)"?/i);
    if (matchDouble?.[1]) return matchDouble[1];
    return "__unknown__";
  }
  return null;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  return String(err.code ?? "") === "23505" || String(err.message ?? "").toLowerCase().includes("duplicate key");
}

function isRlsOrPermissionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  const code = String(err.code ?? "");
  const msg = String(err.message ?? "").toLowerCase();
  return code === "42501" || msg.includes("row-level security") || msg.includes("permission denied");
}

function formatSaveError(error: unknown): Error {
  if (isRlsOrPermissionError(error)) {
    return new Error(
      "Permiso denegado en Supabase (RLS) al guardar los aportes. Ejecuta el script SQL actualizado en supabase/migrations/20261113_master_upgrade.sql.",
    );
  }
  if (error instanceof Error) return error;
  if (error && typeof error === "object" && "message" in error) {
    return new Error(String((error as { message: unknown }).message));
  }
  return new Error("Error inesperado guardando aportes de ensayo.");
}

async function stripMissingColumnsAndExecute<T>(
  initialPayload: Record<string, unknown>,
  executor: (payload: Record<string, unknown>) => PromiseLike<{ data: T; error: unknown }>,
  optionalColumns: string[] = ["updated_at", "created_by", "notes", "musician_name_snapshot"],
): Promise<T> {
  const payload = { ...initialPayload };
  const triedColumns = new Set<string>();

  for (let attempt = 0; attempt <= optionalColumns.length + 2; attempt++) {
    const res = await executor(payload);
    if (!res.error) return res.data;

    const missingCol = getUnknownColumnName(res.error);
    if (!missingCol) throw formatSaveError(res.error);

    if (missingCol !== "__unknown__" && missingCol in payload && !triedColumns.has(missingCol)) {
      triedColumns.add(missingCol);
      delete payload[missingCol];
      continue;
    }

    const nextOptional = optionalColumns.find((col) => col in payload && !triedColumns.has(col));
    if (nextOptional) {
      triedColumns.add(nextOptional);
      delete payload[nextOptional];
      continue;
    }

    throw formatSaveError(res.error);
  }

  throw new Error("No fue posible guardar el registro en la base de datos.");
}

export async function loadRehearsalCost(rehearsalId: string, organizationId?: string): Promise<RehearsalCost | null> {
  const { data, error } = await supabase
    .from("rehearsal_costs")
    .select("*,rehearsal_contributions(*,musician:musicians(id,first_name,last_name,photo_url,user_id))")
    .eq("rehearsal_id", rehearsalId)
    .maybeSingle();

  if (error && !isMissingTableOrRpcError(error) && !isRlsOrPermissionError(error)) {
    throw formatSaveError(error);
  }

  const dbCost = (data ?? null) as unknown as RehearsalCost | null;
  if (dbCost && dbCost.rehearsal_contributions.length > 0) {
    return dbCost;
  }

  if (organizationId) {
    const fallbackMap = await readOrgFeatureFlag<FallbackRehearsalCostsMap>(organizationId, FALLBACK_FLAG_KEY, {});
    const fallbackCost = fallbackMap[rehearsalId];
    if (fallbackCost) {
      if (!dbCost) return fallbackCost;
      return {
        ...dbCost,
        total_amount: fallbackCost.total_amount || dbCost.total_amount,
        description: fallbackCost.description || dbCost.description,
        rehearsal_contributions: fallbackCost.rehearsal_contributions,
      };
    }
  }

  return dbCost;
}

async function ensureRehearsalCostHeader(input: {
  organizationId: string;
  rehearsalId: string;
  totalAmount: number;
  description: string;
  collectorUserId: string;
  collectorName: string;
}): Promise<string> {
  const existing = await supabase
    .from("rehearsal_costs")
    .select("id")
    .eq("rehearsal_id", input.rehearsalId)
    .maybeSingle();
  if (existing.error) throw formatSaveError(existing.error);

  const now = new Date().toISOString();
  const safeDescription = input.description.trim() || "Aporte de ensayo";
  const updatePayload: Record<string, unknown> = {
    total_amount: Number(input.totalAmount),
    description: safeDescription,
    collector_user_id: input.collectorUserId,
    collector_name: input.collectorName.trim() || "Director",
    updated_at: now,
  };

  if (existing.data?.id) {
    await stripMissingColumnsAndExecute(
      updatePayload,
      (payload) => supabase.from("rehearsal_costs").update(payload).eq("id", existing.data!.id).select("id").maybeSingle(),
      ["updated_at"],
    );
    return existing.data.id;
  }

  const insertPayload: Record<string, unknown> = {
    organization_id: input.organizationId,
    rehearsal_id: input.rehearsalId,
    ...updatePayload,
    created_by: input.collectorUserId,
  };

  try {
    const inserted = await stripMissingColumnsAndExecute<{ id: string } | null>(
      insertPayload,
      (payload) => supabase.from("rehearsal_costs").insert(payload).select("id").single(),
      ["updated_at", "created_by"],
    );
    if (!inserted?.id) {
      throw new Error("No se obtuvo el identificador del costo de ensayo.");
    }
    return inserted.id;
  } catch (err) {
    if (isUniqueViolation(err)) {
      const retry = await supabase
        .from("rehearsal_costs")
        .select("id")
        .eq("rehearsal_id", input.rehearsalId)
        .maybeSingle();
      if (retry.data?.id) {
        await stripMissingColumnsAndExecute(
          updatePayload,
          (payload) => supabase.from("rehearsal_costs").update(payload).eq("id", retry.data!.id).select("id").maybeSingle(),
          ["updated_at"],
        );
        return retry.data.id;
      }
    }
    throw err;
  }
}

async function updateContributionRow(id: string, amountDue: number, notes: string | null) {
  await stripMissingColumnsAndExecute(
    {
      amount_due: amountDue,
      notes,
      updated_at: new Date().toISOString(),
    },
    (payload) => supabase.from("rehearsal_contributions").update(payload).eq("id", id).select("id").maybeSingle(),
    ["updated_at", "notes"],
  );
}

async function insertContributionRows(
  rows: Array<{
    organization_id: string;
    rehearsal_cost_id: string;
    musician_id: string;
    musician_name_snapshot?: string | null;
    amount_due: number;
    status: "PENDIENTE";
    notes: string | null;
  }>,
) {
  if (!rows.length) return;
  const now = new Date().toISOString();
  let omitNotes = false;
  let omitUpdatedAt = false;
  let omitSnapshot = false;

  for (let attempt = 0; attempt < 5; attempt++) {
    const payload = rows.map((row) => {
      const next: Record<string, unknown> = {
        organization_id: row.organization_id,
        rehearsal_cost_id: row.rehearsal_cost_id,
        musician_id: row.musician_id,
        amount_due: row.amount_due,
        status: row.status,
      };
      if (!omitSnapshot && row.musician_name_snapshot) next.musician_name_snapshot = row.musician_name_snapshot;
      if (!omitNotes) next.notes = row.notes;
      if (!omitUpdatedAt) next.updated_at = now;
      return next;
    });

    const res = await supabase.from("rehearsal_contributions").insert(payload);
    if (!res.error) return;

    if (isUniqueViolation(res.error)) {
      for (const row of rows) {
        const existing = await supabase
          .from("rehearsal_contributions")
          .select("id,status")
          .eq("rehearsal_cost_id", row.rehearsal_cost_id)
          .eq("musician_id", row.musician_id)
          .maybeSingle();
        if (existing.data?.id) {
          if (existing.data.status === "PENDIENTE") {
            await updateContributionRow(existing.data.id, row.amount_due, row.notes);
          }
        } else {
          await stripMissingColumnsAndExecute(
            {
              organization_id: row.organization_id,
              rehearsal_cost_id: row.rehearsal_cost_id,
              musician_id: row.musician_id,
              musician_name_snapshot: row.musician_name_snapshot ?? null,
              amount_due: row.amount_due,
              status: row.status,
              notes: row.notes,
              updated_at: now,
            },
            (singlePayload) => supabase.from("rehearsal_contributions").insert(singlePayload).select("id").single(),
            ["updated_at", "notes", "musician_name_snapshot"],
          );
        }
      }
      return;
    }

    const missingCol = getUnknownColumnName(res.error);
    if (!missingCol) throw formatSaveError(res.error);

    if (missingCol === "updated_at" && !omitUpdatedAt) {
      omitUpdatedAt = true;
      continue;
    }
    if (missingCol === "notes" && !omitNotes) {
      omitNotes = true;
      continue;
    }
    if (missingCol === "musician_name_snapshot" && !omitSnapshot) {
      omitSnapshot = true;
      continue;
    }
    if (!omitUpdatedAt) {
      omitUpdatedAt = true;
      continue;
    }
    if (!omitNotes) {
      omitNotes = true;
      continue;
    }
    if (!omitSnapshot) {
      omitSnapshot = true;
      continue;
    }
    throw formatSaveError(res.error);
  }
}

async function saveFallbackCost(input: {
  organizationId: string;
  rehearsalId: string;
  totalAmount: number;
  description: string;
  collectorUserId: string;
  collectorName: string;
  contributions: Array<{ musicianId: string; musicianName?: string; amount: number; notes?: string }>;
}): Promise<string> {
  const currentMap = await readOrgFeatureFlag<FallbackRehearsalCostsMap>(input.organizationId, FALLBACK_FLAG_KEY, {});
  const existingCost = currentMap[input.rehearsalId];
  const existingMap = new Map((existingCost?.rehearsal_contributions ?? []).map((c) => [c.musician_id, c]));

  const nextContribs: RehearsalContribution[] = [];
  for (const item of existingCost?.rehearsal_contributions ?? []) {
    if (item.status === "PAGADO") {
      nextContribs.push(item);
    }
  }
  for (const c of input.contributions) {
    if (c.amount <= 0) continue;
    const prev = existingMap.get(c.musicianId);
    if (prev?.status === "PAGADO") continue;
    nextContribs.push({
      id: prev?.id ?? crypto.randomUUID(),
      musician_id: c.musicianId,
      musician_name_snapshot: c.musicianName ?? prev?.musician_name_snapshot ?? null,
      amount_due: Number(c.amount),
      status: "PENDIENTE",
      paid_at: null,
      confirmed_by: null,
      notes: c.notes?.trim() || null,
      created_at: prev?.created_at ?? new Date().toISOString(),
      musician: prev?.musician ?? null,
    });
  }

  const costId = existingCost?.id ?? crypto.randomUUID();
  const nextCost: RehearsalCost = {
    id: costId,
    organization_id: input.organizationId,
    rehearsal_id: input.rehearsalId,
    total_amount: Number(input.totalAmount),
    description: input.description.trim() || "Aporte de ensayo",
    collector_user_id: input.collectorUserId,
    collector_name: input.collectorName.trim() || "Director",
    rehearsal_contributions: nextContribs,
  };

  await writeOrgFeatureFlag(input.organizationId, FALLBACK_FLAG_KEY, {
    ...currentMap,
    [input.rehearsalId]: nextCost,
  });
  return costId;
}

async function clearFallbackCost(organizationId: string, rehearsalId: string) {
  try {
    const currentMap = await readOrgFeatureFlag<FallbackRehearsalCostsMap>(organizationId, FALLBACK_FLAG_KEY, {});
    if (currentMap[rehearsalId]) {
      const next = { ...currentMap };
      delete next[rehearsalId];
      await writeOrgFeatureFlag(organizationId, FALLBACK_FLAG_KEY, next);
    }
  } catch {
    // Non-blocking cleanup
  }
}

export async function saveRehearsalCost(input: {
  organizationId: string;
  rehearsalId: string;
  totalAmount: number;
  description: string;
  collectorUserId: string;
  collectorName: string;
  contributions: Array<{ musicianId: string; musicianName?: string; amount: number; notes?: string }>;
}) {
  if (Number.isNaN(input.totalAmount) || input.totalAmount < 0) {
    throw new Error("El costo total no puede ser negativo.");
  }
  for (const c of input.contributions) {
    if (Number.isNaN(c.amount) || c.amount < 0) {
      throw new Error("Los montos de aportes no pueden ser negativos.");
    }
  }

  const desiredPositive = input.contributions.filter((item) => Number(item.amount) > 0 && Boolean(item.musicianId));
  const safeDescription = input.description.trim() || "Aporte de ensayo";

  // 1. Prefer SECURITY DEFINER RPC when available
  const rpcAttempt = await supabase.rpc("save_rehearsal_cost_distribution" as never, {
    target_organization_id: input.organizationId,
    target_rehearsal_id: input.rehearsalId,
    p_total_amount: Number(input.totalAmount),
    p_description: safeDescription,
    p_collector_name: input.collectorName.trim() || "Director",
    p_contributions: desiredPositive.map((c) => ({
      musician_id: c.musicianId,
      amount_due: Number(c.amount),
      notes: c.notes?.trim() || null,
    })),
  } as never);

  if (!rpcAttempt.error && rpcAttempt.data) {
    await clearFallbackCost(input.organizationId, input.rehearsalId);
    return String(rpcAttempt.data);
  }

  if (rpcAttempt.error && !isMissingTableOrRpcError(rpcAttempt.error)) {
    throw formatSaveError(rpcAttempt.error);
  }

  // 2. Direct PostgREST operations with automatic column-stripping & fallback
  try {
    const costId = await ensureRehearsalCostHeader({
      ...input,
      description: safeDescription,
    });

    const currentResult = await supabase
      .from("rehearsal_contributions")
      .select("id,musician_id,status")
      .eq("rehearsal_cost_id", costId);
    if (currentResult.error) throw formatSaveError(currentResult.error);

    const currentRows = currentResult.data ?? [];
    const existingByMusician = new Map(currentRows.map((item) => [item.musician_id, item]));
    const paidIds = new Set(currentRows.filter((item) => item.status === "PAGADO").map((item) => item.musician_id));
    const desiredIds = new Set(desiredPositive.map((item) => item.musicianId));

    const removedIds = currentRows
      .filter((item) => !desiredIds.has(item.musician_id) && item.status === "PENDIENTE")
      .map((item) => item.id);

    if (removedIds.length) {
      const { error: delError } = await supabase
        .from("rehearsal_contributions")
        .delete()
        .in("id", removedIds);
      if (delError) {
        if (isRlsOrPermissionError(delError)) {
          for (const rid of removedIds) {
            await supabase.from("rehearsal_contributions").update({ amount_due: 0 }).eq("id", rid);
          }
        } else {
          throw formatSaveError(delError);
        }
      }
    }

    const toUpdate = desiredPositive.filter((item) => !paidIds.has(item.musicianId) && existingByMusician.has(item.musicianId));
    const toInsert = desiredPositive.filter((item) => !paidIds.has(item.musicianId) && !existingByMusician.has(item.musicianId));

    for (const item of toUpdate) {
      const target = existingByMusician.get(item.musicianId)!;
      await updateContributionRow(target.id, Number(item.amount), item.notes?.trim() || null);
    }

    if (toInsert.length) {
      await insertContributionRows(
        toInsert.map((item) => ({
          organization_id: input.organizationId,
          rehearsal_cost_id: costId,
          musician_id: item.musicianId,
          musician_name_snapshot: item.musicianName ?? null,
          amount_due: Number(item.amount),
          status: "PENDIENTE",
          notes: item.notes?.trim() || null,
        })),
      );
    }

    await clearFallbackCost(input.organizationId, input.rehearsalId);
    await logAuditEvent({
      organizationId: input.organizationId,
      userId: input.collectorUserId,
      action: "UPSERT_COST",
      entityType: "rehearsal_cost",
      entityId: costId,
      newValue: { total_amount: input.totalAmount, contributors: desiredPositive.length },
    });

    return costId;
  } catch (directError) {
    // 3. Fallback to organization_settings store if direct RLS blocked write before SQL migration
    try {
      return await saveFallbackCost(input);
    } catch {
      throw directError instanceof Error ? directError : formatSaveError(directError);
    }
  }
}

export async function addOrUpdateSingleContribution(input: {
  organizationId: string;
  rehearsalId: string;
  musicianId: string;
  musicianName?: string;
  amount: number;
  concept: string;
  contributionDate: string;
  notes: string;
  collectorUserId: string;
  collectorName: string;
}) {
  if (Number.isNaN(input.amount) || input.amount <= 0) {
    throw new Error("El valor del aporte debe ser mayor a cero.");
  }

  const existingCost = await loadRehearsalCost(input.rehearsalId, input.organizationId);
  const existingContrib = existingCost?.rehearsal_contributions.find((c) => c.musician_id === input.musicianId);
  const previousPaid = existingContrib?.status === "PAGADO" ? Number(existingContrib.amount_due) : 0;

  if (existingContrib?.status === "PAGADO") {
    throw new Error("Este músico ya tiene su aporte pagado y confirmado para este ensayo.");
  }

  const othersTotal = (existingCost?.rehearsal_contributions ?? [])
    .filter((c) => c.musician_id !== input.musicianId)
    .reduce((sum, c) => sum + Number(c.amount_due), 0);
  const nextTotal = Math.max(Number(existingCost?.total_amount ?? 0), othersTotal + input.amount + previousPaid);

  const formattedNote = [
    input.concept.trim() ? `Concepto: ${input.concept.trim()}` : "",
    input.contributionDate ? `Fecha: ${input.contributionDate}` : "",
    input.notes.trim(),
  ]
    .filter(Boolean)
    .join(" · ");

  const mergedContributions = [
    ...(existingCost?.rehearsal_contributions ?? [])
      .filter((c) => c.musician_id !== input.musicianId)
      .map((c) => ({
        musicianId: c.musician_id,
        musicianName: c.musician ? `${c.musician.first_name} ${c.musician.last_name}`.trim() : c.musician_name_snapshot ?? undefined,
        amount: Number(c.amount_due),
        notes: c.notes ?? undefined,
      })),
    {
      musicianId: input.musicianId,
      musicianName: input.musicianName,
      amount: input.amount,
      notes: formattedNote || undefined,
    },
  ];

  await saveRehearsalCost({
    organizationId: input.organizationId,
    rehearsalId: input.rehearsalId,
    totalAmount: nextTotal,
    description: existingCost?.description || input.concept.trim() || "Aporte de ensayo",
    collectorUserId: input.collectorUserId,
    collectorName: input.collectorName,
    contributions: mergedContributions,
  });
}

export async function confirmContributionPayment(id: string, userId: string, organizationId: string, rehearsalId?: string) {
  const rpcResult = await supabase.rpc("set_rehearsal_contribution_status", {
    target_contribution_id: id,
    target_status: "PAGADO",
  });

  if (rpcResult.error) {
    const paidAt = new Date().toISOString();
    let directDone = false;
    try {
      await stripMissingColumnsAndExecute(
        {
          status: "PAGADO",
          paid_at: paidAt,
          confirmed_by: userId,
          updated_at: paidAt,
        },
        (payload) => supabase.from("rehearsal_contributions").update(payload).eq("id", id).select("id").maybeSingle(),
        ["updated_at"],
      );
      directDone = true;
    } catch {
      directDone = false;
    }

    if (!directDone && rehearsalId) {
      const currentMap = await readOrgFeatureFlag<FallbackRehearsalCostsMap>(organizationId, FALLBACK_FLAG_KEY, {});
      const targetCost = currentMap[rehearsalId];
      if (targetCost) {
        const updatedCost: RehearsalCost = {
          ...targetCost,
          rehearsal_contributions: targetCost.rehearsal_contributions.map((c) =>
            c.id === id ? { ...c, status: "PAGADO", paid_at: paidAt, confirmed_by: userId } : c,
          ),
        };
        await writeOrgFeatureFlag(organizationId, FALLBACK_FLAG_KEY, {
          ...currentMap,
          [rehearsalId]: updatedCost,
        });
        return;
      }
    }

    if (!directDone) {
      throw formatSaveError(rpcResult.error);
    }
  }

  await logAuditEvent({
    organizationId,
    userId,
    action: "PAY",
    entityType: "rehearsal_contribution",
    entityId: id,
    newValue: { status: "PAGADO" },
  });
}
