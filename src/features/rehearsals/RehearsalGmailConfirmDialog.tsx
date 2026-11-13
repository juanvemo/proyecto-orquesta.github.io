import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, LoaderCircle, LogOut, Mail, MapPin, Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { GoogleSignInButton } from "@/components/google/GoogleSignInButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  connectGmailAccount,
  disconnectGmailAccount,
  getGmailAuthSnapshot,
  subscribeGmailAuthState,
} from "@/integrations/google/gmailAuth";
import { sendRehearsalScheduleEmailsViaGmail, type RehearsalEmailRecipient } from "@/integrations/google/gmailService";
import { getAppRouteUrl } from "@/lib/authRedirect";
import type { Rehearsal } from "./types";

export function RehearsalGmailConfirmDialog({
  open,
  onOpenChange,
  rehearsal,
  organizationName,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  rehearsal: Rehearsal;
  organizationName: string;
}) {
  const [gmailState, setGmailState] = useState(() => getGmailAuthSnapshot());
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [attachIcs, setAttachIcs] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeGmailAuthState(() => {
      setGmailState(getGmailAuthSnapshot());
    });
    return unsubscribe;
  }, []);

  const recipients = useMemo(() => {
    return rehearsal.rehearsal_musicians.map((inv) => {
      const name = `${inv.musician?.first_name ?? "Músico"} ${inv.musician?.last_name ?? ""}`.trim();
      const email = (inv.musician?.email ?? "").trim();
      return {
        musicianId: inv.musician_id,
        name,
        email,
        hasEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        confirmationUrl: getAppRouteUrl(`/convocatoria/${inv.public_token}`),
      };
    });
  }, [rehearsal.rehearsal_musicians]);

  const validRecipients = useMemo(() => recipients.filter((r) => r.hasEmail), [recipients]);
  const missingEmailRecipients = useMemo(() => recipients.filter((r) => !r.hasEmail), [recipients]);

  useEffect(() => {
    if (open) {
      setSelectedIds(validRecipients.map((r) => r.musicianId));
      setSubject(`Programación de ensayo: ${rehearsal.name} (${rehearsal.rehearsal_date})`);
      setCustomMessage("");
      setAttachIcs(true);
    }
  }, [open, rehearsal.id, rehearsal.name, rehearsal.rehearsal_date, validRecipients]);

  const toggleRecipient = (musicianId: string) => {
    setSelectedIds((curr) => (curr.includes(musicianId) ? curr.filter((id) => id !== musicianId) : [...curr, musicianId]));
  };

  const handleGoogleConnect = async () => {
    setConnecting(true);
    try {
      const res = await connectGmailAccount();
      toast.success(`Gmail conectado: ${res.user.email ?? "Cuenta Google"}`);
    } catch (error) {
      toast.error("No se pudo conectar con Google Gmail", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectGmailAccount();
    toast.info("Cuenta de Gmail desconectada");
  };

  const handleConfirmSend = async () => {
    if (!gmailState.hasToken || !gmailState.email) {
      toast.error("Primero conecta tu cuenta de Gmail con Google.");
      return;
    }
    const chosen: RehearsalEmailRecipient[] = validRecipients
      .filter((r) => selectedIds.includes(r.musicianId))
      .map((r) => ({
        musicianId: r.musicianId,
        name: r.name,
        email: r.email,
        confirmationUrl: r.confirmationUrl,
      }));

    if (!chosen.length) {
      toast.error("Selecciona al menos un músico con correo electrónico válido.");
      return;
    }

    setSending(true);
    try {
      const result = await sendRehearsalScheduleEmailsViaGmail({
        fromEmail: gmailState.email,
        rehearsal,
        organizationName,
        subject: subject.trim() || `Programación de ensayo: ${rehearsal.name}`,
        customMessage,
        attachIcs,
        recipients: chosen,
      });

      if (result.sent > 0 && result.failed.length === 0) {
        toast.success(`Se enviaron ${result.sent} correos desde ${gmailState.email}`, {
          description: "Los músicos recibieron la programación del ensayo y la invitación de calendario.",
        });
        onOpenChange(false);
      } else if (result.sent > 0 && result.failed.length > 0) {
        toast.warning(`Enviados ${result.sent} correos; ${result.failed.length} fallaron`, {
          description: result.failed.map((f) => `${f.name}: ${f.reason}`).join(" · "),
        });
      } else {
        toast.error("No se pudo enviar ningún correo", {
          description: result.failed[0]?.reason,
        });
      }
    } catch (error) {
      toast.error("Error enviando desde Gmail", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[2rem] p-0 sm:max-w-2xl">
        <DialogHeader className="border-b p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Mail className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-xl font-black">Confirmar envío de calendario por Gmail</DialogTitle>
              <DialogDescription>
                Revisa los destinatarios y confirma antes de enviar correos desde tu cuenta de Gmail.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 p-5 sm:p-6">
          {/* Sender Gmail account connection */}
          <div className="rounded-2xl border bg-muted/30 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Cuenta remitente (Gmail)</p>
            {gmailState.hasToken && gmailState.email ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span className="text-sm font-bold">{gmailState.email}</span>
                  <Badge className="rounded-lg bg-emerald-500/10 text-emerald-700">Conectado</Badge>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => void handleDisconnect()} className="rounded-xl">
                  <LogOut className="mr-1.5 size-3.5" /> Cambiar cuenta
                </Button>
              </div>
            ) : (
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Conecta tu cuenta de Google para enviar este correo directamente desde tu Gmail.
                </p>
                <GoogleSignInButton onClick={() => void handleGoogleConnect()} loading={connecting} label="Sign in with Google" />
              </div>
            )}
          </div>

          {/* Rehearsal summary */}
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm">
            <p className="font-black text-primary">{rehearsal.name}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarClock className="size-3.5 text-primary" />
                {rehearsal.rehearsal_date} · {rehearsal.start_time.slice(0, 5)} – {rehearsal.end_time.slice(0, 5)}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-primary" />
                {rehearsal.location}
              </span>
            </div>
          </div>

          {/* Subject & message */}
          <div className="space-y-3">
            <div>
              <Label>Asunto del correo</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1.5 h-10 rounded-xl" />
            </div>
            <div>
              <Label>Nota adicional para los músicos (opcional)</Label>
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Ej. Llegar 15 minutos antes para prueba de sonido y llevar atril."
                className="mt-1.5 rounded-xl"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
              <Checkbox checked={attachIcs} onCheckedChange={(checked) => setAttachIcs(Boolean(checked))} />
              Adjuntar archivo de calendario (.ics) y botón para agregar a Google Calendar
            </label>
          </div>

          {/* Recipients */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Músicos destinatarios ({selectedIds.length} de {validRecipients.length} seleccionados)</Label>
              {validRecipients.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-lg text-xs"
                  onClick={() =>
                    setSelectedIds(
                      selectedIds.length === validRecipients.length ? [] : validRecipients.map((r) => r.musicianId),
                    )
                  }
                >
                  {selectedIds.length === validRecipients.length ? "Desmarcar todos" : "Seleccionar todos"}
                </Button>
              )}
            </div>

            {validRecipients.length ? (
              <div className="max-h-48 divide-y overflow-y-auto rounded-2xl border">
                {validRecipients.map((r) => (
                  <label key={r.musicianId} className="flex cursor-pointer items-center justify-between gap-3 p-3 hover:bg-muted/40">
                    <div className="flex items-center gap-3 min-w-0">
                      <Checkbox checked={selectedIds.includes(r.musicianId)} onCheckedChange={() => toggleRecipient(r.musicianId)} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{r.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.email}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                Ninguno de los músicos convocados tiene correo electrónico registrado en su ficha.
              </div>
            )}

            {missingEmailRecipients.length > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <div>
                  <strong>{missingEmailRecipients.length} músico(s) sin correo registrado:</strong>{" "}
                  {missingEmailRecipients.map((m) => m.name).join(", ")}.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse justify-end gap-2 border-t bg-background/95 p-4 backdrop-blur sm:flex-row sm:px-6">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar / No enviar
          </Button>
          <Button
            type="button"
            className="rounded-xl font-bold"
            disabled={sending || !gmailState.hasToken || selectedIds.length === 0}
            onClick={() => void handleConfirmSend()}
          >
            {sending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
            Confirmar y enviar {selectedIds.length} correo{selectedIds.length === 1 ? "" : "s"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
