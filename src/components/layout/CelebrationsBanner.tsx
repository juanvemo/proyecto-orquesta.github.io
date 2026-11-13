import { useEffect, useMemo, useState } from "react";
import { CakeSlice, CalendarHeart, PartyPopper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { nextColombiaHoliday } from "@/lib/colombiaHolidays";

interface Birthday {
  id: string;
  name: string;
  birth_date: string;
  photo_url?: string | null;
}

function normalizeBirthdayRow(raw: Record<string, unknown>): Birthday | null {
  const birthDate = raw.birth_date ? String(raw.birth_date) : "";
  if (!birthDate || birthDate.length < 10) return null;
  const fullName =
    (typeof raw.name === "string" && raw.name.trim()) ||
    (typeof raw.full_name === "string" && raw.full_name.trim()) ||
    `${String(raw.first_name ?? "").trim()} ${String(raw.last_name ?? "").trim()}`.trim() ||
    "Músico";
  const id = String(raw.id ?? raw.musician_id ?? raw.user_id ?? fullName);
  return {
    id,
    name: fullName,
    birth_date: birthDate,
    photo_url: typeof raw.photo_url === "string" ? raw.photo_url : null,
  };
}

function todayBogotaParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    month: Number(map.month),
    monthDay: `${map.month}-${map.day}`,
    nowInBogota: new Date(`${map.year}-${map.month}-${map.day}T12:00:00`),
  };
}

export function CelebrationsBanner() {
  const { membership } = useAuth();
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);

  useEffect(() => {
    if (!membership) return;
    let cancelled = false;

    void (async () => {
      const rpcRes = await supabase.rpc("get_organization_birthdays", {
        target_organization_id: membership.organizationId,
      });
      if (!cancelled && !rpcRes.error && Array.isArray(rpcRes.data)) {
        const normalized = (rpcRes.data as Array<Record<string, unknown>>)
          .map(normalizeBirthdayRow)
          .filter((item): item is Birthday => item !== null);
        if (normalized.length > 0) {
          setBirthdays(normalized);
          return;
        }
      }

      const musRes = await supabase
        .from("musicians")
        .select("id,first_name,last_name,birth_date,photo_url")
        .eq("organization_id", membership.organizationId)
        .eq("status", "ACTIVO")
        .not("birth_date", "is", null);

      if (!cancelled && !musRes.error) {
        const normalized = (musRes.data ?? [])
          .map((m) => normalizeBirthdayRow(m as unknown as Record<string, unknown>))
          .filter((item): item is Birthday => item !== null);
        setBirthdays(normalized);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [membership]);

  const { month, monthDay, nowInBogota } = todayBogotaParts();

  const today = useMemo(
    () => birthdays.filter((person) => person.birth_date.slice(5, 10) === monthDay),
    [birthdays, monthDay],
  );
  const thisMonth = useMemo(
    () =>
      birthdays
        .filter((person) => Number(person.birth_date.slice(5, 7)) === month)
        .sort((left, right) => Number(left.birth_date.slice(8, 10)) - Number(right.birth_date.slice(8, 10))),
    [birthdays, month],
  );
  const holiday = nextColombiaHoliday(nowInBogota);

  return (
    <section className="grid gap-3 rounded-[1.5rem] border border-primary/15 bg-primary/[0.045] p-3 shadow-sm sm:grid-cols-[1fr_1.35fr_1fr] sm:p-4">
      <div className={`flex min-w-0 items-center gap-3 rounded-2xl bg-card p-3 ${today.length ? "ring-1 ring-fuchsia-500/40" : ""}`}>
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-fuchsia-500/10 text-fuchsia-600">
          <PartyPopper className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-fuchsia-600">Cumpleaños de hoy</p>
          <p className="truncate text-sm font-black">
            {today.length ? today.map((person) => person.name).join(", ") : "Sin cumpleaños hoy"}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-card p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-700">
          <CakeSlice className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-amber-700">
            Cumplen este mes · {thisMonth.length}
          </p>
          <div className="mt-1 flex flex-wrap gap-1 overflow-hidden">
            {thisMonth.length ? (
              thisMonth.slice(0, 4).map((person) => (
                <Badge key={person.id} variant="secondary" className="max-w-44 shrink-0 truncate rounded-lg">
                  {Number(person.birth_date.slice(8, 10))} · {person.name}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Agrega las fechas de nacimiento en cada perfil.</span>
            )}
            {thisMonth.length > 4 && (
              <Badge variant="outline" className="shrink-0 rounded-lg">
                +{thisMonth.length - 4}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-card p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-blue-500/10 text-blue-700">
          <CalendarHeart className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-blue-700">Próxima fecha en Colombia</p>
          <p className="truncate text-sm font-black">{holiday?.name ?? "Sin fecha próxima"}</p>
          {holiday && (
            <p className="text-xs text-muted-foreground">
              {new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long" }).format(holiday.date)}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
