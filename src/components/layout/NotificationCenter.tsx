import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Clock3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type Notification = { id: string; title: string; message: string; link: string | null; read_at: string | null; created_at: string; type: string };
export function NotificationCenter({ userId }: { userId: string | undefined }) {
  const { membership } = useAuth();
  const organizationId = membership?.organizationId;
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const loadingScope = useRef<string | null>(null);
  const currentScope = useRef("");
  const scope = `${userId}:${organizationId}`;
  currentScope.current = scope;
  const load = useCallback(async () => {
    if (!userId || !organizationId || loadingScope.current === scope) return;
    loadingScope.current = scope;
    try {
      const [birthdays, tasks] = await Promise.all([
        supabase.rpc("refresh_my_birthday_notifications", { target_organization_id: organizationId }),
        supabase.rpc("refresh_my_task_notifications"),
      ]);
      if (birthdays.error || tasks.error) throw new Error(birthdays.error?.message ?? tasks.error?.message);
      const { data, error } = await supabase.from("notifications").select("id,title,message,link,read_at,created_at,type")
        .eq("user_id", userId).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(40);
      if (error) throw new Error(error.message);
      if (currentScope.current === scope) setItems((data ?? []) as Notification[]);
    } catch (error) {
      if (currentScope.current === scope) toast.error("No se pudieron cargar las notificaciones", { description: error instanceof Error ? error.message : undefined });
    } finally {
      if (loadingScope.current === scope) loadingScope.current = null;
    }
  }, [userId, organizationId, scope]);
  useEffect(() => { setItems([]); void load(); }, [load]);
  useEffect(() => { if (open) void load(); }, [open, load]);
  useEffect(() => {
    if (!userId) return;
    const timer = window.setInterval(() => void load(), 60_000);
    const channel = supabase.channel(`notifications-${scope}`).on("postgres_changes", {
      event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}`,
    }, () => void load()).subscribe();
    return () => { window.clearInterval(timer); void supabase.removeChannel(channel); };
  }, [userId, scope, load]);
  const unread = items.filter((item) => !item.read_at).length;
  const openItem = async (item: Notification) => {
    if (!item.read_at) {
      const { error } = await supabase.rpc("mark_my_notification_read", { target_notification_id: item.id });
      if (error) { toast.error("No se pudo actualizar la notificación"); return; }
    }
    setOpen(false);
    // Las notificaciones solo navegan a rutas internas, nunca a URLs ejecutables o externas.
    if (item.link?.startsWith("/") && !item.link.startsWith("//")) navigate(item.link);
    void load();
  };
  const markAll = async () => {
    const { error } = await supabase.rpc("mark_all_my_notifications_read");
    if (error) toast.error("No se pudieron marcar las notificaciones"); else void load();
  };
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="ghost" size="icon" className="relative rounded-xl"><Bell className="size-4" />{unread > 0 && <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full border-2 border-background bg-orange-500 px-1 text-[8px] font-black text-white">{unread > 9 ? "9+" : unread}</span>}<span className="sr-only">Notificaciones</span></Button></PopoverTrigger><PopoverContent align="end" className="w-[min(92vw,390px)] rounded-2xl p-0"><div className="flex items-center justify-between border-b p-4"><div><p className="font-black">Notificaciones</p><p className="text-xs text-muted-foreground">{unread} sin leer</p></div>{unread > 0 && <Button variant="ghost" size="sm" onClick={() => void markAll()} className="rounded-xl text-xs"><CheckCheck className="mr-1 size-4" />Marcar leídas</Button>}</div><ScrollArea className="h-[min(390px,65vh)]"><div className="divide-y">{items.length ? items.map((item) => <button key={item.id} onClick={() => void openItem(item)} className={`w-full p-4 text-left transition hover:bg-muted/60 ${!item.read_at ? "bg-primary/5" : ""}`}><div className="flex gap-3"><span className={`mt-1 size-2 shrink-0 rounded-full ${item.read_at ? "bg-muted-foreground/30" : "bg-orange-500"}`} /><div className="min-w-0"><p className="break-words text-sm font-black">{item.title}</p><p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">{item.message}</p><p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground"><Clock3 className="size-3" />{new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date(item.created_at))}</p></div></div></button>) : <div className="p-10 text-center"><Bell className="mx-auto size-8 text-primary" /><p className="mt-3 font-bold">Todo al día</p><p className="text-xs text-muted-foreground">Aquí aparecerán cumpleaños, tareas, cobros y solicitudes.</p></div>}</div></ScrollArea></PopoverContent></Popover>;
}
