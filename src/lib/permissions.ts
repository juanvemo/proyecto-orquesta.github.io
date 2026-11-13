export interface ExtraPermissionDef {
  key: string;
  module: string;
  description: string;
  defaultRoles: string[];
}

export const EXTRA_PERMISSION_CATALOG: ExtraPermissionDef[] = [
  { key: "projects.view", module: "projects", description: "Ver proyectos y objetivos", defaultRoles: ["ADMIN"] },
  { key: "projects.manage", module: "projects", description: "Crear y gestionar proyectos, tareas y comentarios", defaultRoles: ["ADMIN"] },
  { key: "swot.view", module: "strategy", description: "Consultar Matriz DOFA y análisis de brechas", defaultRoles: ["ADMIN", "DIRECTOR", "DIRECTOR_MUSICAL"] },
  { key: "swot.manage", module: "strategy", description: "Editar Matriz DOFA y planes de acción", defaultRoles: ["ADMIN", "DIRECTOR"] },
  { key: "contracts.manage", module: "contracts", description: "Generar y administrar contratos con firma", defaultRoles: ["ADMIN", "ADMINISTRATION", "DIRECTOR"] },
  { key: "inventory.view", module: "technical", description: "Consultar inventario técnico y reservas", defaultRoles: ["ADMIN", "DIRECTOR", "PRODUCTION_TECH", "ADMINISTRATION"] },
  { key: "inventory.manage", module: "technical", description: "Administrar inventario técnico y reservas", defaultRoles: ["ADMIN", "PRODUCTION_TECH"] },
  { key: "evaluations.manage", module: "rehearsals", description: "Evaluar ensayos y músicos con semáforo", defaultRoles: ["ADMIN", "DIRECTOR", "DIRECTOR_MUSICAL"] },
];

export type ExtraRolePermissionsMap = Record<string, string[]>;

export function resolveEffectiveExtraPermissions(
  roleCode: string | null | undefined,
  extraMap: ExtraRolePermissionsMap | null | undefined,
): string[] {
  if (!roleCode) return [];
  if (roleCode === "ADMIN") {
    return EXTRA_PERMISSION_CATALOG.map((item) => item.key);
  }
  if (extraMap && Array.isArray(extraMap[roleCode])) {
    return extraMap[roleCode];
  }
  return EXTRA_PERMISSION_CATALOG.filter((item) => item.defaultRoles.includes(roleCode)).map((item) => item.key);
}
