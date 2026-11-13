import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, LoaderCircle, MapPin, Music2, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getPublicRehearsalInvitation, respondToRehearsalInvitation } from "@/features/rehearsals/service";
import type { PublicRehearsalInvitation as InvitationData } from "@/features/rehearsals/types";
import { assetUrl } from "@/lib/assets";

export default function PublicRehearsalInvitation() {
  const { token } = useParams();
  const [data, setData] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    getPublicRehearsalInvitation(token).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [token]);

  const respond = async (action: "ACCEPT" | "DECLINE") => {
    if (!token) return;
    setSaving(true);
    try {
      const status = await respondToRehearsalInvitation(token, action, note);
      setData((current) => current ? { ...current, invitation: { status, responded_at: new Date().toISOString() } } : current);
      toast.success(action === "ACCEPT" ? "Asistencia confirmada" : "Respuesta registrada");
    } catch (error) {
      toast.error("No fue posible registrar tu respuesta", { description: error instanceof Error ? error.message : undefined });
    } finally { setSaving(false); }
  };

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f3f0fa]"><LoaderCircle className="size-9 animate-spin text-primary" /></main>;
  if (!data) return <main className="grid min-h-screen place-items-center bg-[#f3f0fa] p-5"><Card className="w-full max-w-lg rounded-[2rem]"><CardContent className="p-9 text-center"><XCircle className="mx-auto size-12 text-rose-500" /><h1 className="mt-4 text-2xl font-black">Convocatoria no disponible</h1><p className="mt-2 text-sm text-muted-foreground">El enlace es inválido o la convocatoria ya no existe.</p><Button asChild variant="outline" className="mt-6 rounded-xl"><Link to="/proyecto-orquesta">Volver al inicio</Link></Button></CardContent></Card></main>;

  const cancelled = data.rehearsal.status === "CANCELADO";
  return <main className="min-h-screen bg-[#f3f0fa] p-4 sm:p-8"><Card className="mx-auto w-full max-w-2xl overflow-hidden rounded-[2.5rem] border-0 shadow-xl"><div className="bg-[#24163d] p-7 text-white sm:p-9"><div className="flex items-center justify-between gap-5"><img src={assetUrl(data.organization.logo_url || "/assets/proyecto-orquesta-logo.png")} alt={data.organization.name} className="h-20 w-auto rounded-xl bg-white p-1" /><span className="grid size-14 place-items-center rounded-2xl bg-white/10"><Music2 className="size-7 text-violet-200" /></span></div><p className="mt-7 text-xs font-black uppercase tracking-[.18em] text-violet-200">Convocatoria privada</p><h1 className="mt-2 text-3xl font-black">{data.rehearsal.name}</h1><p className="mt-2 text-sm text-white/70">Hola {data.musician.name}, confirma si puedes asistir.</p></div><CardContent className="p-6 sm:p-9"><div className="grid gap-3 sm:grid-cols-3"><Detail icon={CalendarDays} label="Fecha" value={formatDate(data.rehearsal.date)} /><Detail icon={Clock3} label="Horario" value={`${data.rehearsal.start_time.slice(0,5)} – ${data.rehearsal.end_time.slice(0,5)}`} /><Detail icon={MapPin} label="Lugar" value={data.rehearsal.location} /></div><div className="mt-6 rounded-2xl bg-muted/50 p-5"><p className="text-xs font-black uppercase tracking-wider text-primary">Objetivo del ensayo</p><p className="mt-2 text-sm leading-relaxed">{data.rehearsal.objective}</p>{data.rehearsal.address && <p className="mt-3 text-xs text-muted-foreground">Dirección: {data.rehearsal.address}</p>}</div>{data.invitation.status !== "PENDIENTE" && <div className={`mt-6 rounded-2xl p-5 text-center ${data.invitation.status === "CONFIRMADO" ? "bg-emerald-500/10 text-emerald-700" : "bg-rose-500/10 text-rose-700"}`}>{data.invitation.status === "CONFIRMADO" ? <CheckCircle2 className="mx-auto size-9" /> : <XCircle className="mx-auto size-9" />}<p className="mt-2 font-black">{data.invitation.status === "CONFIRMADO" ? "Asistencia confirmada" : "No puedes asistir"}</p><p className="mt-1 text-xs">Puedes cambiar tu respuesta mientras el ensayo esté activo.</p></div>}<Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} disabled={cancelled} placeholder="Nota opcional para el director…" className="mt-6 min-h-24 rounded-2xl" />{cancelled ? <div className="mt-4 rounded-2xl bg-amber-500/10 p-4 text-center font-bold text-amber-700">Este ensayo fue cancelado.</div> : <div className="mt-4 grid gap-3 sm:grid-cols-2"><Button disabled={saving} variant="outline" onClick={() => void respond("DECLINE")} className="h-12 rounded-xl border-rose-200 font-black text-rose-600 hover:bg-rose-50"><XCircle className="mr-2 size-5" />No puedo asistir</Button><Button disabled={saving} onClick={() => void respond("ACCEPT")} className="h-12 rounded-xl bg-emerald-600 font-black hover:bg-emerald-700">{saving ? <LoaderCircle className="mr-2 size-5 animate-spin" /> : <CheckCircle2 className="mr-2 size-5" />}Sí, confirmo</Button></div>}<p className="mt-7 text-center text-xs text-muted-foreground">Enlace personal de {data.organization.name}. No lo compartas con otras personas.</p></CardContent></Card></main>;
}

function Detail({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) { return <div className="rounded-2xl border p-4"><Icon className="size-5 text-primary" /><p className="mt-3 text-[10px] font-black uppercase text-muted-foreground">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`)); }
