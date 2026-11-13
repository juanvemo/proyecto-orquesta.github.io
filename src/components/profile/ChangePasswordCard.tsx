import { useRef, useState } from "react";
import { KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function ChangePasswordCard() {
  const { session } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const changePassword = async () => {
    if (lock.current || !session) return;
    if (!currentPassword || newPassword.length < 8) { toast.error("Escribe tu contraseña actual y una nueva de al menos 8 caracteres"); return; }
    if (newPassword !== confirmation) { toast.error("Las contraseñas nuevas no coinciden"); return; }
    if (currentPassword === newPassword) { toast.error("La nueva contraseña debe ser diferente"); return; }
    lock.current = true;
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || data.user?.id !== session.user.id || !data.user.email) throw new Error("Vuelve a iniciar sesión para validar tu identidad.");
      const validation = await supabase.auth.signInWithPassword({ email: data.user.email, password: currentPassword });
      if (validation.error) throw new Error("La contraseña actual no es correcta o la sesión no pudo validarse.");
      if (validation.data.user?.id !== session.user.id) throw new Error("La sesión no corresponde a tu cuenta.");
      const update = await supabase.auth.updateUser({ password: newPassword });
      if (update.error) throw new Error(update.error.message);
      setCurrentPassword(""); setNewPassword(""); setConfirmation("");
      toast.success("Contraseña actualizada", { description: "Tu rol, permisos y datos no se modificaron." });
      const otherSessions = await supabase.auth.signOut({ scope: "others" });
      if (otherSessions.error) toast.warning("La contraseña cambió, pero no se pudo solicitar el cierre de otras sesiones", { description: otherSessions.error.message });
    } catch (error) {
      toast.error("No se pudo completar el cambio de contraseña", { description: error instanceof Error ? error.message : undefined });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return <Card className="rounded-[2rem] border-primary/20 shadow-none"><CardContent className="p-5 sm:p-7" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void changePassword(); } }}><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="size-5" /></span><div><h2 className="text-lg font-black">Seguridad de mi cuenta</h2><p className="mt-1 text-sm text-muted-foreground">Cambia tu propia contraseña validando primero la actual. No cambia tu nivel de acceso.</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-3"><div><Label htmlFor="security-current-password">Contraseña actual</Label><Input id="security-current-password" type="password" autoComplete="current-password" value={currentPassword} disabled={busy} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-2 rounded-xl" /></div><div><Label htmlFor="security-new-password">Nueva contraseña</Label><Input id="security-new-password" type="password" autoComplete="new-password" minLength={8} value={newPassword} disabled={busy} onChange={(event) => setNewPassword(event.target.value)} className="mt-2 rounded-xl" /></div><div><Label htmlFor="security-confirm-password">Confirmar nueva contraseña</Label><Input id="security-confirm-password" type="password" autoComplete="new-password" value={confirmation} disabled={busy} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 rounded-xl" /></div></div><div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Usa al menos 8 caracteres. Nunca compartas tu contraseña.</p><Button type="button" onClick={() => void changePassword()} disabled={busy} className="rounded-xl font-bold">{busy ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <KeyRound className="mr-2 size-4" />}Cambiar mi contraseña</Button></div></CardContent></Card>;
}
