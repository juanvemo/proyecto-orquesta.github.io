import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute() {
  const { session, user, membership, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <LoaderCircle className="size-7 animate-spin" />
          </div>
          <div>
            <p className="font-semibold">Afinando tu espacio de trabajo</p>
            <p className="text-sm text-muted-foreground">Validando organización y permisos…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!membership || membership.approvalStatus !== "APPROVED") return <Navigate to="/acceso-pendiente" replace />;
  if (user && !user.profileComplete && location.pathname !== "/completar-perfil") return <Navigate to="/completar-perfil" replace />;
  return <Outlet />;
}

export function PermissionRoute({ permission }: { permission: string }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function AnyPermissionRoute({ permissions }: { permissions: string[] }) {
  const { hasPermission } = useAuth();
  if (!permissions.some(hasPermission)) return <Navigate to="/" replace />;
  return <Outlet />;
}
