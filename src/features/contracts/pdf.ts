import { createBrandedPdf } from "@/lib/brandedPdf";
import { contractDate, contractMoney, type ContractDocument } from "./types";

export async function downloadContractPdf(contract: ContractDocument) {
  const pdf = await createBrandedPdf(contract.organization_snapshot, "CONTRATO", `${contract.contract_number} · v${contract.version}`);
  const client = contract.client_snapshot;
  const money = (value: number) => contractMoney(value, contract.organization_snapshot.currency_code);
  pdf.paragraph(contract.title, true, 15);
  pdf.paragraph(`Estado: ${contract.status} | Versión: ${contract.version}`);
  pdf.section("Partes del contrato");
  pdf.paragraph(`Prestador: ${contract.organization_snapshot.name}`);
  pdf.paragraph(`Contratante: ${client.full_name}${client.company ? ` | ${client.company}` : ""}`);
  if (client.nit) pdf.paragraph(`Identificación / NIT: ${client.nit}`);
  pdf.paragraph(`Correo: ${client.email} | Teléfono: ${client.phone} | Ciudad: ${client.city}`);
  pdf.section("Objeto y servicios"); pdf.paragraph(contract.content.object);
  pdf.section("Fecha y lugar"); pdf.paragraph(`Fecha: ${contractDate(contract.content.service_date)}`); pdf.paragraph(`Lugar: ${contract.content.venue}`);
  pdf.section("Valor y forma de pago");
  pdf.table(["Valor total", "Anticipo", "Saldo"], [[money(contract.content.amount), money(contract.content.deposit), money(contract.content.amount - contract.content.deposit)]]);
  pdf.paragraph(contract.content.payment_terms);
  pdf.section("Cláusulas y obligaciones"); pdf.paragraph(contract.content.clauses);
  pdf.section(contract.accepted_at ? "Aceptación electrónica registrada" : "Aceptación pendiente");
  if (contract.accepted_at) {
    pdf.paragraph(`Firmante: ${contract.accepted_name}`);
    pdf.paragraph(`Correo: ${contract.accepted_email}`);
    pdf.paragraph(`Fecha: ${new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: contract.organization_snapshot.timezone || "America/Bogota" }).format(new Date(contract.accepted_at))}`);
    pdf.paragraph(contract.acceptance_text || "");
    pdf.paragraph(`Versión aceptada: ${contract.version}`);
  } else pdf.paragraph(`Fecha límite de aceptación: ${contractDate(contract.valid_until)}`);
  if (contract.document_hash) pdf.paragraph(`Huella SHA-256 del documento: ${contract.document_hash}`, false, 8);
  pdf.save(`${contract.contract_number}_v${contract.version}_${contract.status}`);
}
