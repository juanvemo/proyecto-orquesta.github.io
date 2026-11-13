export type ContractStatus = "BORRADOR" | "ENVIADO" | "FIRMADO" | "ANULADO";

export interface ContractClause {
  id: string;
  title: string;
  content: string;
}

export interface ContractClientSummary {
  id?: string;
  full_name: string;
  company?: string | null;
  nit?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
}

export interface ContractEventSummary {
  id?: string;
  name: string;
  event_date: string;
  start_time?: string | null;
  end_time?: string | null;
  city?: string | null;
  venue?: string | null;
  address?: string | null;
  agreed_amount?: number | null;
  deposit_amount?: number | null;
  balance_amount?: number | null;
  client_id?: string | null;
  quote_id?: string | null;
}

export interface ContractRecord {
  id: string;
  organization_id: string;
  contract_number: string;
  client_id: string | null;
  quote_id: string | null;
  event_id: string | null;
  title: string;
  status: ContractStatus;
  public_token: string;
  total_amount: number;
  deposit_amount: number;
  balance_amount: number;
  clauses: ContractClause[];
  body_text: string;
  version: number;
  sent_at: string | null;
  signed_at: string | null;
  signer_name: string | null;
  signer_document: string | null;
  signer_email: string | null;
  signature_data_url: string | null;
  signature_metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: ContractClientSummary | null;
  event?: ContractEventSummary | null;
}

export interface PublicContractPayload {
  contract: ContractRecord;
  organization: {
    name: string;
    logo_url: string | null;
    primary_color?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
  };
  client: Partial<ContractClientSummary>;
  event: Partial<ContractEventSummary>;
}

export interface ContractDraftInput {
  id?: string;
  contract_number?: string;
  client_id?: string | null;
  quote_id?: string | null;
  event_id?: string | null;
  title: string;
  status: ContractStatus;
  total_amount: number;
  deposit_amount: number;
  balance_amount: number;
  clauses: ContractClause[];
  body_text: string;
}
