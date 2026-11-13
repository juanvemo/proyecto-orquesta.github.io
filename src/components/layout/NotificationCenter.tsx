import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, Clock3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { isMissingTableOrRpcError } from "@/lib/orgStore";

type Notification = {
  id: string;
  title: string;
  message: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
  type: string;
  isLocal?: boolean;
};

function todayBogotaParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { date: `${map.year}-${map.month}-${map.day}`, monthDay: `${map.month}-${map.day}` };
}

function getLocalReadSet(uid: string, date: string): Set<string> {
  try {
    const raw = localStorage.getItem(`po_bday_read_${uid}_${date}`);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function markLocalRead(uid: string, date: string, ids: string[]) {
  try {
    const next = getLocalReadSet(uid, date);
    ids.forEach((id) => next.add(id));
    localStorage.setItem(`po_bday_read_${uid}_${date}`, JSON.stringify(Array.from(next)));
  } catch {
    // ignore storage quota errors
  }
}

export function NotificationCenter({ userId, organizationId }: { userId: string | undefined; organizationId?: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [localBirthdays, setLocalBirthdays] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const ensureBirthdayNotifications = useCallback(async (orgId: string, uid: string): Promise<Notification[]> => {
    const { date, monthDay } = todayBogotaParts();
    const sessionFlag = `po_bday_checked_${orgId}_${date}`;

    if (sessionStorage.getItem(sessionFlag) !== "1") {
      const { error: rpcError } = await supabase.rpc("refresh_birthday_notifications", { target_organization_id: orgId });
      if (!rpcError) {
        sessionStorage.setItem(sessionFlag, "1");
        return [];
      }
      if (!isMissingTableOrRpcError(rpcError)) {
        // continue to fallback cleanly
      }
    }

    let todayCelebrants: Array<{ id: string; name: string; user_id?: string | null }> = [];
    const orgBdayRes = await supabase.rpc("get_organization_birthdays", { target_organization_id: orgId });

    if (!orgBdayRes.error && Array.isArray(orgBdayRes.data) && orgBdayRes.data.length > 0) {
      todayCelebrants = (orgBdayRes.data as Array<Record<string, unknown>>)
        .filter((m) => String(m.birth_date ?? "").slice(5, 10) === monthDay)
        .map((m) => ({
          id: String(m.id ?? m.musician_id ?? m.name ?? ""),
          user_id: typeof m.user_id === "string" ? m.user_id : null,
          name:
            (typeof m.name === "string" && m.name.trim()) ||
            (typeof m.full_name === "string" && m.full_name.trim()) ||
            `${String(m.first_name ?? "").trim()} ${String(m.last_name ?? "").trim()}`.trim() ||
            "Músico",
        }));
    } else {
      const { data: musicians } = await supabase
        .from("musicians")
        .select("id,user_id,first_name,last_name,birth_date")
        .eq("organization_id", orgId)
        .eq("status", "ACTIVO")
        .not("birth_date", "is", null);

      todayCelebrants = (musicians ?? [])
        .filter((m) => m.birth_date?.slice(5, 10) === monthDay)
        .map((m) => ({
          id: m.id,
          user_id: m.user_id,
          name: `${m.first_name} ${m.last_name}`.trim(),
        }));
    }

    if (!todayCelebrants.length) {
      sessionStorage.setItem(sessionFlag, "1");
      return [];
    }

    const { data: existingToday } = await supabase
      .from("notifications")
      .select("message")
      .eq("user_id", uid)
      .eq("type", "BIRTHDAY")
      .gte("created_at", `${date}T00:00:00`);

    const existingMsgs = new Set((existingToday ?? []).map((n) => n.message));
    const readLocal = getLocalReadSet(uid, date);
    const syntheticFallbacks: Notification[] = [];
    let allPersisted = true;

    for (const m of todayCelebrants) {
      const isSelf = m.user_id === uid;
      const title = isSelf ? "🎂 ¡Feliz cumpleaños!" : "🎂 Cumpleaños en la orquesta";
      const message = isSelf
        ? "¡Feliz cumpleaños de parte de Proyecto Orquesta!"
        : `Hoy cumple años ${m.name}.`;

      if (!existingMsgs.has(message)) {
        const { error: insErr } = await supabase.from("notifications").insert({
          organization_id: orgId,
          user_id: uid,
          type: "BIRTHDAY",
          title,
          message,
          link: "/",
        });
        if (insErr) {
          allPersisted = false;
          const localId = `local-bday-${date}-${m.id}`;
          syntheticFallbacks.push({
            id: localId,
            title,
            message,
            link: "/",
            read_at: readLocal.has(localId) ? new Date().toISOString() : null,
            created_at: new Date().toISOString(),
            type: "BIRTHDAY",
            isLocal: true,
          });
        }
      }
    }

    if (allPersisted) {
      sessionStorage.setItem(sessionFlag, "1");
    }

    return syntheticFallbacks;
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    await supabase.rpc("refresh_my_task_notifications");
    let fallbackBdays: Notification[] = [];
    if (organizationId) {
      fallbackBdays = await ensureBirthdayNotifications(organizationId, userId);
    }
    const { data, error } = await supabase
      .from("notifications")
      .select("id,title,message,link,read_at,created_at,type")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) {
      toast.error("No se pudieron cargar las notificaciones");
      setLocalBirthdays(fallbackBdays);
    } else {
      const rows = (data ?? []) as Notification[];
      const messages = new Set(rows.map((r) => r.message));
      setItems(rows);
      setLocalBirthdays(fallbackBdays.filter((b) => !messages.has(b.message)));
    }
  }, [userId, organizationId, ensureBirthdayNotifications]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (open) void load(); }, [open, load]);

  useEffect(() => {
    if (!userId) return;
    const timer = window.setInterval(() => void load(), 60_000);
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => void load())
      .subscribe();
    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const combinedItems = useMemo(() => [...localBirthdays, ...items], [localBirthdays, items]);
  const unread = combinedItems.filter((item) => !item.read_at).length;

  const openItem = async (item: Notification) => {
    if (!item.read_at) {
      if (item.isLocal && userId) {
        const { date } = todayBogotaParts();
        markLocalRead(userId, date, [item.id]);
        setLocalBirthdays((prev) => prev.map((x) => (x.id === item.id ? { ...x, read_at: new Date().toISOString() } : x)));
      } else {
        const { error } = await supabase.rpc("mark_my_notification_read", { target_notification_id: item.id });
        if (error) { toast.error("No se pudo actualizar la notificación"); return; }
      }
    }
    setOpen(false);
    if (item.link) navigate(item.link);
    void load();
  };

  const markAll = async () => {
    if (!userId) return;
    if (localBirthdays.length) {
      const { date } = todayBogotaParts();
      markLocalRead(userId, date, localBirthdays.map((b) => b.id));
      setLocalBirthdays((prev) => prev.map((x) => ({ ...x, read_at: new Date().toISOString() })));
    }
    if (items.some((i) => !i.read_at)) {
      const { error } = await supabase.rpc("mark_all_my_notifications_read");
      if (error) toast.error("No se pudieron marcar las notificaciones");
      else void load();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-xl">
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full border-2 border-background bg-orange-500 px-1 text-[8px] font-black text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
          <span className="sr-only">Notificaciones</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,390px)] rounded-2xl p-0">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <p className="font-black">Notificaciones</p>
            <p className="text-xs text-muted-foreground">{unread} sin leer</p>
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={() => void markAll()} className="rounded-xl text-xs">
              <CheckCheck className="mr-1 size-4" />Marcar leídas
            </Button>
          )}
        </div>
        <ScrollArea className="h-[390px]">
          <div className="divide-y">
            {combinedItems.length ? combinedItems.map((item) => (
              <button
                key={item.id}
                onClick={() => void openItem(item)}
                className={`w-full p-4 text-left transition hover:bg-muted/60 ${!item.read_at ? "bg-primary/5" : ""}`}
              >
                <div className="flex gap-3">
                  <span className={`mt-1 size-2 shrink-0 rounded-full ${item.read_at ? "bg-muted-foreground/30" : "bg-orange-500"}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-black">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.message}</p>
                    <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock3 className="size-3" />
                      {new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at))}
                    </p>
                  </div>
                </div>
              </button>
            )) : (
              <div className="p-10 text-center">
                <Bell className="mx-auto size-8 text-primary" />
                <p className="mt-3 font-bold">Todo al día</p>
                <p className="text-xs text-muted-foreground">Aquí aparecerán tareas, cumpleaños, cobros y solicitudes.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
