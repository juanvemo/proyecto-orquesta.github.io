import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit";
import { isMissingTableOrRpcError, readOrgFeatureFlag, writeOrgFeatureFlag } from "@/lib/orgStore";
import type {
  ContractClause,
  ContractClientSummary,
  ContractDraftInput,
  ContractEventSummary,
  ContractRecord,
  ContractStatus,
  PublicContractPayload,
} from "./types";

const CONTRACTS_FLAG_KEY = "contracts_store";

export function buildDefaultClauses(params: {
  orgName: string;
  eventName?: string;
  eventDate?: string;
  venue?: string;
  totalAmount?: number;
  depositAmount?: number;
}): ContractClause[] {
  const money = (v = 0) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
  return [
    {
      id: crypto.randomUUID(),
      title: "PRIMERA — Objeto del contrato",
      content: `${params.orgName} se compromete a prestar los servicios artísticos y musicales en vivo para el evento "${params.eventName || "Evento acordado"}", programado para el ${params.eventDate || "día acordado"} en ${params.venue || "el lugar definido por el contratante"}.`,
    },
    {
      id: crypto.randomUUID(),
      title: "SEGUNDA — Valor y forma de pago",
      content: `El valor total acordado por la presentación es de ${money(params.totalAmount)}. El contratante realiza un anticipo de ${money(params.depositAmount)} para reserva oficial de fecha y el saldo restante deberá cancelarse antes o al finalizar la presentación según lo pactado.`,
    },
    {
      id: crypto.randomUUID(),
      title: "TERCERA — Rider técnico, sonido y logística",
      content:
        "El contratante garantizará las condiciones técnicas, eléctricas (110V con polo a tierra), escenario seguro, camerino e hidratación acordadas en el Rider Técnico entregado por la orquesta, así como los permisos de ingreso y prueba de sonido.",
    },
    {
      id: crypto.randomUUID(),
      title: "CUARTA — Reprogramación y cancelaciones",
      content:
        "Cualquier solicitud de reprogramación deberá notificarse por escrito con al menos 15 días de antelación, sujeta a disponibilidad de agenda. El anticipo cubre la reserva exclusiva de la fecha.",
    },
  ];
}

function generatePublicToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeClauses(raw: unknown): ContractClause[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const obj = (item ?? {}) as Record<string, unknown>;
    return {
      id: String(obj.id || crypto.randomUUID()),
      title: String(obj.title || "Cláusula"),
      content: String(obj.content || ""),
    };
  });
}

function normalizeContract(row: Record<string, unknown>): ContractRecord {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    contract_number: String(row.contract_number || "CTR-001"),
    client_id: (row.client_id as string | null) ?? null,
    quote_id: (row.quote_id as string | null) ?? null,
    event_id: (row.event_id as string | null) ?? null,
    title: String(row.title || "Contrato de prestación de servicios musicales"),
    status: (row.status as ContractStatus) || "BORRADOR",
    public_token: String(row.public_token || ""),
    total_amount: Number(row.total_amount ?? 0),
    deposit_amount: Number(row.deposit_amount ?? 0),
    balance_amount: Number(row.balance_amount ?? 0),
    clauses: normalizeClauses(row.clauses),
    body_text: String(row.body_text ?? ""),
    version: Number(row.version ?? 1),
    sent_at: (row.sent_at as string | null) ?? null,
    signed_at: (row.signed_at as string | null) ?? null,
    signer_name: (row.signer_name as string | null) ?? null,
    signer_document: (row.signer_document as string | null) ?? null,
    signer_email: (row.signer_email as string | null) ?? null,
    signature_data_url: (row.signature_data_url as string | null) ?? null,
    signature_metadata: ((row.signature_metadata as Record<string, unknown>) ?? {}),
    created_by: (row.created_by as string | null) ?? null,
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || new Date().toISOString()),
    client: (row.client as ContractClientSummary | null) ?? null,
    event: (row.event as ContractEventSummary | null) ?? null,
  };
}

export async function listContracts(organizationId: string): Promise<ContractRecord[]> {
  const { data, error } = await supabase
    .from("contracts" as never)
    .select(
      "*, client:clients(id,full_name,company,nit,email,phone,city), event:events(id,name,event_date,start_time,end_time,city,venue,address,agreed_amount,deposit_amount,balance_amount)",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (!error) {
    return ((data ?? []) as Array<Record<string, unknown>>).map(normalizeContract);
  }
  if (!isMissingTableOrRpcError(error)) throw error;

  const fallbackRows = await readOrgFeatureFlag<Array<Record<string, unknown>>>(organizationId, CONTRACTS_FLAG_KEY, []);
  return fallbackRows
    .map(normalizeContract)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function listEventsAndClientsForContracts(organizationId: string) {
  const [eventsRes, clientsRes] = await Promise.all([
    supabase
      .from("events")
      .select("id,name,event_date,start_time,end_time,city,venue,address,agreed_amount,deposit_amount,balance_amount,client_id,quote_id,status")
      .eq("organization_id", organizationId)
      .order("event_date", { ascending: false }),
    supabase
      .from("clients")
      .select("id,full_name,company,nit,email,phone,city")
      .eq("organization_id", organizationId)
      .order("full_name"),
  ]);
  if (eventsRes.error) throw eventsRes.error;
  if (clientsRes.error) throw clientsRes.error;
  return {
    events: (eventsRes.data ?? []) as Array<ContractEventSummary & { id: string; status: string }>,
    clients: (clientsRes.data ?? []) as Array<ContractClientSummary & { id: string }>,
  };
}

export async function saveContract(
  organizationId: string,
  userId: string,
  input: ContractDraftInput,
  clientSummary?: ContractClientSummary | null,
  eventSummary?: ContractEventSummary | null,
): Promise<ContractRecord> {
  const now = new Date().toISOString();
  const number = input.contract_number?.trim() || `CTR-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
  const payload = {
    organization_id: organizationId,
    contract_number: number,
    client_id: input.client_id ?? null,
    quote_id: input.quote_id ?? null,
    event_id: input.event_id ?? null,
    title: input.title.trim(),
    status: input.status,
    total_amount: Number(input.total_amount || 0),
    deposit_amount: Number(input.deposit_amount || 0),
    balance_amount: Number(input.balance_amount || 0),
    clauses: input.clauses,
    body_text: input.body_text.trim(),
    sent_at: input.status === "ENVIADO" ? now : null,
    updated_at: now,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("contracts" as never)
      .update(payload as never)
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .select(
        "*, client:clients(id,full_name,company,nit,email,phone,city), event:events(id,name,event_date,start_time,end_time,city,venue,address,agreed_amount,deposit_amount,balance_amount)",
      )
      .single();

    if (!error && data) {
      await logAuditEvent({
        organizationId,
        userId,
        action: "UPDATE",
        entityType: "contract",
        entityId: input.id,
        newValue: { status: input.status, title: input.title, total_amount: input.total_amount },
      });
      return normalizeContract(data as Record<string, unknown>);
    }
    if (error && !isMissingTableOrRpcError(error)) throw error;

    const existing = await readOrgFeatureFlag<Array<Record<string, unknown>>>(organizationId, CONTRACTS_FLAG_KEY, []);
    const updated = existing.map((item) =>
      String(item.id) === input.id
        ? {
            ...item,
            ...payload,
            sent_at: input.status === "ENVIADO" ? (item.sent_at ?? now) : item.sent_at,
            client: clientSummary ?? item.client ?? null,
            event: eventSummary ?? item.event ?? null,
          }
        : item,
    );
    await writeOrgFeatureFlag(organizationId, CONTRACTS_FLAG_KEY, updated);
    const saved = updated.find((item) => String(item.id) === input.id);
    if (!saved) throw new Error("Contrato no encontrado");
    return normalizeContract(saved);
  }

  const publicToken = generatePublicToken();
  const insertPayload = {
    ...payload,
    public_token: publicToken,
    version: 1,
    created_by: userId,
    created_at: now,
  };

  const { data, error } = await supabase
    .from("contracts" as never)
    .insert(insertPayload as never)
    .select(
      "*, client:clients(id,full_name,company,nit,email,phone,city), event:events(id,name,event_date,start_time,end_time,city,venue,address,agreed_amount,deposit_amount,balance_amount)",
    )
    .single();

  if (!error && data) {
    const normalized = normalizeContract(data as Record<string, unknown>);
    await logAuditEvent({
      organizationId,
      userId,
      action: "CREATE",
      entityType: "contract",
      entityId: normalized.id,
      newValue: { contract_number: normalized.contract_number, status: normalized.status },
    });
    return normalized;
  }
  if (error && !isMissingTableOrRpcError(error)) throw error;

  const existing = await readOrgFeatureFlag<Array<Record<string, unknown>>>(organizationId, CONTRACTS_FLAG_KEY, []);
  const newRow: Record<string, unknown> = {
    ...insertPayload,
    id: crypto.randomUUID(),
    signed_at: null,
    signer_name: null,
    signer_document: null,
    signer_email: null,
    signature_data_url: null,
    signature_metadata: {},
    client: clientSummary ?? null,
    event: eventSummary ?? null,
  };
  await writeOrgFeatureFlag(organizationId, CONTRACTS_FLAG_KEY, [newRow, ...existing]);
  await logAuditEvent({
    organizationId,
    userId,
    action: "CREATE",
    entityType: "contract",
    entityId: String(newRow.id),
    newValue: { contract_number: number, status: input.status },
  });
  return normalizeContract(newRow);
}

export async function updateContractStatus(
  organizationId: string,
  userId: string,
  contractId: string,
  status: ContractStatus,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("contracts" as never)
    .update({
      status,
      ...(status === "ENVIADO" ? { sent_at: now } : {}),
      updated_at: now,
    } as never)
    .eq("id", contractId)
    .eq("organization_id", organizationId);

  if (!error) {
    await logAuditEvent({
      organizationId,
      userId,
      action: "UPDATE_STATUS",
      entityType: "contract",
      entityId: contractId,
      newValue: { status },
    });
    return;
  }
  if (!isMissingTableOrRpcError(error)) throw error;

  const existing = await readOrgFeatureFlag<Array<Record<string, unknown>>>(organizationId, CONTRACTS_FLAG_KEY, []);
  const next = existing.map((row) =>
    String(row.id) === contractId
      ? {
          ...row,
          status,
          sent_at: status === "ENVIADO" ? (row.sent_at ?? now) : row.sent_at,
          updated_at: now,
        }
      : row,
  );
  await writeOrgFeatureFlag(organizationId, CONTRACTS_FLAG_KEY, next);
}

export async function getPublicContract(accessToken: string): Promise<PublicContractPayload | null> {
  const { data, error } = await supabase.rpc("get_public_contract" as never, { access_token: accessToken } as never);
  if (!error) {
    if (!data) return null;
    const raw = data as Record<string, unknown>;
    return {
      contract: normalizeContract((raw.contract ?? {}) as Record<string, unknown>),
      organization: (raw.organization ?? { name: "Proyecto Orquesta", logo_url: null }) as PublicContractPayload["organization"],
      client: (raw.client ?? {}) as Partial<ContractClientSummary>,
      event: (raw.event ?? {}) as Partial<ContractEventSummary>,
    };
  }
  if (!isMissingTableOrRpcError(error)) throw error;

  const { data: settingsRows } = await supabase
    .from("organization_settings")
    .select("organization_id,feature_flags");

  for (const row of settingsRows ?? []) {
    const flags = (row.feature_flags ?? {}) as Record<string, unknown>;
    const list = Array.isArray(flags[CONTRACTS_FLAG_KEY]) ? (flags[CONTRACTS_FLAG_KEY] as Array<Record<string, unknown>>) : [];
    const found = list.find((c) => String(c.public_token) === accessToken);
    if (found) {
      const normalized = normalizeContract(found);
      const { data: org } = await supabase
        .from("organizations")
        .select("name,logo_url,primary_color,phone,whatsapp,email")
        .eq("id", String(row.organization_id))
        .maybeSingle();
      return {
        contract: normalized,
        organization: org ?? { name: "Proyecto Orquesta", logo_url: null },
        client: normalized.client ?? {},
        event: normalized.event ?? {},
      };
    }
  }
  return null;
}

export async function signPublicContract(input: {
  accessToken: string;
  signerName: string;
  signerDocument: string;
  signerEmail: string;
  signatureDataUrl: string;
}): Promise<ContractRecord> {
  const { data, error } = await supabase.rpc(
    "sign_public_contract" as never,
    {
      access_token: input.accessToken,
      signer_full_name: input.signerName,
      signer_doc: input.signerDocument,
      signer_mail: input.signerEmail,
      signature_image: input.signatureDataUrl,
    } as never,
  );
  if (!error && data) {
    return normalizeContract(data as Record<string, unknown>);
  }
  if (error && !isMissingTableOrRpcError(error)) throw error;

  const { data: settingsRows, error: settingsErr } = await supabase
    .from("organization_settings")
    .select("organization_id,feature_flags");
  if (settingsErr) throw settingsErr;

  for (const row of settingsRows ?? []) {
    const flags = (row.feature_flags ?? {}) as Record<string, unknown>;
    const list = Array.isArray(flags[CONTRACTS_FLAG_KEY]) ? (flags[CONTRACTS_FLAG_KEY] as Array<Record<string, unknown>>) : [];
    const index = list.findIndex((c) => String(c.public_token) === input.accessToken);
    if (index >= 0) {
      const target = list[index];
      if (target.status === "FIRMADO") throw new Error("Este contrato ya fue firmado y está bloqueado");
      if (target.status === "ANULADO") throw new Error("Este contrato fue anulado");
      const now = new Date().toISOString();
      const updatedContract = {
        ...target,
        status: "FIRMADO",
        signed_at: now,
        signer_name: input.signerName.trim(),
        signer_document: input.signerDocument.trim(),
        signer_email: input.signerEmail.trim(),
        signature_data_url: input.signatureDataUrl,
        signature_metadata: { signed_via: "public_link", accepted_terms: true, timestamp: now },
        updated_at: now,
      };
      const nextList = [...list];
      nextList[index] = updatedContract;
      await writeOrgFeatureFlag(String(row.organization_id), CONTRACTS_FLAG_KEY, nextList);
      return normalizeContract(updatedContract);
    }
  }
  throw new Error("Contrato no encontrado o enlace inválido");
}
