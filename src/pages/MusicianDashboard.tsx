import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ListMusic,
  MapPin,
  Music2,
  Sparkles,
  UserCheck,
  UserRoundX,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CelebrationsBanner } from "@/components/layout/CelebrationsBanner";
import { useAuth } from "@/contexts/AuthContext";
import { PresentationModeModal } from "@/features/repertoire/PresentationModeModal";
import { loadRepertoire } from "@/features/repertoire/service";
import type { Setlist, Song } from "@/features/repertoire/types";
import { supabase } from "@/integrations/supabase/client";
import { assetUrl } from "@/lib/assets";

type MemberEvent = {
  id: string;
  name: string;
  event_type: string;
  event_date: string;
  start_time: string;
  end_time: string;
  city: string;
  venue: string;
  address: string;
  status: "PENDIENTE" | "CONFIRMADO" | "EN CURSO" | "REALIZADO" | "CANCELADO" | "CERRADO";
  setlist_id: string | null;
  assignment_status: "PENDIENTE" | "CONFIRMADO" | "NO DISPONIBLE" | null;
};

const statusTone: Record<MemberEvent["status"], string> = {
  PENDIENTE: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  CONFIRMADO: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "EN CURSO": "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  REALIZADO: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  CANCELADO: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  CERRADO: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

export default function MusicianDashboard() {
  const { user, session, organization, membership } = useAuth();
  const [events, setEvents] = useState<MemberEvent[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [musicianId, setMusicianId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);
  const [presentationTitle, setPresentationTitle] = useState("");
  const [presentationSongs, setPresentationSongs] = useState<Song[]>([]);
  const [presentationOpen, setPresentationOpen] = useState(false);

  const load = useCallback(async () => {
    if (!membership || !session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [scheduleRes, repRes, musRes] = await Promise.all([
      supabase.rpc("get_member_event_schedule", { target_organization_id: membership.organizationId }),
      loadRepertoire(membership.organizationId).catch(() => ({ genres: [], songs: [], setlists: [] })),
      supabase
        .from("musicians")
        .select("id")
        .eq("organization_id", membership.organizationId)
        .eq("user_id", session.user.id)
        .maybeSingle(),
    ]);
    setLoading(false);
    if (scheduleRes.error) {
      toast.error("No fue posible cargar la agenda de eventos", { description: scheduleRes.error.message });
      return;
    }
    setEvents(Array.isArray(scheduleRes.data) ? (scheduleRes.data as MemberEvent[]) : []);
    setSetlists(repRes.setlists ?? []);
    setMusicianId(musRes.data?.id ?? null);
  }, [membership, session]);

  useEffect(() => {
    void load();
  }, [load]);

  const today = bogotaDate();
  const upcomingAssigned = useMemo(
    () =>
      events
        .filter(
          (event) =>
            event.assignment_status !== null &&
            event.event_date >= today &&
            !["REALIZADO", "CANCELADO", "CERRADO"].includes(event.status),
        )
        .sort(byDateAscending),
    [events, today],
  );

  const upcomingGeneral = useMemo(
    () =>
      events
        .filter((event) => event.event_date >= today && !["REALIZADO", "CANCELADO", "CERRADO"].includes(event.status))
        .sort(byDateAscending),
    [events, today],
  );

  const pastOrGeneralEvents = useMemo(
    () =>
      [...events].sort((a, b) => {
        const aUpcoming = a.event_date >= today && !["REALIZADO", "CANCELADO", "CERRADO"].includes(a.status);
        const bUpcoming = b.event_date >= today && !["REALIZADO", "CANCELADO", "CERRADO"].includes(b.status);
        if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
        return aUpcoming ? byDateAscending(a, b) : byDateDescending(a, b);
      }),
    [events, today],
  );

  const nextEvent = upcomingAssigned[0] ?? upcomingGeneral[0] ?? null;

  const openPresentationForEvent = (event: MemberEvent) => {
    const sl = setlists.find((s) => s.id === event.setlist_id);
    const songs = sl
      ? [...(sl.setlist_songs ?? [])]
          .sort((a, b) => a.position - b.position)
          .filter((item) => item.item_type === "SONG" && item.song)
          .map((item) => item.song!)
      : [];
    setPresentationTitle(event.name);
    setPresentationSongs(songs);
    setPresentationOpen(true);
  };

  const respondEventAssignment = async (eventId: string, status: "CONFIRMADO" | "NO DISPONIBLE") => {
    if (!musicianId || !membership) return;
    setUpdatingEventId(eventId);
    const { error } = await supabase
      .from("event_musicians")
      .update({ status })
      .eq("organization_id", membership.organizationId)
      .eq("event_id", eventId)
      .eq("musician_id", musicianId);
    setUpdatingEventId(null);
    if (error) {
      toast.error("No fue posible registrar tu confirmación", { description: error.message });
      return;
    }
    toast.success(status === "CONFIRMADO" ? "Participación confirmada" : "Marcado como no disponible");
    void load();
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-72 rounded-[2rem]" />
        <Skeleton className="h-28 rounded-[2rem]" />
        <Skeleton className="h-80 rounded-[2rem]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-primary">Portal del músico</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Hola, {user?.firstName || "músico"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tus próximos eventos asignados y agenda con {organization?.name || "Proyecto Orquesta"}.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/repertorio"><Music2 className="mr-2 size-4" />Consultar repertorio</Link>
          </Button>
          <Button asChild className="rounded-xl">
            <Link to="/mi-trabajo-musical">Mi trabajo musical<ArrowRight className="ml-2 size-4" /></Link>
          </Button>
        </div>
      </header>

      <CelebrationsBanner />

      <section className="relative min-h-[290px] overflow-hidden rounded-[2rem] bg-[#1b1530] text-white shadow-xl">
        <img
          src={assetUrl(organization?.coverUrl || "/assets/orquesta-stage-hero.png")}
          alt="Escenario de la orquesta"
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-[#160f2b]/55" />
        <div className="relative z-10 flex min-h-[290px] flex-col justify-between p-5 sm:p-8 lg:flex-row lg:items-end">
          {nextEvent ? (
            <>
              <div className="max-w-2xl">
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-full border border-white/20 bg-white/15 text-white hover:bg-white/15">
                    {nextEvent.assignment_status ? "MI PRÓXIMO EVENTO" : "PRÓXIMO EVENTO"}
                  </Badge>
                  <AssignmentBadge status={nextEvent.assignment_status} dark />
                </div>
                <h2 className="mt-5 text-2xl font-black leading-tight sm:text-4xl">{nextEvent.name}</h2>
                <p className="mt-2 text-sm font-semibold text-violet-200">{nextEvent.event_type}</p>
                <div className="mt-5 grid gap-3 text-sm text-white/80 sm:grid-cols-2">
                  <span className="flex items-center gap-2">
                    <CalendarClock className="size-4 shrink-0 text-violet-300" />
                    {formatDate(nextEvent.event_date)} · {shortTime(nextEvent.start_time)}
                  </span>
                  <span className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-violet-300" />
                    <span>{nextEvent.venue}, {nextEvent.city}</span>
                  </span>
                </div>
              </div>
              <div className="mt-6 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur lg:mt-0 lg:w-72 sm:p-5">
                <p className="text-xs font-black uppercase tracking-wider text-violet-200">Horario del evento</p>
                <p className="mt-2 text-xl font-black sm:text-2xl">{shortTime(nextEvent.start_time)} – {shortTime(nextEvent.end_time)}</p>
                <p className="mt-2 text-xs text-white/70 sm:text-sm">{nextEvent.address}</p>
                {nextEvent.setlist_id && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openPresentationForEvent(nextEvent)}
                    className="mt-4 w-full rounded-xl bg-white text-[#1b1530] hover:bg-white/90 font-bold"
                  >
                    <Sparkles className="mr-2 size-4" /> Modo presentación
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="my-auto max-w-xl">
              <Badge className="rounded-full border border-white/20 bg-white/15 text-white hover:bg-white/15">AGENDA AL DÍA</Badge>
              <h2 className="mt-5 text-3xl font-black sm:text-5xl">Listos para el próximo evento</h2>
              <p className="mt-4 text-white/70">Cuando se programe una presentación aparecerá aquí con su fecha, horario y ubicación.</p>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric icon={Sparkles} value={upcomingAssigned.length} label="Mis próximos eventos" />
        <Metric icon={CheckCircle2} value={events.filter((event) => event.assignment_status === "CONFIRMADO").length} label="Mis confirmaciones" />
        <Metric icon={CalendarDays} value={events.length} label="Agenda general orquesta" />
      </section>

      {/* Dedicated Mis próximos eventos asignados section — mobile + desktop first */}
      <Card className="overflow-hidden rounded-[2rem] border-primary/20 shadow-none">
        <CardContent className="p-0">
          <div className="border-b bg-primary/5 p-5 sm:p-6">
            <h2 className="text-xl font-black">Mis próximos eventos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Presentaciones en las que estás convocado, con confirmación directa y repertorio en vivo.
            </p>
          </div>
          {upcomingAssigned.length ? (
            <div className="divide-y">
              {upcomingAssigned.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  today={today}
                  updating={updatingEventId === event.id}
                  onRespond={(status) => void respondEventAssignment(event.id, status)}
                  onOpenPresentation={() => openPresentationForEvent(event)}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <CalendarDays className="mx-auto size-10 text-primary" />
              <p className="mt-3 font-black">No tienes eventos próximos asignados</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cuando seas convocado a una presentación aparecerá aquí para que confirmes tu asistencia y consultes el repertorio.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-[2rem] shadow-none">
        <CardContent className="p-0">
          <div className="border-b p-5 sm:p-6">
            <h2 className="text-xl font-black">Calendario completo de la orquesta</h2>
            <p className="mt-1 text-sm text-muted-foreground">Próximas presentaciones e historial general, visible tanto en web como en móvil.</p>
          </div>
          {pastOrGeneralEvents.length ? (
            <div className="divide-y">
              {pastOrGeneralEvents.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  today={today}
                  updating={updatingEventId === event.id}
                  onRespond={event.assignment_status ? (status) => void respondEventAssignment(event.id, status) : undefined}
                  onOpenPresentation={() => openPresentationForEvent(event)}
                />
              ))}
            </div>
          ) : (
            <div className="p-10 text-center sm:p-14">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><CalendarDays className="size-6" /></span>
              <h3 className="mt-4 text-lg font-black">Todavía no hay eventos programados</h3>
              <p className="mt-2 text-sm text-muted-foreground">La agenda se actualizará automáticamente cuando se cree el primer evento.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <PresentationModeModal
        open={presentationOpen}
        onOpenChange={setPresentationOpen}
        title={presentationTitle}
        songs={presentationSongs}
      />
    </div>
  );
}

function EventRow({
  event,
  today,
  updating,
  onRespond,
  onOpenPresentation,
}: {
  event: MemberEvent;
  today: string;
  updating?: boolean;
  onRespond?: (status: "CONFIRMADO" | "NO DISPONIBLE") => void;
  onOpenPresentation: () => void;
}) {
  const isUpcoming = event.event_date >= today && !["REALIZADO", "CANCELADO", "CERRADO"].includes(event.status);
  return (
    <article className="flex flex-col gap-4 p-4 sm:p-6 lg:grid lg:grid-cols-[90px_1fr_auto] lg:items-center">
      <div className="flex items-center gap-4 lg:block">
        <div className={`w-fit rounded-2xl px-4 py-3 text-center ${isUpcoming ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          <p className="text-2xl font-black leading-none">{day(event.event_date)}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-wider">{month(event.event_date)}</p>
        </div>
        <div className="min-w-0 lg:hidden">
          <h3 className="font-black text-base">{event.name}</h3>
          <p className="text-xs font-semibold text-primary">{event.event_type}</p>
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="hidden font-black sm:text-lg lg:block">{event.name}</h3>
          <Badge className={`rounded-lg ${statusTone[event.status]}`}>{event.status}</Badge>
          <AssignmentBadge status={event.assignment_status} />
        </div>
        <p className="mt-1 hidden text-xs font-semibold text-primary lg:block">{event.event_type}</p>
        <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-5">
          <span className="flex items-center gap-1.5">
            <Clock3 className="size-3.5 shrink-0" />
            {shortTime(event.start_time)} – {shortTime(event.end_time)}
          </span>
          <span className="flex min-w-0 items-start gap-1.5">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            <span className="break-words">{event.venue}, {event.city}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {isUpcoming && event.assignment_status && onRespond && (
          <>
            {event.assignment_status !== "CONFIRMADO" && (
              <Button size="sm" disabled={updating} onClick={() => onRespond("CONFIRMADO")} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold">
                <UserCheck className="mr-1.5 size-3.5" /> Confirmar
              </Button>
            )}
            {event.assignment_status !== "NO DISPONIBLE" && (
              <Button size="sm" variant="outline" disabled={updating} onClick={() => onRespond("NO DISPONIBLE")} className="rounded-xl text-rose-600">
                <UserRoundX className="mr-1.5 size-3.5" /> No puedo
              </Button>
            )}
          </>
        )}
        {event.setlist_id && (
          <Button type="button" variant="outline" size="sm" onClick={onOpenPresentation} className="rounded-xl font-bold">
            <ListMusic className="mr-1.5 size-4" /> Modo presentación
          </Button>
        )}
      </div>
    </article>
  );
}

function AssignmentBadge({ status, dark = false }: { status: MemberEvent["assignment_status"]; dark?: boolean }) {
  if (!status) return <Badge variant="outline" className={dark ? "rounded-full border-white/20 bg-white/10 text-white" : "rounded-lg"}>Evento de la orquesta</Badge>;
  const label = status === "CONFIRMADO" ? "Estoy confirmado" : status === "NO DISPONIBLE" ? "No disponible" : "Asignación pendiente";
  const tone = dark
    ? "border-white/20 bg-white/10 text-white"
    : status === "CONFIRMADO"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === "NO DISPONIBLE"
        ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
        : "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return <Badge className={`rounded-lg ${tone}`}>{label}</Badge>;
}

function Metric({ icon: Icon, value, label }: { icon: typeof CalendarDays; value: number; label: string }) {
  return (
    <Card className="rounded-3xl shadow-none">
      <CardContent className="flex items-center gap-4 p-5">
        <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
        <div>
          <p className="text-2xl font-black">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function byDateAscending(a: MemberEvent, b: MemberEvent) {
  return `${a.event_date}${a.start_time}`.localeCompare(`${b.event_date}${b.start_time}`);
}
function byDateDescending(a: MemberEvent, b: MemberEvent) {
  return `${b.event_date}${b.start_time}`.localeCompare(`${a.event_date}${a.start_time}`);
}
function bogotaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" }).format(new Date(`${value}T12:00:00-05:00`));
}
function day(value: string) {
  return value.slice(8, 10);
}
function month(value: string) {
  return new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "America/Bogota" }).format(new Date(`${value}T12:00:00-05:00`)).replace(".", "");
}
function shortTime(value: string) {
  return value.slice(0, 5);
}