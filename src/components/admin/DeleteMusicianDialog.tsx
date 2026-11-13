import { useState } from "react";
import { AlertTriangle, LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export function DeleteMusicianDialog({
  open,
  onOpenChange,
  musicianName,
  deleting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  musicianName: string;
  deleting: boolean;
  onConfirm: (anonymize: boolean) => Promise<void>;
}) {
  const [anonymize, setAnonymize] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!deleting) onOpenChange(next); }}>
      <DialogContent className="rounded-[2rem] sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-xl font-black">Eliminar músico</DialogTitle>
              <DialogDescription>Esta acción retirará a {musicianName} del directorio activo.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-sm text-muted-foreground">
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-xs leading-relaxed text-foreground">
            <p className="font-bold text-destructive">Consecuencias de la eliminación:</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Se revocará su acceso de usuario y se retirará su ficha del directorio activo.</li>
              <li>Se eliminarán sus convocatorias pendientes futuras y disponibilidades vigentes.</li>
              <li>Sus aportes, pagos, asistencias y eventos pasados se conservarán en el historial para no romper la contabilidad ni auditoría.</li>
            </ul>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 hover:bg-muted/40">
            <Checkbox
              id="anonymize-musician"
              checked={anonymize}
              onCheckedChange={(checked) => setAnonymize(Boolean(checked))}
            />
            <div className="space-y-0.5">
              <Label htmlFor="anonymize-musician" className="cursor-pointer text-sm font-bold">
                Anonimizar nombre en registros históricos
              </Label>
              <p className="text-xs text-muted-foreground">
                Si se activa, el historial mostrará “Músico retirado” en lugar del nombre real. Si no se marca, el historial conservará el nombre para referencia administrativa.
              </p>
            </div>
          </label>
        </div>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={deleting} onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={deleting}
            onClick={() => void onConfirm(anonymize)}
            className="rounded-xl font-bold"
          >
            {deleting ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
            Eliminar definitivamente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
