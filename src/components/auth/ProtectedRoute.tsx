import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, TenantRole } from '@/contexts/AuthContext';
import { useSupportMode } from '@/contexts/SupportModeContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
  requireRoles?: TenantRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireSuperAdmin = false,
  requireRoles,
}) => {
  const { user, isLoading, isSuperAdmin, tenantRole, profile, partnerScope } = useAuth();
  const { isSupportMode } = useSupportMode();
  const location = useLocation();
  const isAdminImpersonation = typeof window !== 'undefined' && sessionStorage.getItem('noty5_admin_impersonation') === '1';
  // Users provisioned via SSO never need to complete a manual signup or set a password.
  const userMeta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const isSsoUser = userMeta.sso_user === true || userMeta.provisioned_via === 'sso';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!user || isSuperAdmin) {
      sessionStorage.removeItem('noty5_admin_impersonation');
    }
  }, [user, isSuperAdmin]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    // Super admin pages send unauthenticated users to the admin login.
    // All other (tenant) routes show the public landing instructing the user
    // to enter via SSO from the master Core platform.
    if (requireSuperAdmin) {
      return <Navigate to="/rs_admin" replace />;
    }
    return <Navigate to="/welcome" replace />;
  }

  // User is authenticated but doesn't have a profile yet (shouldn't happen but just in case)
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Configurando perfil...</p>
        </div>
      </div>
    );
  }

  // Check if user needs to complete signup (inactive status, first_login_required, or no password set yet)
  // Super admins and SSO-provisioned users bypass this check
  if (
    !isSuperAdmin &&
    !isAdminImpersonation &&
    !isSsoUser &&
    (profile.status === 'inactive' || profile.first_login_required || !profile.password_set_at)
  ) {
    return <Navigate to="/auth/complete-signup" replace />;
  }

  // Requires super admin
  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  // Global admin routes (/admin/*) are reserved for global super admins
  // WITHOUT a partner_scope. Partner-scoped admins must use their own
  // partner dashboard and tenant management. They cannot access
  // cross-tenant global tools (global users, system logs, etc.).
  if (requireSuperAdmin && isSuperAdmin && partnerScope) {
    // Routes a partner-scoped super admin is allowed to access.
    // Includes /admin/tenants and any sub-route (e.g. tenant detail),
    // plus their partner-specific settings page.
    const partnerAllowedPrefixes = ['/admin/tenants', '/admin/partner-settings', '/admin/super-wallet'];
    const isAllowed = partnerAllowedPrefixes.some(
      (prefix) =>
        location.pathname === prefix || location.pathname.startsWith(prefix + '/'),
    );
    if (!isAllowed) {
      // Tenant management is the operational priority for partner admins,
      // so unauthorized admin routes (logs, global users) land them there.
      return <Navigate to="/admin/tenants" replace />;
    }
  }

  // Super admin should always be redirected to /admin/tenants (unless already in /admin/* or in support mode)
  if (
    isSuperAdmin &&
    !requireSuperAdmin &&
    !isSupportMode &&
    !location.pathname.startsWith('/admin')
  ) {
    // Both global super admins and partner-scoped admins land on the
    // tenants list. Partner-scoped admins see only their own tenants
    // (filtered by RLS + the explicit partner_id filter in AdminTenants).
    return <Navigate to="/admin/tenants" replace />;
  }

  // For super admin on /admin route, allow access
  if (isSuperAdmin && requireSuperAdmin) {
    return <>{children}</>;
  }

  // Check tenant roles
  if (requireRoles && requireRoles.length > 0) {
    // Super admin passes all role checks
    if (isSuperAdmin) {
      return <>{children}</>;
    }

    // Check if user has required tenant role
    if (!tenantRole || !requireRoles.includes(tenantRole)) {
      return <Navigate to="/" replace />;
    }
  }

  // For settings routes, only administrador can access (checked separately in routes)

  // Normal user must have a tenant
  if (!isSuperAdmin && !profile.tenant_id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground mb-2">Sin acceso</h1>
          <p className="text-muted-foreground">Tu cuenta no está asociada a ninguna empresa.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
