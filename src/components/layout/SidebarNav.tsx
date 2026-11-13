import { NavLink } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { navigationGroups } from "@/config/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { hasPermission } = useAuth();

  return (
    <nav className="space-y-6 px-3 pb-6">
      {navigationGroups.map((group) => {
        const visibleItems = group.items.filter((item) => (!item.permission || hasPermission(item.permission)) && (!item.anyPermission || item.anyPermission.some(hasPermission)));
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
        <div className="flex items-center justify-between"><p className="text-xs font-bold text-primary">Portal del músico</p><Badge variant="outline" className="rounded-lg border-primary/20 text-[9px] text-primary">ACTIVO</Badge></div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">Perfil, disponibilidad, ensayos, tareas y aportes en un acceso personal.</p>
      </div>
    </nav>
  );
}
