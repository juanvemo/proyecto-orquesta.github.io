import { useId, useRef, useState } from "react";
import { LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { contributionErrorMessage } from "@/features/rehearsals/costs";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  organizationId: string;
  contributionId: string;
  label: string;
  amount: number;
  status: "PENDIENTE" | "PAGADO";
  disabled?: boolean;
  onVoided: () => void | Promise<void>;
};

export function VoidContributionButton({ organizationId, contributionId, label, amount, status, disabled, onVoided }: Props) {
  const { membership } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const mutation = useRef(false);
  const id = useId();
  if (membership?.roleCode !== "ADMIN" || membership.organizationId !== organizationId) return null;

  const submit = async () => {
    if (mutation.current || !confirmed || reason.trim().length < 3) return;
    mutation.current = true;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("void_rehearsal_contribution", {
        target_contribution_id: contributionId,
        target_organization_id: organizationId,
        reason: reason.trim(),
      });
      if (error) throw error;
      toast.success("Aporte anulado", { description: "Se retiró de los saldos y se ajustó el costo distribuido. El respaldo permanece en auditoría." });
      setOpen(false);
      await onVoided();
    } catch (error) {
      toast.error("No fue posible anular el aporte", { description: contributionErrorMessage(error) });
    } finally {
      mutation.current = false;
      setSaving(false);
    }
  };

  return <>
    <Button variant="outline" size="sm" disabled={disabled || saving} className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { setReason(""); setConfirmed(false); setOpen(true); }}>
      <Trash2 className="mr-2 size-4" /> Eliminar aporte
    </Button>
    <Dialog open={open} onOpenChange={(next) => { if (!mutation.current) setOpen(next); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto rounded-[1.75rem] sm:rounded-[1.75rem]" onInteractOutside={(event) => { if (saving) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle className="pr-6 text-xl font-black">Eliminar un aporte incorrecto</DialogTitle>
          <DialogDescription className="pt-2 leading-relaxed">La eliminación es una anulación: el aporte deja de aparecer en pagos, cobros y saldos, pero su registro original se conserva en auditoría.</DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border bg-muted/40 p-4">
          <p className="break-words font-bold">{label}</p>
          <p className="mt-2 text-2xl font-black">{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 }).format(amount)}</p>
          <p className="mt-2 text-sm text-muted-foreground">Este importe también se descontará del costo total distribuido del ensayo.</p>
        </div>
        {status === "PAGADO" && <p className="rounded-2xl border border-orange-300 bg-orange-500/10 p-4 text-sm text-orange-800">Este aporte ya está confirmado. Anularlo corrige los registros; no realiza una devolución de dinero.</p>}
        <div className="space-y-2">
          <Label htmlFor={`${id}-reason`}>Motivo de la anulación</Label>
          <Textarea id={`${id}-reason`} value={reason} disabled={saving} maxLength={500} onChange={(event) => setReason(event.target.value)} className="min-h-24 rounded-xl" placeholder="Ej. Aporte registrado por error durante una prueba" />
          <p className="text-xs text-muted-foreground">Entre 3 y 500 caracteres. Se guardará junto con tu usuario y la fecha.</p>
        </div>
        <label className="flex items-start gap-3 rounded-xl bg-muted/40 p-3 text-sm" htmlFor={`${id}-confirm`}>
          <input id={`${id}-confirm`} type="checkbox" checked={confirmed} disabled={saving} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" />
          Confirmo que este es el aporte de prueba o incorrecto que quiero anular.
        </label>
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 shrink-0 text-primary" /> Solo el Administrador puede realizar esta acción.</p>
        <DialogFooter className="gap-2 sm:space-x-0">
          <Button variant="outline" className="rounded-xl" disabled={saving} onClick={() => setOpen(false)}>Cancelar</Button>
          <Button className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={saving || !confirmed || reason.trim().length < 3} onClick={() => void submit()}>
            {saving ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />} Confirmar anulación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
