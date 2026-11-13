import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, LoaderCircle, Save, UserRoundPen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type EditableUser = { user_id: string; profile?: { first_name: string | null; last_name: string | null; email: string | null; username?: string | null } };

export function UserEditDialog({ open, onOpenChange, user, organizationId, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; user: EditableUser | null; organizationId: string; onSaved: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open && user) { setFirstName(user.profile?.first_name ?? ""); setLastName(user.profile?.last_name ?? ""); setPassword(""); setShowPassword(false); } }, [open, user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || firstName.trim().length < 2 || lastName.trim().length < 2) { toast.error("Escribe nombre y apellidos válidos"); return; }
    if (password && password.length < 8) { toast.error("La nueva contraseña debe tener mínimo 8 caracteres"); return; }
    setSaving(true);
    const { error } = await supabase.functions.invoke("admin-manage-user", { body: { organization_id: organizationId, user_id: user.user_id, first_name: firstName.trim(), last_name: lastName.trim(), password: password || undefined } });
    setSaving(false);
    if (error) { toast.error("No fue posible actualizar el usuario", { description: error.message }); return; }
    toast.success(password ? "Usuario y contraseña actualizados" : "Nombre del usuario actualizado");
    onOpenChange(false); onSaved();
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="rounded-[2rem] sm:max-w-lg"><DialogHeader><div className="mb-2 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><UserRoundPen className="size-5" /></div><DialogTitle className="text-2xl font-black">Editar usuario</DialogTitle><DialogDescription>Actualiza el nombre visible y, si es necesario, asigna una nueva contraseña.</DialogDescription></DialogHeader><form onSubmit={submit} className="mt-3 space-y-5"><div className="grid gap-4 sm:grid-cols-2"><div><Label>Nombre</Label><Input value={firstName} onChange={(event) => setFirstName(event.target.value)} className="mt-2 h-11 rounded-xl" required /></div><div><Label>Apellidos</Label><Input value={lastName} onChange={(event) => setLastName(event.target.value)} className="mt-2 h-11 rounded-xl" required /></div></div><div><Label>Identificador de acceso</Label><Input value={user?.profile?.username ?? user?.profile?.email ?? ""} className="mt-2 h-11 rounded-xl bg-muted" disabled /></div><div><Label>Nueva contraseña <span className="font-normal text-muted-foreground">(opcional)</span></Label><div className="relative mt-2"><KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 rounded-xl px-9" placeholder="Mínimo 8 caracteres" autoComplete="new-password" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div><p className="mt-2 text-xs text-muted-foreground">La contraseña se reemplaza inmediatamente y nunca queda visible ni almacenada en la aplicación.</p></div><div className="flex justify-end gap-3 pt-2"><Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={saving} className="rounded-xl font-bold">{saving ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />} Guardar</Button></div></form></DialogContent></Dialog>;
}
