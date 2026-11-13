import { supabase } from "@/integrations/supabase/client";
import type { Contract, ContractClient, ContractContent, ContractDocument } from "./types";

export async function listContracts(organizationId: string) {
  const { data, error } = await supabase.from("contracts").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Contract[];
}
export async function getContractClients(organizationId: string) {
  const { data, error } = await supabase.rpc("get_contract_editor_context", { target_organization_id: organizationId });
  if (error) throw error;
  return (data as { clients: ContractClient[] }).clients;
}
export async function saveContract(organizationId: string, values: { title: string; client_id: string | null; new_client: ContractClient | null; content: ContractContent; valid_until: string | null }, contract?: Contract | null) {
  const { data, error } = await supabase.rpc("save_contract", { target_organization_id: organizationId, contract_data: values, target_contract_id: contract?.id ?? null, expected_version: contract?.version ?? null });
  if (error) throw error;
  return data as string;
}
export async function setContractStatus(contract: Contract, status: "ENVIADO" | "CANCELADO") {
  const { data, error } = await supabase.rpc("set_contract_status", { target_contract_id: contract.id, next_status: status, expected_version: contract.version });
  if (error) throw error;
  return data as string;
}
export async function getPublicContract(token: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return null;
  const { data, error } = await supabase.rpc("get_public_contract", { access_token: token });
  if (error) throw error;
  return data as ContractDocument | null;
}
export async function acceptContract(token: string, contract: ContractDocument, name: string, email: string, confirmed: boolean) {
  const { data, error } = await supabase.rpc("accept_public_contract", { access_token: token, expected_version: contract.version, expected_hash: contract.document_hash, respondent_name: name, respondent_email: email, acceptance_confirmation: confirmed });
  if (error) throw error;
  return data as ContractDocument;
}
