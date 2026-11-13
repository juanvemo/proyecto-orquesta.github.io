import { FormEvent, useEffect, useState } from "react";
import { Copy, Eye, EyeOff, KeyRound, LoaderCircle, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

type Role = { id: string; name: string; code: string };
type Credentials = { identifier: string; password: string };

export function UserCreateDialog({ open, onOpenChange, organizationId, roles, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; organizationId: string; roles: Role[]; onCreated: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  useEffect(() => {
    if (!open) return;
    setFirstName(""); setLastName(""); setIdentifier(""); setPassword(""); setRoleId(""); setShowPassword(false); setCredentials(null);
  }, [open]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (firstName.trim().length < 2 || lastName.trim().length < 2 || identifier.trim().length < 3 || password.length < 8 || !roleId) {
      toast.error("Completa todos los campos y usa una contraseña de mínimo 8 caracteres");
      return;
    }
    setSaving(true);
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const { data, error } = await supabase.functions.invoke("admin-manage-user", { body: { action: "create", organization_id: organizationId, first_name: firstName.trim(), last_name: lastName.trim(), identifier: normalizedIdentifier, password, role_id: roleId } });
    setSaving(false);
    const response = data as { success?: boolean; error?: string } | null;
    if (error || response?.error || !response?.success) {
      let description = response?.error ?? error?.message ?? "Error desconocido";
      const context = error && typeof error === "object" && "context" in error ? error.context : null;
      if (context instanceof Response) {
        try { const details = await context.clone().json() as { error?: string }; description = details.error ?? description; } catch { /* La respuesta no contenía JSON. */ }
      }
      toast.error("No fue posible crear el usuario", { description });
      return;
    }
    setCredentials({ identifier: normalizedIdentifier, password });
    onCreated();
    toast.success("Usuario creado sin depender del envío de correo");
  };

  const copyCredentials = async () => {
    if (!credentials) return;
    await navigator.clipboard.writeText(`Usuario: ${credentials.identifier}\nContraseña temporal: ${credentials.password}`);
    toast.success("Credenciales copiadas");
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="rounded-[2rem] sm:max-w-lg"><DialogHeader><span className="mb-2 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><UserPlus className="size-5" /></span><DialogTitle className="text-2xl font-black">Crear usuario</DialogTitle><DialogDescription>La cuenta queda activa inmediatamente. La persona deberá completar sus datos en el primer acceso.</DialogDescription></DialogHeader>{credentials ? <div className="mt-3 space-y-5"><div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5"><p className="font-black text-emerald-800 dark:text-emerald-300">Cuenta creada correctamente</p><p className="mt-3 text-sm"><strong>Ingreso:</strong> {credentials.identifier}</p><p className="mt-1 text-sm"><strong>Contraseña temporal:</strong> {credentials.password}</p><p className="mt-3 text-xs leading-relaxed text-muted-foreground">Entrega estas credenciales de forma privada. No fue necesario enviar correo.</p></div><div className="flex justify-end gap-3"><Button variant="outline" onClick={() => void copyCredentials()} className="rounded-xl"><Copy className="mr-2 size-4" />Copiar</Button><Button onClick={() => onOpenChange(false)} className="rounded-xl font-bold">Finalizar</Button></div></div> : <form onSubmit={submit} className="mt-3 space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Nombre" value={firstName} onChange={setFirstName} /><Field label="Apellidos" value={lastName} onChange={setLastName} /></div><div><Label>Correo o nombre de usuario</Label><Input value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="mt-2 h-11 rounded-xl" placeholder="correo@dominio.com o juan.perez" autoCapitalize="none" autoCorrect="off" required /><p className="mt-2 text-xs text-muted-foreground">El correo puede usar cualquier dominio y no tiene un límite adicional del portal. Si no usas correo, escribe un usuario de 3 a 30 caracteres.</p></div><div><Label>Rol de acceso</Label><Select value={roleId} onValueChange={setRoleId}><SelectTrigger className="mt-2 h-11 rounded-xl"><SelectValue placeholder="Seleccionar rol" /></SelectTrigger><SelectContent>{roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Contraseña temporal</Label><div className="relative mt-2"><KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" className="h-11 rounded-xl px-9" required /><button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Mostrar contraseña">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></div><div className="rounded-2xl bg-primary/5 p-4 text-xs leading-relaxed text-muted-foreground">La creación no envía correos, por lo que un límite del proveedor no detendrá el alta. La persona cambia o recupera su clave posteriormente si su cuenta utiliza un correo real.</div><div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button><Button disabled={saving} className="rounded-xl font-black">{saving ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <UserPlus className="mr-2 size-4" />}Crear usuario</Button></div></form>}</DialogContent></Dialog>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div><Label>{label}</Label><Input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 rounded-xl" required /></div>; }
