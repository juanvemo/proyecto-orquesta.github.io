import { FormEvent, useEffect, useState } from "react";
import { KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { changeCurrentUserPassword, hasAdminSecurityConfigured, saveAdminSecurityQuestion } from "@/features/auth/adminSecurity";

const SUGGESTED_QUESTIONS = [
  "¿Cuál fue el nombre de tu primera agrupación musical o escuela?",
  "¿En qué ciudad diste tu primer concierto?",
  "¿Cuál es el nombre de tu instrumento o canción favorita?",
  "¿Cuál es el segundo apellido de tu abuela materna?",
  "Escribir mi propia pregunta personalizada",
];

export function AdminSecuritySetupDialog() {
  const { user, membership, refreshAccess } = useAuth();
  const [openQuestionPrompt, setOpenQuestionPrompt] = useState(false);
  const [openPasswordChangePrompt, setOpenPasswordChangePrompt] = useState(false);

  const [selectedPreset, setSelectedPreset] = useState(SUGGESTED_QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [savingQuestion, setSavingQuestion] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const isAdmin = membership?.roleCode === "ADMIN" && membership.approvalStatus === "APPROVED";

  useEffect(() => {
    if (!isAdmin || !user || !membership) return;
    if (user.mustChangePassword) {
      setOpenPasswordChangePrompt(true);
      return;
    }
    const dismissKey = `po_admin_sec_prompted_${user.id}`;
    if (sessionStorage.getItem(dismissKey) === "done") return;

    void hasAdminSecurityConfigured(membership.organizationId, user.id).then((configured) => {
      if (!configured) {
        setOpenQuestionPrompt(true);
      } else {
        sessionStorage.setItem(dismissKey, "done");
      }
    });
  }, [isAdmin, user, membership]);

  if (!isAdmin || !user || !membership) return null;

  const finalQuestion = selectedPreset === "Escribir mi propia pregunta personalizada"
    ? customQuestion
    : selectedPreset;

  const handleSaveQuestion = async (event: FormEvent) => {
    event.preventDefault();
    setSavingQuestion(true);
    try {
      await saveAdminSecurityQuestion({
        organizationId: membership.organizationId,
        userId: user.id,
        identifier: user.username || user.email,
        question: finalQuestion,
        answer,
      });
      sessionStorage.setItem(`po_admin_sec_prompted_${user.id}`, "done");
      setOpenQuestionPrompt(false);
      setAnswer("");
      toast.success("Pregunta de seguridad configurada");
    } catch (error) {
      toast.error("No se pudo guardar la pregunta de seguridad", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleSavePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      toast.error("La nueva contraseña debe tener mínimo 8 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setSavingPassword(true);
    try {
      await changeCurrentUserPassword({
        organizationId: membership.organizationId,
        userId: user.id,
        newPassword,
      });
      await refreshAccess();
      setOpenPasswordChangePrompt(false);
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Contraseña actualizada correctamente");
    } catch (error) {
      toast.error("No se pudo cambiar la contraseña", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <Dialog open={openQuestionPrompt} onOpenChange={(next) => { if (!next) sessionStorage.setItem(`po_admin_sec_prompted_${user.id}`, "done"); setOpenQuestionPrompt(next); }}>
        <DialogContent className="rounded-[2rem] sm:max-w-lg">
          <form onSubmit={handleSaveQuestion}>
            <DialogHeader>
              <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <ShieldCheck className="size-6" />
              </div>
              <DialogTitle className="text-xl font-black">Configura tu pregunta de seguridad</DialogTitle>
              <DialogDescription>
                Como Administrador, esta pregunta te permitirá restablecer tu contraseña de forma segura si llegas a olvidarla.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 space-y-4">
              <div>
                <Label>Pregunta de seguridad</Label>
                <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                  <SelectTrigger className="mt-2 h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUGGESTED_QUESTIONS.map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedPreset === "Escribir mi propia pregunta personalizada" && (
                <div>
                  <Label>Tu pregunta personalizada *</Label>
                  <Input
                    value={customQuestion}
                    onChange={(e) => setCustomQuestion(e.target.value)}
                    placeholder="Ej. ¿Cómo se llamaba mi primer maestro de música?"
                    className="mt-2 h-11 rounded-xl"
                    required
                  />
                </div>
              )}
              <div>
                <Label>Respuesta de seguridad *</Label>
                <Input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Escribe una respuesta que solo tú conozcas"
                  className="mt-2 h-11 rounded-xl"
                  required
                />
                <p className="mt-1.5 text-xs text-muted-foreground">Se guarda cifrada y con protección contra intentos repetidos.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => { sessionStorage.setItem(`po_admin_sec_prompted_${user.id}`, "done"); setOpenQuestionPrompt(false); }}>
                Configurar después
              </Button>
              <Button type="submit" disabled={savingQuestion} className="rounded-xl font-black">
                {savingQuestion && <LoaderCircle className="mr-2 size-4 animate-spin" />}
                Guardar seguridad
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openPasswordChangePrompt} onOpenChange={() => {}}>
        <DialogContent className="rounded-[2rem] sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <form onSubmit={handleSavePassword}>
            <DialogHeader>
              <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-600">
                <KeyRound className="size-6" />
              </div>
              <DialogTitle className="text-xl font-black">Actualiza tu contraseña</DialogTitle>
              <DialogDescription>
                Por seguridad, debes definir una contraseña nueva antes de continuar operando el portal.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 space-y-4">
              <div>
                <Label>Nueva contraseña *</Label>
                <Input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-2 h-11 rounded-xl" required />
              </div>
              <div>
                <Label>Confirmar nueva contraseña *</Label>
                <Input type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-2 h-11 rounded-xl" required />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button type="submit" disabled={savingPassword} className="w-full rounded-xl font-black">
                {savingPassword && <LoaderCircle className="mr-2 size-4 animate-spin" />}
                Guardar nueva contraseña
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
