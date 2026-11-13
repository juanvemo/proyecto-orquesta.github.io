import type { Availability, Musician } from "./types";

export type AvailabilityMatchState = "DISPONIBLE" | "CON RESTRICCIONES" | "NO DISPONIBLE" | "CRUCE DE HORARIO" | "SIN REGISTRO";

export interface AvailabilityMatchResult {
  state: AvailabilityMatchState;
  label: string;
  reason: string;
  toneClass: string;
}

const WEEKDAY_NAMES = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"] as const;

function toMinutes(time: string | null | undefined): number | null {
  if (!time || typeof time !== "string") return null;
  const parts = time.slice(0, 5).split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function getWeekdayIndex(dateStr: string): number {
  const date = new Date(`${dateStr}T12:00:00`);
  const day = date.getDay();
  return Number.isNaN(day) ? 0 : day;
}

function normalizeDayToIndex(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 && value <= 6 ? value : null;
  }
  const clean = String(value)
    .trim()
    .toUpperCase()
    .replace("MIERCOLES", "MIÉRCOLES")
    .replace("SABADO", "SÁBADO");
  if (/^[0-6]$/.test(clean)) return Number(clean);
  const idx = WEEKDAY_NAMES.indexOf(clean as (typeof WEEKDAY_NAMES)[number]);
  return idx >= 0 ? idx : null;
}

function isWithinValidity(entry: Availability, targetDate: string): boolean {
  if (!targetDate) return true;
  if (entry.valid_from && targetDate < entry.valid_from) return false;
  if (entry.valid_until && targetDate > entry.valid_until) return false;
  return true;
}

export interface ConflictSlot {
  id: string;
  name: string;
  date: string;
  start_time: string;
  end_time: string;
  musician_ids: string[];
}

export function evaluateMusicianAvailability(
  musician: Musician,
  rehearsalDate: string,
  startTime: string,
  endTime: string,
  conflicts: ConflictSlot[] = [],
  currentRehearsalId?: string,
): AvailabilityMatchResult {
  const reqStart = toMinutes(startTime) ?? 19 * 60;
  const reqEnd = toMinutes(endTime) ?? 22 * 60;

  // 1. Check schedule conflict with another rehearsal or event on the same date/time
  const overlappingConflict = conflicts.find((slot) => {
    if (slot.id === currentRehearsalId) return false;
    if (slot.date !== rehearsalDate) return false;
    if (!slot.musician_ids.includes(musician.id)) return false;
    const sStart = toMinutes(slot.start_time) ?? 0;
    const sEnd = toMinutes(slot.end_time) ?? 24 * 60;
    return intervalsOverlap(reqStart, reqEnd, sStart, sEnd);
  });

  if (overlappingConflict) {
    return {
      state: "CRUCE DE HORARIO",
      label: "Cruce de horario",
      reason: `Ya convocado a "${overlappingConflict.name}" (${overlappingConflict.start_time.slice(0, 5)}–${overlappingConflict.end_time.slice(0, 5)})`,
      toneClass: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
    };
  }

  const entries = musician.availability ?? [];

  // 2. Specific date override (specific_date === rehearsalDate)
  const dateSpecific = entries.filter((e) => e.specific_date === rehearsalDate);
  if (dateSpecific.length > 0) {
    const blocked = dateSpecific.find((e) => {
      if (e.status !== "NO DISPONIBLE") return false;
      const eStart = toMinutes(e.start_time) ?? 0;
      const eEnd = toMinutes(e.end_time) ?? 24 * 60;
      return intervalsOverlap(reqStart, reqEnd, eStart, eEnd);
    });
    if (blocked) {
      return {
        state: "NO DISPONIBLE",
        label: "No disponible",
        reason: blocked.restrictions ? `Bloqueo fecha: ${blocked.restrictions}` : "No disponible en esta fecha y horario",
        toneClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
      };
    }

    const availableMatch = dateSpecific.find((e) => {
      if (e.status !== "DISPONIBLE") return false;
      const eStart = toMinutes(e.start_time) ?? 0;
      const eEnd = toMinutes(e.end_time) ?? 24 * 60;
      return reqStart >= eStart && reqEnd <= eEnd;
    });
    if (availableMatch) {
      return {
        state: "DISPONIBLE",
        label: "Disponible",
        reason: `Disponible (${availableMatch.start_time?.slice(0, 5) ?? "00:00"}–${availableMatch.end_time?.slice(0, 5) ?? "23:59"})`,
        toneClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      };
    }

    const restricted = dateSpecific.find(
      (e) =>
        e.status === "DISPONIBLE CON RESTRICCIONES" ||
        e.status === "TAL VEZ" ||
        e.status === "DISPONIBLE",
    );
    if (restricted) {
      return {
        state: "CON RESTRICCIONES",
        label: restricted.status === "TAL VEZ" ? "Tal vez" : "Con restricciones",
        reason:
          restricted.restrictions ||
          `Franja registrada: ${restricted.start_time?.slice(0, 5) ?? "00:00"}–${restricted.end_time?.slice(0, 5) ?? "23:59"}`,
        toneClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
      };
    }
  }

  // 3. Weekly recurring rules matching weekday
  if (rehearsalDate) {
    const weekdayIdx = getWeekdayIndex(rehearsalDate);
    const weekdayName = WEEKDAY_NAMES[weekdayIdx] ?? "LUNES";
    const weekdayEntries = entries.filter(
      (e) =>
        !e.specific_date &&
        isWithinValidity(e, rehearsalDate) &&
        normalizeDayToIndex(e.day_of_week) === weekdayIdx,
    );

    if (weekdayEntries.length > 0) {
      const noDisp = weekdayEntries.find((e) => {
        if (e.status !== "NO DISPONIBLE") return false;
        const eStart = toMinutes(e.start_time) ?? 0;
        const eEnd = toMinutes(e.end_time) ?? 24 * 60;
        return intervalsOverlap(reqStart, reqEnd, eStart, eEnd);
      });
      if (noDisp) {
        return {
          state: "NO DISPONIBLE",
          label: "No disponible",
          reason: noDisp.restrictions || `Regla semanal (${weekdayName}): No disponible`,
          toneClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
        };
      }

      const fullMatch = weekdayEntries.find((e) => {
        if (e.status !== "DISPONIBLE") return false;
        const eStart = toMinutes(e.start_time) ?? 0;
        const eEnd = toMinutes(e.end_time) ?? 24 * 60;
        return reqStart >= eStart && reqEnd <= eEnd;
      });
      if (fullMatch) {
        return {
          state: "DISPONIBLE",
          label: "Disponible",
          reason: `Horario semanal compatible (${fullMatch.start_time?.slice(0, 5) ?? "00:00"}–${fullMatch.end_time?.slice(0, 5) ?? "23:59"})`,
          toneClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
        };
      }

      const restrictedMatch = weekdayEntries.find((e) => {
        if (e.status !== "DISPONIBLE CON RESTRICCIONES" && e.status !== "TAL VEZ") return false;
        const eStart = toMinutes(e.start_time) ?? 0;
        const eEnd = toMinutes(e.end_time) ?? 24 * 60;
        return intervalsOverlap(reqStart, reqEnd, eStart, eEnd);
      });
      if (restrictedMatch) {
        return {
          state: "CON RESTRICCIONES",
          label: restrictedMatch.status === "TAL VEZ" ? "Tal vez" : "Con restricciones",
          reason:
            restrictedMatch.restrictions ||
            `Horario ${restrictedMatch.status.toLowerCase()} (${restrictedMatch.start_time?.slice(0, 5) ?? "00:00"}–${restrictedMatch.end_time?.slice(0, 5) ?? "23:59"})`,
          toneClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
        };
      }

      const partialMatch = weekdayEntries.find((e) => {
        if (e.status !== "DISPONIBLE") return false;
        const eStart = toMinutes(e.start_time) ?? 0;
        const eEnd = toMinutes(e.end_time) ?? 24 * 60;
        return intervalsOverlap(reqStart, reqEnd, eStart, eEnd);
      });
      if (partialMatch) {
        return {
          state: "CON RESTRICCIONES",
          label: "Cobertura parcial",
          reason: `Cubre parcialmente (${partialMatch.start_time?.slice(0, 5) ?? "00:00"}–${partialMatch.end_time?.slice(0, 5) ?? "23:59"})`,
          toneClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
        };
      }
    }
  }

  // 4. Fallback to general current_availability_status
  if (musician.current_availability_status === "DISPONIBLE") {
    return {
      state: "DISPONIBLE",
      label: "Disponible",
      reason: entries.length ? "Estado general disponible (sin franja específica para este día)" : "Estado general: Disponible",
      toneClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    };
  }
  if (
    musician.current_availability_status === "DISPONIBLE CON RESTRICCIONES" ||
    musician.current_availability_status === "TAL VEZ"
  ) {
    return {
      state: "CON RESTRICCIONES",
      label: musician.current_availability_status === "TAL VEZ" ? "Tal vez" : "Con restricciones",
      reason: `Estado general: ${musician.current_availability_status.toLowerCase()}`,
      toneClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    };
  }
  if (musician.current_availability_status === "NO DISPONIBLE") {
    return {
      state: "NO DISPONIBLE",
      label: "No disponible",
      reason: "Estado general: No disponible",
      toneClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
    };
  }

  return {
    state: "SIN REGISTRO",
    label: "Sin registro",
    reason: "El músico aún no registra disponibilidad para esta franja",
    toneClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
  };
}
