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
  photo_url: string | null;
}

export function CelebrationsBanner() {
  const { membership } = useAuth();
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);

  useEffect(() => {
    if (!membership) return;
    supabase.rpc("get_organization_birthdays", { target_organization_id: membership.organizationId })
      .then(({ data, error }) => {
        if (!error) setBirthdays((data ?? []) as Birthday[]);
      });
  }, [membership]);

  const now = new Date();
  const todayKey = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const month = now.getMonth() + 1;
  const today = useMemo(() => birthdays.filter((person) => person.birth_date.slice(5) === todayKey), [birthdays, todayKey]);
  const thisMonth = useMemo(() => birthdays
    .filter((person) => Number(person.birth_date.slice(5, 7)) === month)
    .sort((left, right) => Number(left.birth_date.slice(8, 10)) - Number(right.birth_date.slice(8, 10))), [birthdays, month]);
  const holiday = nextColombiaHoliday(now);

  return (
    <section className="mb-5 grid gap-3 rounded-[1.5rem] border border-primary/15 bg-primary/[0.045] p-3 shadow-sm sm:grid-cols-[1fr_1.35fr_1fr] sm:p-4">
      <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-card p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-fuchsia-500/10 text-fuchsia-600"><PartyPopper className="size-5" /></span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-fuchsia-600">Cumpleaños de hoy</p>
          <p className="truncate text-sm font-black">{today.length ? today.map((person) => person.name).join(", ") : "Sin cumpleaños hoy"}</p>
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-card p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-700"><CakeSlice className="size-5" /></span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-amber-700">Cumplen este mes · {thisMonth.length}</p>
          <div className="mt-1 flex gap-1 overflow-hidden">
            {thisMonth.length ? thisMonth.slice(0, 4).map((person) => <Badge key={person.id} variant="secondary" className="max-w-40 shrink-0 truncate rounded-lg">{Number(person.birth_date.slice(8, 10))} · {person.name}</Badge>) : <span className="text-xs text-muted-foreground">Agrega las fechas en cada perfil.</span>}
            {thisMonth.length > 4 && <Badge variant="outline" className="shrink-0 rounded-lg">+{thisMonth.length - 4}</Badge>}
          </div>
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-card p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-blue-500/10 text-blue-700"><CalendarHeart className="size-5" /></span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-blue-700">Próxima fecha en Colombia</p>
          <p className="truncate text-sm font-black">{holiday?.name ?? "Sin fecha próxima"}</p>
          {holiday && <p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long" }).format(holiday.date)}</p>}
        </div>
      </div>
    </section>
  );
}
