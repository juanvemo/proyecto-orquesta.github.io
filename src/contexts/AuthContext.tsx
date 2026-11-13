import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { hexContrastForeground, hexToHslValue } from "@/lib/color";
import type { AppUser, Membership, OrganizationIdentity, RoleCode } from "@/types/auth";

type PermissionValue = { key: string } | { key: string }[] | null;
type RolePermissionRow = { permission: PermissionValue };
type RoleRow = { code: RoleCode; name: string; role_permissions: RolePermissionRow[] };
type OrganizationRow = { id: string; name: string; logo_url: string | null; cover_url: string | null; primary_color: string; currency_code: string; timezone: string };
type MembershipRow = {
  id: string;
  organization_id: string;
  approval_status: Membership["approvalStatus"];
  role_id: string;
  role: RoleRow | RoleRow[] | null;
  organization: OrganizationRow | OrganizationRow[] | null;
};

interface AuthContextValue {
  session: Session | null;
  user: AppUser | null;
  membership: Membership | null;
  organization: OrganizationIdentity | null;
  loading: boolean;
  error: string | null;
  isApproved: boolean;
  hasPermission: (permission: string) => boolean;
  refreshAccess: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [organization, setOrganization] = useState<OrganizationIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAccess = useCallback(async (activeSession: Session | null) => {
    setSession(activeSession);
    setError(null);

    if (!activeSession?.user) {
      setUser(null);
      setMembership(null);
      setOrganization(null);
      setLoading(false);
      return;
    }

    const [profileResult, membershipResult] = await Promise.all([
      supabase.from("profiles").select("first_name,last_name,avatar_url,email,username,profile_completed_at").eq("id", activeSession.user.id).maybeSingle(),
      supabase
        .from("organization_memberships")
        .select("id,organization_id,approval_status,role_id,role:roles(code,name,role_permissions(permission:permissions(key))),organization:organizations(id,name,logo_url,cover_url,primary_color,currency_code,timezone)")
        .eq("user_id", activeSession.user.id)
        .maybeSingle(),
    ]);

    if (profileResult.error || membershipResult.error) {
      setError(profileResult.error?.message ?? membershipResult.error?.message ?? "No fue posible validar el acceso.");
    }

    const profile = profileResult.data;
    setUser({
      id: activeSession.user.id,
      email: profile?.email ?? activeSession.user.email ?? "",
      username: profile?.username ?? null,
      firstName: profile?.first_name ?? activeSession.user.user_metadata?.first_name ?? "Usuario",
      lastName: profile?.last_name ?? activeSession.user.user_metadata?.last_name ?? "",
      avatarUrl: profile?.avatar_url,
      profileComplete: Boolean(profile?.profile_completed_at),
    });

    const rawMembership = membershipResult.data as unknown as MembershipRow | null;
    if (!rawMembership) {
      setMembership(null);
      setOrganization(null);
      setLoading(false);
      return;
    }

    const rawRole = Array.isArray(rawMembership.role) ? rawMembership.role[0] : rawMembership.role;
    const rawOrganization = Array.isArray(rawMembership.organization) ? rawMembership.organization[0] : rawMembership.organization;
    const permissions = rawRole?.role_permissions.flatMap((item) => {
      const permission = Array.isArray(item.permission) ? item.permission[0] : item.permission;
      return permission?.key ? [permission.key] : [];
    }) ?? [];
    setMembership({
      id: rawMembership.id,
      organizationId: rawMembership.organization_id,
      approvalStatus: rawMembership.approval_status,
      roleId: rawMembership.role_id,
      roleCode: rawRole?.code ?? null,
      roleName: rawRole?.name ?? null,
      permissions,
    });
    setOrganization(rawOrganization ? {
      id: rawOrganization.id,
      name: rawOrganization.name,
      logoUrl: rawOrganization.logo_url,
      coverUrl: rawOrganization.cover_url,
      primaryColor: rawOrganization.primary_color,
      currencyCode: rawOrganization.currency_code,
      timezone: rawOrganization.timezone,
    } : null);
    const primaryHsl = rawOrganization?.primary_color ? hexToHslValue(rawOrganization.primary_color) : null;
    if (primaryHsl && rawOrganization) {
      document.documentElement.style.setProperty("--primary", primaryHsl);
      document.documentElement.style.setProperty("--primary-foreground", hexContrastForeground(rawOrganization.primary_color));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) setError(sessionError.message);
      void loadAccess(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setTimeout(() => void loadAccess(nextSession), 0);
    });

    return () => data.subscription.unsubscribe();
  }, [loadAccess]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user,
    membership,
    organization,
    loading,
    error,
    isApproved: membership?.approvalStatus === "APPROVED",
    hasPermission: (permission) => membership?.permissions.includes(permission) ?? false,
    refreshAccess: () => loadAccess(session),
    signOut: async () => {
      setError(null);
      await supabase.auth.signOut();
    },
  }), [session, user, membership, organization, loading, error, loadAccess]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe utilizarse dentro de AuthProvider");
  return context;
}
