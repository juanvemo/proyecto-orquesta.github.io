import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { assetUrl } from "@/lib/assets";
import type { LetterheadData } from "@/features/contracts/types";

async function loadLogo(organization: LetterheadData) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = assetUrl(organization.logo_url || "/assets/proyecto-orquesta-logo.png");
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("No se pudo cargar el logo para el PDF. Revisa el logo en Configuración y vuelve a intentar."));
  });
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 600 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("El navegador no permite preparar el logo para el PDF.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { data: canvas.toDataURL("image/png"), ratio: image.naturalWidth / image.naturalHeight };
}

export async function createBrandedPdf(organization: LetterheadData, label: string, reference: string) {
  const logo = await loadLogo(organization);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 49;
  const paragraph = (text: string, bold = false, size = 10) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(40, 44, 55);
    const lines = doc.splitTextToSize(text || "—", 180) as string[];
    const lineHeight = size * 0.48;
    for (const line of lines) {
      if (y + lineHeight > 274) { doc.addPage(); y = 49; }
      doc.text(line, 15, y);
      y += lineHeight;
    }
    y += 3;
  };
  const section = (title: string) => {
    if (y > 254) { doc.addPage(); y = 49; }
    y += 3;
    paragraph(title, true, 12);
  };
  const table = (headers: string[], rows: string[][]) => {
    autoTable(doc, {
      head: [headers], body: rows.length ? rows : [headers.map((_, index) => index ? "" : "Sin información registrada")],
      startY: y, margin: { top: 49, bottom: 23, left: 15, right: 15 },
      styles: { font: "helvetica", fontSize: 9, cellPadding: 2.5, overflow: "linebreak" },
      headStyles: { fillColor: [91, 33, 244], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [247, 245, 251] },
      rowPageBreak: "avoid",
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  };
  const save = (filename: string) => {
    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page++) {
      doc.setPage(page);
      const width = logo.ratio >= 1 ? 24 : 24 * logo.ratio;
      const height = logo.ratio >= 1 ? 24 / logo.ratio : 24;
      doc.addImage(logo.data, "PNG", 15 + (24 - width) / 2, 10 + (24 - height) / 2, width, height);
      doc.setTextColor(40, 44, 55);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text(doc.splitTextToSize(organization.name, 105).slice(0, 2), 43, 14);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      const contact = [organization.email, organization.phone, organization.website].filter(Boolean).join(" | ");
      doc.text(doc.splitTextToSize(contact, 105).slice(0, 2), 43, 26);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text(label, 195, 14, { align: "right" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(7);
      doc.text(doc.splitTextToSize(reference, 43), 195, 21, { align: "right" });
      doc.setDrawColor(91, 33, 244); doc.setLineWidth(0.7); doc.line(15, 39, 195, 39);
      doc.setLineWidth(0.3); doc.line(15, 282, 195, 282);
      doc.setTextColor(85, 91, 105); doc.setFontSize(7);
      doc.text(doc.splitTextToSize(`${organization.name} · Documento privado`, 145)[0], 15, 287);
      doc.text(`${page} / ${pageCount}`, 195, 287, { align: "right" });
    }
    doc.save(`${filename.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]/g, "_")}.pdf`);
  };
  return { paragraph, section, table, save };
}
