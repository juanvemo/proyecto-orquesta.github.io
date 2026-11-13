import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, LockKeyhole, Pencil, Plus, Save, Shield, ShieldCheck, SlidersHorizontal, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { readOrgFeatureFlag, writeOrgFeatureFlag } from "@/lib/orgStore";
import { EXTRA_PERMISSION_CATALOG, resolveEffectiveExtraPermissions, type ExtraRolePermissionsMap } from "@/lib/permissions";

type Permission = { id: string; key: string; module: string; description: string; isVirtual?: boolean };
type Role = { id: string; name: string; code: string; description: string | null; is_system: boolean; permissions: string[]; extraKeys: string[] };

const roleMeta: Record<string, { icon: typeof Shield; color: string; scope: string }> = {
  ADMIN: { icon: ShieldCheck, color: "bg-violet-500/10 text-violet-600 dark:text-violet-400", scope: "Acceso total" },
  DIRECTOR: { icon: Shield, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", scope: "Artístico y operativo" },
  DIRECTOR_MUSICAL: { icon: Shield, color: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400", scope: "Dirección musical e instructor" },
  PRODUCTION_TECH: { icon: SlidersHorizontal, color: "bg-amber-500/10 text-amber-700 dark:text-amber-400", scope: "Rider, logística e inventario" },
  ADMINISTRATION: { icon: UsersRound, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", scope: "Comercial y financiero" },
  MUSICIAN: { icon: UsersRound, color: "bg-orange-500/10 text-orange-600 dark:text-orange-400", scope: "Portal personal" },
  VIEWER: { icon: Eye, color: "bg-slate-500/10 text-slate-600 dark:text-slate-300", scope: "Solo lectura" },
};

const moduleNames: Record<string, string> = {
  dashboard: "Dashboard",
  settings: "Organización",
  users: "Usuarios",
  roles: "Roles",
  musicians: "Músicos",
  rehearsals: "Ensayos y Evaluaciones",
  repertoire: "Repertorio",
  tasks: "Dirección Musical",
  clients: "Clientes",
  quotes: "Cotizaciones",
  contracts: "Contratos",
  events: "Eventos",
  technical: "Rider, Logística e Inventario",
  finances: "Finanzas",
  portal: "Portal personal",
  projects: "Proyectos y Objetivos",
  strategy: "Matriz DOFA y Brechas",
  reports: "Reportes",
  audit: "Auditoría",
};

export default function Roles() {
  const { membership, refreshAccess } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [extraMap, setExtraMap] = useState<ExtraRolePermissionsMap>({});
  const [loading, setLoading] = useState(true);
  const [creatingTech, setCreatingTech] = useState(false);
  const [editing, setEditing] = useState<Role | null | undefined>(undefined);

  const load = useCallback(async () => {
    if (!membership) return;
    setLoading(true);
    const [roleResult, permissionResult, storedExtra] = await Promise.all([
      supabase
        .from("roles")
        .select("id,name,code,description,is_system,role_permissions(permission:permissions(id,key))")
        .eq("organization_id", membership.organizationId)
        .order("created_at"),
      supabase.from("permissions").select("id,key,module,description").order("module").order("key"),
      readOrgFeatureFlag<ExtraRolePermissionsMap>(membership.organizationId, "extra_role_permissions", {}),
    ]);
    if (roleResult.error || permissionResult.error) {
      toast.error("No fue posible cargar roles y permisos");
      setLoading(false);
      return;
    }
    const dbPerms = (permissionResult.data ?? []) as Permission[];
    const existingKeys = new Set(dbPerms.map((p) => p.key));
    const virtualPerms: Permission[] = EXTRA_PERMISSION_CATALOG.filter((ep) => !existingKeys.has(ep.key)).map((ep) => ({
      id: `extra:${ep.key}`,
      key: ep.key,
      module: ep.module,
      description: ep.description,
      isVirtual: true,
    }));
    const allPerms = [...dbPerms, ...virtualPerms];
    setPermissions(allPerms);
    setExtraMap(storedExtra);

    const rows = (roleResult.data ?? []) as unknown as Array<{
      id: string;
      name: string;
      code: string;
      description: string | null;
      is_system: boolean;
      role_permissions: Array<{ permission: { id: string; key: string } | null }>;
    }>;

    setRoles(
      rows.map((row) => {
        const dbIds = row.role_permissions.flatMap((item) => (item.permission?.id ? [item.permission.id] : []));
        const dbKeySet = new Set(row.role_permissions.flatMap((item) => (item.permission?.key ? [item.permission.key] : [])));
        const resolvedExtras = resolveEffectiveExtraPermissions(row.code, storedExtra);
        const virtualIds = virtualPerms.filter((vp) => resolvedExtras.includes(vp.key) || dbKeySet.has(vp.key)).map((vp) => vp.id);
        return {
          id: row.id,
          name: row.name,
          code: row.code,
          description: row.description,
          is_system: row.is_system,
          permissions: Array.from(new Set([...dbIds, ...virtualIds])),
          extraKeys: resolvedExtras,
        };
      }),
    );
    setLoading(false);
  }, [membership]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasProductionTech = roles.some((r) => r.code === "PRODUCTION_TECH");

  const handleQuickCreateProductionTech = async () => {
    if (!membership) return;
    setCreatingTech(true);
    const defaultDbKeys = ["dashboard.view", "technical.manage", "events.manage", "repertoire.view", "rehearsals.view"];
    const selectedDbIds = permissions.filter((p) => !p.isVirtual && defaultDbKeys.includes(p.key)).map((p) => p.id);
    const { error } = await supabase.rpc("save_role_configuration", {
      target_organization_id: membership.organizationId,
      target_role_id: null,
      role_name: "Producción Técnica y Logística",
      role_code: "PRODUCTION_TECH",
      role_description: "Gestión de rider técnico, montaje, logística de eventos e inventario técnico.",
      selected_permission_ids: selectedDbIds,
    });
    if (error) {
      toast.error("No se pudo crear el rol Producción Técnica y Logística", { description: error.message });
      setCreatingTech(false);
      return;
    }
    const nextExtra: ExtraRolePermissionsMap = {
      ...extraMap,
      PRODUCTION_TECH: ["inventory.view", "inventory.manage"],
    };
    await writeOrgFeatureFlag(membership.organizationId, "extra_role_permissions", nextExtra);
    setCreatingTech(false);
    toast.success("Rol Producción Técnica y Logística creado");
    await load();
    await refreshAccess();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Control de acceso</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Roles y permisos</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Crea roles y decide exactamente qué módulos —incluidos Proyectos, Matriz DOFA, Contratos e Inventario— puede consultar o administrar cada equipo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!loading && !hasProductionTech && (
            <Button variant="outline" disabled={creatingTech} onClick={handleQuickCreateProductionTech} className="h-11 rounded-xl font-bold">
              <SlidersHorizontal className="mr-2 size-4" />
              {creatingTech ? "Creando..." : "Activar rol Producción Técnica"}
            </Button>
          )}
          <Button onClick={() => setEditing(null)} className="h-11 rounded-xl font-bold">
            <Plus className="mr-2 size-4" />
            Crear rol
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading
          ? [1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-72 rounded-3xl" />)
          : roles.map((role) => {
              const meta = roleMeta[role.code] ?? { icon: Shield, color: "bg-cyan-500/10 text-cyan-700", scope: "Rol personalizado" };
              return (
                <Card key={role.id} className="rounded-[1.75rem] shadow-none">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <span className={`grid size-12 place-items-center rounded-2xl ${meta.color}`}>
                        <meta.icon className="size-5" />
                      </span>
                      <Badge variant="outline" className="rounded-lg text-[10px]">
                        {role.is_system ? "SISTEMA" : "PERSONALIZADO"}
                      </Badge>
                    </div>
                    <h2 className="mt-5 text-xl font-black">{role.name}</h2>
                    <p className="mt-1 min-h-10 text-sm text-muted-foreground">{role.description || "Sin descripción"}</p>
                    <Badge className={`mt-4 rounded-lg ${meta.color}`}>{meta.scope}</Badge>
                    <div className="mt-5 border-t pt-4">
                      <p className="text-xs font-bold text-muted-foreground">{role.permissions.length} permisos asignados</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {role.permissions.slice(0, 5).map((id) => (
                          <span key={id} className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-semibold">
                            <Check className="size-3 text-emerald-600" />
                            {permissions.find((item) => item.id === id)?.description ?? id.replace("extra:", "")}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Button variant="outline" disabled={role.code === "ADMIN"} onClick={() => setEditing(role)} className="mt-5 w-full rounded-xl">
                      <Pencil className="mr-2 size-4" />
                      {role.code === "ADMIN" ? "Rol protegido" : "Editar acceso"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
        <LockKeyhole className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-bold">Administrador protegido</p>
          <p className="mt-1 text-xs text-muted-foreground">
            El rol Administrador conserva acceso total para evitar que la organización quede sin administración. Módulos como Proyectos pueden habilitarse manualmente en cualquier otro rol desde aquí.
          </p>
        </div>
      </div>

      {membership && (
        <RoleDialog
          open={editing !== undefined}
          role={editing ?? null}
          permissions={permissions}
          extraMap={extraMap}
          organizationId={membership.organizationId}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            void load();
            void refreshAccess();
          }}
        />
      )}
    </div>
  );
}

function RoleDialog({
  open,
  role,
  permissions,
  extraMap,
  organizationId,
  onClose,
  onSaved,
}: {
  open: boolean;
  role: Role | null;
  permissions: Permission[];
  extraMap: ExtraRolePermissionsMap;
  organizationId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(role?.name ?? "");
      setCode(role?.code ?? "");
      setDescription(role?.description ?? "");
      setSelected(role?.permissions ?? []);
    }
  }, [open, role]);

  const grouped = useMemo(
    () =>
      Object.entries(
        permissions.reduce<Record<string, Permission[]>>((groups, item) => ({ ...groups, [item.module]: [...(groups[item.module] ?? []), item] }), {}),
      ),
    [permissions],
  );

  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const targetCode = (role?.code || code).trim().toUpperCase();
    if (!name.trim() || (!role && !targetCode)) {
      toast.error("Nombre y código son obligatorios");
      return;
    }
    setSaving(true);
    const dbPermissionIds = selected.filter((id) => !id.startsWith("extra:"));
    const extraKeys = permissions.filter((p) => selected.includes(p.id) && EXTRA_PERMISSION_CATALOG.some((ep) => ep.key === p.key)).map((p) => p.key);

    const { error } = await supabase.rpc("save_role_configuration", {
      target_organization_id: organizationId,
      target_role_id: role?.id ?? null,
      role_name: name,
      role_code: targetCode,
      role_description: description,
      selected_permission_ids: dbPermissionIds,
    });

    if (error) {
      setSaving(false);
      toast.error("No se pudo guardar el rol", { description: error.message });
      return;
    }

    try {
      await writeOrgFeatureFlag(organizationId, "extra_role_permissions", {
        ...extraMap,
        [targetCode]: extraKeys,
      });
    } catch {
      // Non-blocking fallback save
    }

    setSaving(false);
    toast.success(role ? "Accesos actualizados" : "Rol creado");
    onClose();
    onSaved();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[2rem] sm:max-w-3xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black">{role ? `Configurar ${role.name}` : "Crear rol personalizado"}</DialogTitle>
            <DialogDescription>Los cambios se aplican a todos los usuarios que tengan este rol.</DialogDescription>
          </DialogHeader>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (!role) setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, "_"));
                }}
                className="mt-2 rounded-xl"
              />
            </div>
            <div>
              <Label>Código *</Label>
              <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} disabled={Boolean(role)} className="mt-2 rounded-xl" />
            </div>
            <div className="sm:col-span-2">
              <Label>Descripción</Label>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 rounded-xl" />
            </div>
          </div>
          <div className="mt-6">
            <p className="font-black">Permisos del rol</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {grouped.map(([module, items]) => (
                <section key={module} className="rounded-2xl border p-4">
                  <p className="mb-3 text-xs font-black uppercase tracking-wider text-primary">{moduleNames[module] ?? module}</p>
                  <div className="space-y-3">
                    {(items ?? []).map((permission) => (
                      <label key={permission.id} className="flex cursor-pointer items-start gap-3">
                        <Checkbox checked={selected.includes(permission.id)} onCheckedChange={() => toggle(permission.id)} />
                        <span>
                          <span className="block text-sm font-bold">{permission.description}</span>
                          <span className="text-[10px] text-muted-foreground">{permission.key}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
          <div className="sticky bottom-0 mt-6 flex justify-end gap-3 border-t bg-background/95 pt-4 backdrop-blur">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              Cancelar
            </Button>
            <Button disabled={saving} className="rounded-xl font-bold">
              <Save className="mr-2 size-4" />
              {saving ? "Guardando…" : "Guardar acceso"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
