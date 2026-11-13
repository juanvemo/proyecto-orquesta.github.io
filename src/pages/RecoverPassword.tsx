import { FormEvent, useState } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, LoaderCircle, LockKeyhole, ShieldAlert, ShieldCheck, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupAdminSecurityQuestion, resetAdminPasswordBySecurityAnswer } from "@/features/auth/adminSecurity";
import { usePublicIdentity } from "@/hooks/usePublicIdentity";

export default function RecoverPassword() {
  const { identity } = usePublicIdentity();
  const navigate = useNavigate();

  const [step, setStep] = useState<"identify" | "verify" | "done">("identify");
  const [identifier, setIdentifier] = useState("");
  const [adminName, setAdminName] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const checkIdentifier = async (event: FormEvent) => {
    event.preventDefault();
    if (!identifier.trim()) return;
    setBusy(true);
    setErrorReason(null);
    try {
      const result = await lookupAdminSecurityQuestion(identifier);
      if (!result.eligible) {
        if (result.reason === "NOT_ADMIN") {
          setErrorReason("La recuperación automática es exclusiva del Administrador. Si eres músico o integrante de la orquesta, solicita al Administrador que actualice tu clave desde el módulo Usuarios.");
        } else if (result.reason === "NO_QUESTION") {
          setErrorReason("La cuenta Administrador aún no tiene una pregunta de seguridad configurada. Inicia sesión o configúrala en Configuración > Seguridad.");
        } else if (result.reason === "RPC_UNAVAILABLE") {
          setErrorReason("El servicio de validación aún requiere ejecutar la migración SQL de seguridad en Supabase para operar sin sesión activa.");
        } else {
          setErrorReason("No encontramos una cuenta Administrador con ese correo o usuario.");
        }
        return;
      }
      setAdminName(result.firstName ?? "Administrador");
      setQuestion(result.question ?? "");
      setStep("verify");
    } catch (error) {
      setErrorReason(error instanceof Error ? error.message : "No fue posible validar la cuenta.");
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (event: FormEvent) => {
    event.preventDefault();
    if (answer.trim().length < 2) {
      toast.error("Ingresa tu respuesta de seguridad");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("La nueva contraseña debe tener mínimo 8 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setBusy(true);
    setErrorReason(null);
    try {
      await resetAdminPasswordBySecurityAnswer({
        identifier,
        answer,
        newPassword,
      });
      toast.success("Contraseña del Administrador actualizada");
      setStep("done");
    } catch (error) {
      setErrorReason(error instanceof Error ? error.message : "No fue posible restablecer la contraseña");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f4fb] p-4 dark:bg-[#0d0b16] sm:p-5">
      <Card className="w-full max-w-lg overflow-hidden rounded-[2.25rem] border-0 shadow-xl">
        <div className="bg-[#24163d] p-7 text-white">
          <img src={identity.logo_url} alt={identity.name} className="h-16 w-auto rounded-xl bg-white p-1.5 object-contain" />
          <p className="mt-6 text-xs font-black uppercase tracking-[.18em] text-violet-200">Recuperación segura · Solo Administrador</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Restablecer acceso de Administrador</h1>
        </div>
        <CardContent className="p-6 sm:p-8">
          {step === "done" ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
              <h2 className="mt-4 text-xl font-black">Contraseña actualizada</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Se actualizó tu contraseña de forma segura, se invalidaron las sesiones anteriores y el evento quedó registrado en auditoría.
              </p>
              <Button onClick={() => navigate("/login", { replace: true })} className="mt-6 h-12 w-full rounded-xl font-black">
                Ir a iniciar sesión
              </Button>
            </div>
          ) : step === "identify" ? (
            <form onSubmit={checkIdentifier} className="space-y-5">
              <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <ShieldCheck className="size-5" />
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Eliminamos la recuperación por correo electrónico. Únicamente el <strong>Administrador</strong> puede restablecer su contraseña mediante su pregunta de seguridad verificada. Los demás usuarios pueden pedir su cambio de clave directamente al Administrador.
              </p>
              <div>
                <Label htmlFor="admin-identifier">Usuario o correo del Administrador</Label>
                <div className="relative mt-2">
                  <UserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="admin-identifier"
                    value={identifier}
                    onChange={(e) => { setIdentifier(e.target.value); setErrorReason(null); }}
                    placeholder="admin o correo@dominio.com"
                    autoCapitalize="none"
                    autoCorrect="off"
                    className="h-12 rounded-xl pl-9"
                    required
                  />
                </div>
              </div>
              {errorReason && (
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
                  <ShieldAlert className="mb-1.5 size-5" />
                  <p className="font-bold">Verificación requerida</p>
                  <p className="mt-1 text-xs leading-relaxed">{errorReason}</p>
                </div>
              )}
              <Button disabled={busy} className="h-12 w-full rounded-xl font-black">
                {busy ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <KeyRound className="mr-2 size-4" />}
                Validar cuenta Administrador
              </Button>
              <Button asChild variant="ghost" className="w-full rounded-xl">
                <Link to="/login"><ArrowLeft className="mr-2 size-4" />Volver al ingreso</Link>
              </Button>
            </form>
          ) : (
            <form onSubmit={submitReset} className="space-y-4">
              <div className="rounded-2xl bg-primary/5 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-primary">Pregunta de seguridad para {adminName}</p>
                <p className="mt-1.5 font-bold">{question}</p>
              </div>
              <div>
                <Label>Tu respuesta de seguridad *</Label>
                <Input
                  value={answer}
                  onChange={(e) => { setAnswer(e.target.value); setErrorReason(null); }}
                  placeholder="Escribe tu respuesta"
                  className="mt-2 h-11 rounded-xl"
                  required
                />
              </div>
              <div>
                <Label>Nueva contraseña *</Label>
                <div className="relative mt-2">
                  <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="h-11 rounded-xl pl-9"
                    required
                  />
                </div>
              </div>
              <div>
                <Label>Confirmar nueva contraseña *</Label>
                <div className="relative mt-2">
                  <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la nueva contraseña"
                    className="h-11 rounded-xl pl-9"
                    required
                  />
                </div>
              </div>
              {errorReason && (
                <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
                  {errorReason}
                </div>
              )}
              <Button disabled={busy} className="h-12 w-full rounded-xl font-black">
                {busy ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <ShieldCheck className="mr-2 size-4" />}
                Verificar y cambiar contraseña
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setStep("identify"); setErrorReason(null); }} className="w-full rounded-xl">
                <ArrowLeft className="mr-2 size-4" /> Cambiar usuario
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
