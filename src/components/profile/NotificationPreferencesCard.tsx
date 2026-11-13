import { useEffect, useState } from "react";
import { BellRing, Mail, MessageCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

export function NotificationPreferencesCard({ userId, whatsappNumber }: { userId: string; whatsappNumber: string }) {
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasWhatsapp = whatsappNumber.replace(/\D/g, "").length >= 10;

  useEffect(() => {
    supabase.from("notification_preferences").select("whatsapp_enabled").eq("user_id", userId).maybeSingle()
      .then(({ data }) => {
        setWhatsappEnabled(data?.whatsapp_enabled ?? false);
        setLoading(false);
      });
  }, [userId]);

  const updateWhatsapp = async (enabled: boolean) => {
    if (enabled && !hasWhatsapp) {
      toast.error("Registra primero un número de WhatsApp válido y guarda tu perfil");
      return;
    }
    setWhatsappEnabled(enabled);
    const { error } = await supabase.from("notification_preferences").upsert({
      user_id: userId,
      whatsapp_enabled: enabled,
      whatsapp_consent_at: enabled ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) {
      setWhatsappEnabled(!enabled);
      toast.error("No se pudo actualizar la preferencia", { description: error.message });
      return;
    }
    toast.success(enabled ? "Notificaciones por WhatsApp activadas" : "Notificaciones por WhatsApp desactivadas");
  };

  return (
    <Card className="rounded-[2rem] border-primary/15 shadow-none">
      <CardContent className="p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><BellRing className="size-5" /></span>
          <div><h2 className="text-lg font-black">Canales de notificación</h2><p className="mt-1 text-sm text-muted-foreground">Recibe fuera del portal los avisos que se generen para tu cuenta.</p></div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <div className="flex items-center gap-4 rounded-2xl border bg-muted/25 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-700"><Mail className="size-5" /></span>
            <div className="min-w-0 flex-1"><p className="font-black">Correo electrónico</p><p className="text-xs text-muted-foreground">Activo para todas las notificaciones.</p></div>
            <ShieldCheck className="size-5 shrink-0 text-emerald-600" />
          </div>
          <div className="flex items-center gap-4 rounded-2xl border bg-muted/25 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700"><MessageCircle className="size-5" /></span>
            <div className="min-w-0 flex-1"><p className="font-black">WhatsApp</p><p className="truncate text-xs text-muted-foreground">{hasWhatsapp ? whatsappNumber : "Registra y guarda un número válido"}</p></div>
            <Switch checked={whatsappEnabled} disabled={loading || !hasWhatsapp} onCheckedChange={(enabled) => void updateWhatsapp(enabled)} aria-label="Activar notificaciones por WhatsApp" />
          </div>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Al activar WhatsApp autorizas mensajes operativos de Proyecto Orquesta. Puedes retirar el consentimiento en cualquier momento.</p>
      </CardContent>
    </Card>
  );
}
