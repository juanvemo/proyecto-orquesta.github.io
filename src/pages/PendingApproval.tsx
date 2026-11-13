import { Clock3, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { assetUrl } from "@/lib/assets";

export default function PendingApproval() {
  const { session, membership, user, loading, refreshAccess, signOut } = useAuth();

  if (!loading && !session) return <Navigate to="/login" replace />;
  if (!loading && membership?.approvalStatus === "APPROVED") return <Navigate to="/" replace />;

  const statusCopy = membership?.approvalStatus === "REJECTED"
    ? "La solicitud fue rechazada. Contacta al administrador de Proyecto Orquesta."
    : membership?.approvalStatus === "SUSPENDED"
      ? "Este acceso está suspendido. Contacta al administrador."
      : "Tu cuenta fue creada correctamente. Un administrador debe aprobarla antes de que puedas entrar.";

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f5f2fc] p-5 dark:bg-[#0d0b16]">
      <div className="absolute -left-20 top-16 size-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-20 bottom-16 size-80 rounded-full bg-orange-400/10 blur-3xl" />
      <section className="relative w-full max-w-lg rounded-[2rem] border bg-card p-7 text-center shadow-2xl shadow-violet-950/10 sm:p-10">
        <img src={assetUrl("/assets/proyecto-orquesta-logo.png")} alt="Proyecto Orquesta" className="mx-auto h-24 w-auto" />
        <div className="mx-auto mt-7 grid size-16 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400"><Clock3 className="size-8" /></div>
        <p className="mt-6 text-sm font-bold uppercase tracking-[0.16em] text-primary">Solicitud recibida</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Tu acceso está en revisión</h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">{statusCopy}</p>
        {membership?.approvalStatus === "PENDING" && <div className="mt-5 rounded-2xl bg-primary/5 p-4 text-left text-sm leading-relaxed"><p className="font-black text-primary">Cuando recibas la aprobación</p><p className="mt-1 text-muted-foreground">Vuelve al Portal Proyecto Orquesta e ingresa con tu correo y la contraseña que creaste durante el registro.</p></div>}
        <div className="mt-7 rounded-2xl border bg-muted/40 p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cuenta</p>
          <p className="mt-1 font-bold">{user?.firstName} {user?.lastName}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          {session?.user.user_metadata?.address && <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2"><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dirección</p><p className="text-sm font-semibold">{session.user.user_metadata.address}</p></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">EPS</p><p className="text-sm font-semibold">{session.user.user_metadata.eps}</p></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Emergencia</p><p className="text-sm font-semibold">{session.user.user_metadata.emergency_contact_name}</p></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Teléfono</p><p className="text-sm font-semibold">{session.user.user_metadata.emergency_contact_phone}</p></div></div>}
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Button onClick={() => void refreshAccess()} className="h-12 rounded-xl font-bold"><RefreshCw className="mr-2 size-4" /> Revisar estado</Button>
          <Button variant="outline" onClick={() => void signOut()} className="h-12 rounded-xl font-bold"><LogOut className="mr-2 size-4" /> Cerrar sesión</Button>
        </div>
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-primary" /> Control de acceso seguro por organización</p>
      </section>
    </main>
  );
}
