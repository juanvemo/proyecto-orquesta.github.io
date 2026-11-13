import { CheckCircle2, Clock3, LogIn, ShieldCheck } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { assetUrl } from "@/lib/assets";

export default function EmailConfirmed() {
  const { session, membership, loading, signOut } = useAuth();
  if (!loading && !session) return <Navigate to="/login" replace />;

  const approved = membership?.approvalStatus === "APPROVED";
  return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f5f2fc] p-5 dark:bg-[#0d0b16]">
    <div className="absolute -left-20 top-16 size-72 rounded-full bg-emerald-400/10 blur-3xl" />
    <div className="absolute -right-20 bottom-16 size-80 rounded-full bg-primary/10 blur-3xl" />
    <section className="relative w-full max-w-lg rounded-[2rem] border bg-card p-7 text-center shadow-2xl shadow-violet-950/10 sm:p-10">
      <img src={assetUrl("/assets/proyecto-orquesta-logo.png")} alt="Proyecto Orquesta" className="mx-auto h-24 w-auto" />
      <span className="mx-auto mt-7 grid size-16 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="size-8" /></span>
      <p className="mt-6 text-sm font-black uppercase tracking-[0.16em] text-primary">Correo confirmado</p>
      <h1 className="mt-2 text-3xl font-black">Tu cuenta quedó verificada</h1>
      <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">El enlace funcionó correctamente y tu correo ya está confirmado.</p>
      <div className="mt-6 rounded-2xl border bg-muted/35 p-5 text-left">
        <div className="flex gap-3"><Clock3 className="mt-0.5 size-5 shrink-0 text-amber-600" /><div><p className="font-black">Siguiente paso</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{approved ? "Tu acceso ya está aprobado. Puedes entrar al portal ahora." : "La dirección debe aprobar tu solicitud. Una vez aprobada, entra al portal con tu correo y la contraseña que creaste."}</p></div></div>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <Button asChild className="h-12 rounded-xl font-black"><Link to={approved ? "/" : "/acceso-pendiente"}><LogIn className="mr-2 size-4" />{approved ? "Entrar al portal" : "Ver mi solicitud"}</Link></Button>
        <Button variant="outline" className="h-12 rounded-xl font-bold" onClick={() => void signOut()}>Cerrar sesión</Button>
      </div>
      <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-primary" /> Verificación segura de Proyecto Orquesta</p>
    </section>
  </main>;
}
