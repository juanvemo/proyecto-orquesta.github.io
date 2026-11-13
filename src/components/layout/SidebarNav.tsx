import { NavLink } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { navigationGroups } from "@/config/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { hasPermission, membership } = useAuth();
  const roleCode = membership?.roleCode ?? null;

  return (
    <nav className="space-y-6 px-3 pb-6">
      {navigationGroups.map((group) => {
        const visibleItems = group.items.filter((item) => {
          if (item.excludeRoles && roleCode && item.excludeRoles.includes(roleCode)) return false;
          if (item.permission && !hasPermission(item.permission)) return false;
          if (item.anyPermission && !item.anyPermission.some(hasPermission)) return false;
          return true;
        });
        if (!visibleItems.length) return null;
        return (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/45">{group.label}</p>
            <div className="space-y-1">
              {visibleItems.map((item) => (
                <NavLink key={item.path} to={item.path} onClick={onNavigate} className={({ isActive }) => cn("group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all", isActive ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")}>
                  <item.icon className="size-[18px]" /><span className="flex-1">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
      <div className="mx-1 rounded-2xl border border-primary/15 bg-primary/5 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-primary">
            {roleCode === "DIRECTOR_MUSICAL" ? "Dirección Musical" : roleCode === "PRODUCTION_TECH" ? "Producción y Logística" : "Portal del músico"}
          </p>
          <Badge variant="outline" className="rounded-lg border-primary/20 text-[9px] text-primary">ACTIVO</Badge>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          {roleCode === "DIRECTOR_MUSICAL"
            ? "Gestión musical, planificación de ensayos, repertorio y evaluación por semáforo."
            : roleCode === "PRODUCTION_TECH"
              ? "Rider técnico, logística operativa e inventario de equipos para eventos."
              : "Perfil, disponibilidad, ensayos, eventos y aportes en un acceso personal."}
        </p>
      </div>
    </nav>
  );
}
