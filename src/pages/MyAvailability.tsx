import { useCallback, useEffect, useState } from "react";
import { CalendarCheck2, LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { AvailabilityManager } from "@/features/musicians/AvailabilityManager";
import { listMusicians } from "@/features/musicians/service";
import type { Musician } from "@/features/musicians/types";

export default function MyAvailability() {
  const { membership, session } = useAuth();
  const [musician, setMusician] = useState<Musician | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!membership || !session) return;
    setLoading(true);
    try { const people = await listMusicians(membership.organizationId); setMusician(people.find((item) => item.user_id === session.user.id) ?? null); }
    catch { toast.error("No fue posible cargar tu disponibilidad"); }
    finally { setLoading(false); }
  }, [membership, session]);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="grid min-h-[50vh] place-items-center"><LoaderCircle className="size-7 animate-spin text-primary" /></div>;
  return <div className="space-y-6 animate-in fade-in duration-300"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Mi espacio</p><h1 className="mt-2 text-3xl font-black tracking-tight">Mi disponibilidad</h1><p className="mt-2 text-sm text-muted-foreground">Mantén actualizados tus días y horarios habituales.</p></div>{musician && membership ? <><Card className="rounded-[2rem] border-primary/15 bg-primary/5 shadow-none"><CardContent className="flex items-center gap-4 p-5"><span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground"><CalendarCheck2 className="size-6" /></span><div><p className="font-black">{musician.first_name} {musician.last_name}</p><p className="text-sm text-muted-foreground">Los cambios quedan disponibles para futuras convocatorias.</p></div></CardContent></Card><AvailabilityManager organizationId={membership.organizationId} musicianId={musician.id} entries={musician.availability} canManage onChanged={() => void load()} /></> : <Card className="rounded-[2rem] shadow-none"><CardContent className="p-10 text-center"><ShieldCheck className="mx-auto size-10 text-primary" /><h2 className="mt-4 text-xl font-black">Tu cuenta aún no está vinculada</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Solicita al administrador que asigne el rol Músico y apruebe tu acceso para crear la ficha personal.</p></CardContent></Card>}</div>;
}
