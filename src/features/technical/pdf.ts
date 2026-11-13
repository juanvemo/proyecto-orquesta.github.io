import { createBrandedPdf } from "@/lib/brandedPdf";
import { createInitialRider } from "./service";
import type { RiderContent, TechnicalEvent } from "./types";

export async function downloadRiderPdf(event: TechnicalEvent, content: RiderContent) {
  const pdf = await createBrandedPdf(event.organization_letterhead, "RIDER TÉCNICO", event.name);
  const dirty = JSON.stringify(content) !== JSON.stringify(createInitialRider(event));
  pdf.paragraph(event.name, true, 15);
  pdf.paragraph(`Versión de referencia: ${event.rider?.current_version || 0} | ${dirty ? "Edición con cambios sin guardar" : event.rider?.status || "BORRADOR"}`);
  pdf.paragraph(`Fecha: ${new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date(`${event.event_date}T12:00:00`))} | Horario: ${event.start_time.slice(0, 5)} - ${event.end_time.slice(0, 5)}`);
  pdf.paragraph(`Cliente: ${event.client_name} | Lugar: ${event.venue}, ${event.city}`);
  pdf.section("Resumen y contacto técnico"); pdf.paragraph(content.general.summary || "Sin observaciones");
  pdf.paragraph(`Contacto: ${content.general.technical_contact || "Por definir"} | Teléfono: ${content.general.technical_phone || "Por definir"}`);
  pdf.section("Stage plot"); pdf.table(["Músico", "Posición", "Instrumentos", "Energía", "Notas"], content.stage_plot.map((row) => [row.performer, row.position, row.instruments, row.power, row.notes]));
  pdf.section("Input list / patch"); pdf.table(["Canal", "Fuente", "Mic / DI", "Soporte", "48V", "Notas"], content.input_list.map((row) => [row.channel, row.source, row.microphone, row.stand, row.phantom ? "Sí" : "No", row.notes]));
  pdf.section("Monitores"); pdf.table(["Mezcla", "Músico", "Tipo", "Requerimientos"], content.monitor_mixes.map((row) => [row.mix, row.musician, row.type, row.requirements]));
  pdf.section("Sonido");
  for (const [label, value] of [["Sistema PA", content.sound.pa], ["Consola", content.sound.console], ["Micrófonos", content.sound.microphones], ["Cajas directas", content.sound.di_boxes], ["Backline", content.sound.backline]]) pdf.paragraph(`${label}: ${value || "Por definir"}`);
  pdf.section("Iluminación y energía");
  for (const [label, value] of [["Iluminación", content.lighting.requirements], ["Voltaje", content.power.voltage], ["Circuitos", content.power.circuits], ["Puesta a tierra", content.power.grounding], ["Notas eléctricas", content.power.notes]]) pdf.paragraph(`${label}: ${value || "Por definir"}`);
  pdf.section("Logística");
  for (const [label, value] of [["Llegada", content.logistics.arrival_time], ["Prueba de sonido", content.logistics.soundcheck_time], ["Carga y descarga", content.logistics.load_in], ["Acceso", content.logistics.access], ["Parqueadero", content.logistics.parking], ["Transporte", content.logistics.transport], ["Hospitality", content.logistics.hospitality]]) pdf.paragraph(`${label}: ${value || "Por definir"}`);
  pdf.section("Contactos de producción"); pdf.table(["Nombre", "Rol", "Teléfono", "Correo"], content.contacts.map((row) => [row.name, row.role, row.phone, row.email]));
  if (content.final_notes) { pdf.section("Notas finales"); pdf.paragraph(content.final_notes); }
  pdf.save(`Rider_${event.name}_v${event.rider?.current_version || 0}${dirty ? "_sin_guardar" : ""}`);
}
