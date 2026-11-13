import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { BellRing, Building2, CheckCircle2, Globe2, ImagePlus, KeyRound, LoaderCircle, LockKeyhole, Palette, Save, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { changeCurrentUserPassword, saveAdminSecurityQuestion } from "@/features/auth/adminSecurity";
import { notifyPublicIdentityUpdated } from "@/hooks/usePublicIdentity";

type OrganizationForm = {
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  primary_color: string;
  logo_url: string;
  cover_url: string;
  instagram: string;
  facebook: string;
  youtube: string;
  tiktok: string;
};

const initialForm: OrganizationForm = {
  name: "",
  phone: "",
  whatsapp: "",
  email: "",
  website: "",
  primary_color: "#5B21F4",
  logo_url: "/assets/proyecto-orquesta-logo.png",
  cover_url: "/assets/orquesta-stage-hero.png",
  instagram: "",
  facebook: "",
  youtube: "",
  tiktok: "",
};

export default function Settings() {
  const { membership, session, user, refreshAccess } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [notifications, setNotifications] = useState({ email: true, push: false, whatsapp: false });
  const [featureFlags, setFeatureFlags] = useState<Record<string, unknown>>({});
  const [taskThresholds, setTaskThresholds] = useState({ green: 80, yellow: 50 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Admin security question & password state
  const [secQuestion, setSecQuestion] = useState("¿Cuál fue el nombre de tu primera agrupación musical o escuela?");
  const [secAnswer, setSecAnswer] = useState("");
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!membership) return;
    Promise.all([
      supabase.from("organizations").select("name,phone,whatsapp,email,website,primary_color,logo_url,cover_url,social_links").eq("id", membership.organizationId).single(),
      supabase.from("organization_settings").select("enabled_notifications,feature_flags").eq("organization_id", membership.organizationId).single(),
    ]).then(([orgResult, settingsResult]) => {
      if (orgResult.error) toast.error("No fue posible cargar la organización");
      if (orgResult.data) {
        const social = (orgResult.data.social_links ?? {}) as Record<string, string>;
        setForm({
          name: orgResult.data.name,
          phone: orgResult.data.phone ?? "",
          whatsapp: orgResult.data.whatsapp ?? "",
          email: orgResult.data.email ?? "",
          website: orgResult.data.website ?? "",
          primary_color: orgResult.data.primary_color,
          logo_url: orgResult.data.logo_url ?? initialForm.logo_url,
          cover_url: orgResult.data.cover_url ?? social.cover_url ?? initialForm.cover_url,
          instagram: social.instagram ?? "",
          facebook: social.facebook ?? "",
          youtube: social.youtube ?? "",
          tiktok: social.tiktok ?? "",
        });
      }
      if (settingsResult.data?.enabled_notifications) setNotifications(settingsResult.data.enabled_notifications as typeof notifications);
      if (settingsResult.data?.feature_flags) {
        const flags = settingsResult.data.feature_flags as Record<string, unknown>;
        setFeatureFlags(flags);
        const thresholds = flags.task_thresholds as { green?: number; yellow?: number } | undefined;
        if (thresholds) setTaskThresholds({ green: thresholds.green ?? 80, yellow: thresholds.yellow ?? 50 });
        const sec = flags.admin_security_recovery_config as { question?: string } | undefined;
        if (sec?.question) setSecQuestion(sec.question);
      }
      setLoading(false);
    });
  }, [membership]);

  const change = (key: keyof OrganizationForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!membership || !session) return;
    if (!form.name.trim() || (form.email && !/^\S+@\S+\.\S+$/.test(form.email))) {
      toast.error("Revisa el nombre y el correo electrónico");
      return;
    }
    const socialValues = [form.facebook, form.instagram, form.youtube, form.tiktok].filter(Boolean);
    if (socialValues.some((value) => !/^https:\/\//i.test(value.trim()))) {
      toast.error("Los enlaces de redes sociales deben comenzar con https://");
      return;
    }
    if (taskThresholds.yellow < 0 || taskThresholds.green > 100 || taskThresholds.yellow >= taskThresholds.green) {
      toast.error("El rango amarillo debe ser menor que el rango verde");
      return;
    }
    setSaving(true);
    // Also persist cover_url inside social_links so get_public_organization_identity() always exposes it even before SQL migration
    const { error } = await supabase
      .from("organizations")
      .update({
        name: form.name.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        email: form.email.trim(),
        website: form.website.trim(),
        primary_color: form.primary_color,
        logo_url: form.logo_url,
        cover_url: form.cover_url,
        social_links: {
          instagram: form.instagram.trim(),
          facebook: form.facebook.trim(),
          youtube: form.youtube.trim(),
          tiktok: form.tiktok.trim(),
          cover_url: form.cover_url,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", membership.organizationId);
    const { error: settingsError } = await supabase
      .from("organization_settings")
      .update({
        enabled_notifications: notifications,
        feature_flags: { ...featureFlags, task_thresholds: taskThresholds },
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", membership.organizationId);
    setSaving(false);
    if (error || settingsError) {
      toast.error("No fue posible guardar la configuración", { description: error?.message ?? settingsError?.message });
      return;
    }
    await supabase.from("audit_logs").insert({
      organization_id: membership.organizationId,
      user_id: session.user.id,
      action: "UPDATE",
      entity_type: "organization",
      entity_id: membership.organizationId,
      new_value: { name: form.name, primary_color: form.primary_color, logo_url: form.logo_url, cover_url: form.cover_url },
    });
    notifyPublicIdentityUpdated();
    await refreshAccess();
    toast.success("Configuración guardada", { description: "Logo, portada e identidad actualizados en todo el portal." });
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>, kind: "logo" | "cover") => {
    const file = event.target.files?.[0];
    if (!file || !membership) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) {
      toast.error("Usa formato PNG, JPG o WebP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen debe pesar menos de 5 MB");
      return;
    }
    setUploading(true);
    const extension = file.name.split(".").pop() ?? "png";
    // Unique timestamp path prevents overwriting or stale CDN caching
    const path = `${membership.organizationId}/${kind}-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from("organization-assets").upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      setUploading(false);
      toast.error("No fue posible cargar la imagen", { description: error.message });
      return;
    }
    const { data } = supabase.storage.from("organization-assets").getPublicUrl(path);
    const freshUrl = `${data.publicUrl}?v=${Date.now()}`;
    change(kind === "logo" ? "logo_url" : "cover_url", freshUrl);
    setUploading(false);
    toast.success(`${kind === "logo" ? "Logo cargado" : "Portada cargada"}. Haz clic en Guardar cambios para publicarlo.`);
  };

  const saveSecurity = async () => {
    if (!membership || !user) return;
    setSavingSecurity(true);
    try {
      await saveAdminSecurityQuestion({
        organizationId: membership.organizationId,
        userId: user.id,
        identifier: user.username || user.email,
        question: secQuestion,
        answer: secAnswer,
      });
      setSecAnswer("");
      toast.success("Pregunta de seguridad actualizada");
    } catch (error) {
      toast.error("No se pudo guardar la pregunta de seguridad", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setSavingSecurity(false);
    }
  };

  const updatePassword = async () => {
    if (!membership || !user) return;
    if (newPassword.length < 8) { toast.error("La nueva contraseña debe tener mínimo 8 caracteres"); return; }
    if (newPassword !== confirmPassword) { toast.error("Las contraseñas no coinciden"); return; }
    setSavingPassword(true);
    try {
      await changeCurrentUserPassword({ organizationId: membership.organizationId, userId: user.id, newPassword });
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Contraseña actualizada correctamente");
    } catch (error) {
      toast.error("No se pudo cambiar la contraseña", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) return <div className="grid min-h-[50vh] place-items-center"><LoaderCircle className="size-7 animate-spin text-primary" /></div>;

  return (
    <form onSubmit={save} className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Administración</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Configuración</h1>
          <p className="mt-2 text-sm text-muted-foreground">Identidad central utilizada en portada pública, ingreso, documentos y comunicaciones.</p>
        </div>
        <Button type="submit" disabled={saving} className="h-11 rounded-xl px-5 font-bold">
          {saving ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />} Guardar cambios
        </Button>
      </div>
      <Tabs defaultValue="organization" className="space-y-5">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-muted/60 p-1.5 sm:w-fit">
          <TabsTrigger value="organization" className="rounded-xl px-4 py-2.5"><Building2 className="mr-2 size-4" /> Organización</TabsTrigger>
          <TabsTrigger value="brand" className="rounded-xl px-4 py-2.5"><Palette className="mr-2 size-4" /> Identidad</TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-xl px-4 py-2.5"><BellRing className="mr-2 size-4" /> Notificaciones</TabsTrigger>
          {membership?.roleCode === "ADMIN" && (
            <TabsTrigger value="security" className="rounded-xl px-4 py-2.5"><LockKeyhole className="mr-2 size-4" /> Seguridad Admin</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="organization">
          <Card className="rounded-[2rem] shadow-none">
            <CardContent className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[1fr_300px]">
              <div>
                <div className="mb-6">
                  <h2 className="text-lg font-black">Información general</h2>
                  <p className="text-sm text-muted-foreground">Datos oficiales y redes visibles en la página de inicio.</p>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Nombre de la organización" value={form.name} onChange={(value) => change("name", value)} />
                  <Field label="Correo electrónico" value={form.email} onChange={(value) => change("email", value)} type="email" />
                  <Field label="Teléfono" value={form.phone} onChange={(value) => change("phone", value)} />
                  <Field label="WhatsApp" value={form.whatsapp} onChange={(value) => change("whatsapp", value)} />
                  <Field label="Página web" value={form.website} onChange={(value) => change("website", value)} />
                  <div>
                    <Label>Moneda y zona horaria</Label>
                    <div className="mt-2 flex h-11 items-center gap-2 rounded-xl border bg-muted/30 px-3 text-sm">
                      <Badge className="rounded-md">COP</Badge><span className="text-muted-foreground">America/Bogota</span>
                    </div>
                  </div>
                  <Field label="Facebook" type="url" value={form.facebook} onChange={(value) => change("facebook", value)} />
                  <Field label="Instagram" type="url" value={form.instagram} onChange={(value) => change("instagram", value)} />
                  <Field label="YouTube" type="url" value={form.youtube} onChange={(value) => change("youtube", value)} />
                  <Field label="TikTok" type="url" value={form.tiktok} onChange={(value) => change("tiktok", value)} />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Deja una red vacía para ocultarla. Los enlaces deben comenzar con https://</p>
              </div>
              <div className="rounded-3xl bg-muted/45 p-5">
                <Globe2 className="size-6 text-primary" />
                <p className="mt-4 font-black">Preparada para crecer</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Cada registro operativo utiliza el identificador de organización y se sincroniza con el portal público.
                </p>
                <div className="mt-5 space-y-2 text-xs">
                  <p className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-600" /> Aislamiento por organización</p>
                  <p className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-600" /> Moneda COP configurada</p>
                  <p className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-600" /> Zona horaria de Colombia</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brand">
          <Card className="rounded-[2rem] shadow-none">
            <CardContent className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[340px_1fr]">
              <div className="space-y-4">
                <div className="rounded-3xl border bg-white p-6">
                  <img src={form.logo_url} alt="Logo actual" className="mx-auto h-40 w-full object-contain" />
                </div>
                <div className="overflow-hidden rounded-3xl border bg-muted">
                  <img src={form.cover_url} alt="Portada actual" className="aspect-video w-full object-cover" />
                </div>
              </div>
              <div>
                <h2 className="text-lg font-black">Identidad visual sincronizada</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  El logo y la portada se reflejan automáticamente en la página de inicio, el login, cotizaciones, contratos y dashboards.
                </p>
                <div className="mt-6 space-y-5">
                  <div>
                    <Label>Logo oficial</Label>
                    <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-4 text-sm font-bold text-primary transition-colors hover:bg-primary/10">
                      <ImagePlus className="size-4" />{uploading ? "Cargando…" : "Cargar nuevo logo"}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void uploadImage(event, "logo")} disabled={uploading} />
                    </label>
                  </div>
                  <div>
                    <Label>Imagen de portada</Label>
                    <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-4 text-sm font-bold text-primary transition-colors hover:bg-primary/10">
                      <ImagePlus className="size-4" />{uploading ? "Cargando…" : "Cargar nueva portada"}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void uploadImage(event, "cover")} disabled={uploading} />
                    </label>
                    <p className="mt-2 text-xs text-muted-foreground">PNG, JPG o WebP. Máximo 5 MB por imagen.</p>
                  </div>
                  <div>
                    <Label htmlFor="color">Color corporativo</Label>
                    <div className="mt-2 flex gap-3">
                      <Input id="color" type="color" value={form.primary_color} onChange={(event) => change("primary_color", event.target.value)} className="h-11 w-16 rounded-xl p-1" />
                      <Input value={form.primary_color} onChange={(event) => change("primary_color", event.target.value)} className="h-11 rounded-xl font-mono uppercase" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="rounded-[2rem] shadow-none">
            <CardContent className="p-5 sm:p-7">
              <div className="mb-6">
                <h2 className="text-lg font-black">Canales de notificación</h2>
                <p className="text-sm text-muted-foreground">Las notificaciones internas informan cumpleaños, tareas, comentarios, vencimientos, solicitudes y aportes.</p>
              </div>
              <div className="max-w-2xl divide-y">
                {[
                  { key: "email" as const, label: "Correo electrónico", note: "Preferencia para avisos administrativos y confirmaciones" },
                  { key: "push" as const, label: "Notificaciones internas", note: "Centro de alertas disponible en todas las sesiones aprobadas" },
                  { key: "whatsapp" as const, label: "WhatsApp", note: "Preparación manual de mensajes, sin envío automático" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-4 py-5">
                    <div>
                      <p className="font-bold">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.note}</p>
                    </div>
                    <Switch checked={notifications[item.key]} onCheckedChange={(checked) => setNotifications((current) => ({ ...current, [item.key]: checked }))} />
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border p-4">
                <p className="font-black">Rangos de cumplimiento musical</p>
                <p className="mt-1 text-xs text-muted-foreground">Configura los límites usados en los indicadores de tareas.</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Verde desde (%)</Label>
                    <Input type="number" min="1" max="100" value={taskThresholds.green} onChange={(event) => setTaskThresholds((current) => ({ ...current, green: Number(event.target.value) }))} className="mt-2 rounded-xl" />
                  </div>
                  <div>
                    <Label>Amarillo desde (%)</Label>
                    <Input type="number" min="0" max="99" value={taskThresholds.yellow} onChange={(event) => setTaskThresholds((current) => ({ ...current, yellow: Number(event.target.value) }))} className="mt-2 rounded-xl" />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex items-start gap-3 rounded-2xl bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="mt-0.5 size-5 shrink-0" />
                <p className="text-sm">El centro interno funciona de inmediato. WhatsApp permanece como enlace o mensaje preparado y nunca se envía automáticamente.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {membership?.roleCode === "ADMIN" && (
          <TabsContent value="security" className="grid gap-5 lg:grid-cols-2">
            <Card className="rounded-[2rem] shadow-none">
              <CardContent className="space-y-4 p-5 sm:p-7">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="size-5" /></span>
                  <div>
                    <h2 className="text-lg font-black">Pregunta de seguridad del Administrador</h2>
                    <p className="text-xs text-muted-foreground">Para restablecer tu clave si olvidas la contraseña.</p>
                  </div>
                </div>
                <div>
                  <Label>Pregunta de seguridad</Label>
                  <Input value={secQuestion} onChange={(e) => setSecQuestion(e.target.value)} className="mt-2 h-11 rounded-xl" />
                </div>
                <div>
                  <Label>Nueva respuesta de seguridad</Label>
                  <Input value={secAnswer} onChange={(e) => setSecAnswer(e.target.value)} placeholder="Escribe la nueva respuesta" className="mt-2 h-11 rounded-xl" />
                </div>
                <Button type="button" onClick={() => void saveSecurity()} disabled={savingSecurity} className="rounded-xl font-bold">
                  {savingSecurity && <LoaderCircle className="mr-2 size-4 animate-spin" />} Guardar pregunta de seguridad
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] shadow-none">
              <CardContent className="space-y-4 p-5 sm:p-7">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><KeyRound className="size-5" /></span>
                  <div>
                    <h2 className="text-lg font-black">Cambiar contraseña del Administrador</h2>
                    <p className="text-xs text-muted-foreground">Cambio directo autenticado (mínimo 8 caracteres).</p>
                  </div>
                </div>
                <div>
                  <Label>Nueva contraseña</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-2 h-11 rounded-xl" />
                </div>
                <div>
                  <Label>Confirmar nueva contraseña</Label>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-2 h-11 rounded-xl" />
                </div>
                <Button type="button" variant="outline" onClick={() => void updatePassword()} disabled={savingPassword} className="rounded-xl font-bold">
                  {savingPassword && <LoaderCircle className="mr-2 size-4 animate-spin" />} Actualizar contraseña
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </form>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <div><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 rounded-xl" /></div>;
}
