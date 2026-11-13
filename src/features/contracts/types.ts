export type ContractStatus = "BORRADOR" | "ENVIADO" | "FIRMADO" | "CANCELADO";
export interface LetterheadData {
  name: string;
  logo_url: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  currency_code?: string;
  timezone?: string;
}
export interface ContractClient {
  id?: string;
  full_name: string;
  company: string | null;
  nit: string | null;
  email: string;
  phone: string;
  whatsapp: string | null;
  city: string;
  client_type?: string;
}
export interface ContractContent {
  object: string;
  service_date: string;
  venue: string;
  amount: number;
  deposit: number;
  payment_terms: string;
  clauses: string;
}
export interface ContractDocument {
  contract_number: string;
  title: string;
  status: ContractStatus;
  version: number;
  content: ContractContent;
  organization_snapshot: LetterheadData;
  client_snapshot: ContractClient;
  valid_until: string | null;
  document_hash: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  accepted_name: string | null;
  accepted_email: string | null;
  acceptance_text: string | null;
}
export interface Contract extends ContractDocument {
  id: string;
  organization_id: string;
  client_id: string;
  public_token: string;
  updated_at: string;
}
export const contractConsent = "Confirmo que he leído el contrato completo y acepto los servicios, valores, obligaciones y condiciones descritos. Manifiesto mi voluntad de celebrarlo mediante esta aceptación electrónica.";
export function contractMoney(value: number, currency = "COP") {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}
export function contractDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date(`${value}T12:00:00`)) : "Sin fecha límite";
}
export function contractError(error: unknown) {
  return error && typeof error === "object" && "message" in error ? String(error.message) : "No fue posible completar la operación.";
}
