export interface ColombiaHoliday {
  date: Date;
  name: string;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function nextMonday(year: number, month: number, day: number) {
  const date = new Date(year, month, day, 12);
  const offset = (8 - date.getDay()) % 7;
  return addDays(date, offset);
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day, 12);
}

export function getColombiaHolidays(year: number): ColombiaHoliday[] {
  const easter = easterSunday(year);
  const holidays: ColombiaHoliday[] = [
    { date: new Date(year, 0, 1, 12), name: "Año Nuevo" },
    { date: nextMonday(year, 0, 6), name: "Día de los Reyes Magos" },
    { date: nextMonday(year, 2, 19), name: "Día de San José" },
    { date: addDays(easter, -3), name: "Jueves Santo" },
    { date: addDays(easter, -2), name: "Viernes Santo" },
    { date: new Date(year, 4, 1, 12), name: "Día del Trabajo" },
    { date: addDays(easter, 43), name: "Ascensión del Señor" },
    { date: addDays(easter, 64), name: "Corpus Christi" },
    { date: addDays(easter, 71), name: "Sagrado Corazón" },
    { date: nextMonday(year, 5, 29), name: "San Pedro y San Pablo" },
    { date: new Date(year, 6, 20, 12), name: "Día de la Independencia" },
    { date: new Date(year, 7, 7, 12), name: "Batalla de Boyacá" },
    { date: nextMonday(year, 7, 15), name: "Asunción de la Virgen" },
    { date: nextMonday(year, 9, 12), name: "Día de la Raza" },
    { date: nextMonday(year, 10, 1), name: "Todos los Santos" },
    { date: nextMonday(year, 10, 11), name: "Independencia de Cartagena" },
    { date: new Date(year, 10, 22, 12), name: "Día del Músico" },
    { date: new Date(year, 11, 8, 12), name: "Inmaculada Concepción" },
    { date: new Date(year, 11, 25, 12), name: "Navidad" },
  ];
  return holidays.sort((left, right) => left.date.getTime() - right.date.getTime());
}

export function nextColombiaHoliday(today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  return [...getColombiaHolidays(today.getFullYear()), ...getColombiaHolidays(today.getFullYear() + 1)]
    .find((holiday) => holiday.date.getTime() >= start.getTime()) ?? null;
}
