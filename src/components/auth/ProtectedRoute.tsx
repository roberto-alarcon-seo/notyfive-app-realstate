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
  const { user, isLoading, isSuperAdmin, tenantRole, profile } = useAuth();
  const { isSupportMode } = useSupportMode();
  const location = useLocation();

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
  // Super admins bypass this check
  if (
    !isSuperAdmin &&
    (profile.status === 'inactive' || profile.first_login_required || !profile.password_set_at)
  ) {
    return <Navigate to="/auth/complete-signup" replace />;
  }

  // Requires super admin
  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  // Super admin should always be redirected to /admin/tenants (unless already in /admin/* or in support mode)
  if (
    isSuperAdmin &&
    !requireSuperAdmin &&
    !isSupportMode &&
    !location.pathname.startsWith('/admin')
  ) {
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
