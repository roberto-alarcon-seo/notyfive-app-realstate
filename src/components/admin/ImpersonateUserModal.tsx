import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { extractEdgeFunctionError } from '@/lib/edgeFunctionError';

interface ImpersonateUserModalProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName: string;
}

interface TenantUserRow {
  id: string;
  name: string | null;
  email: string;
  tenant_role: string | null;
}

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  administrador: 'Administrador',
  manager: 'Manager',
  marketer: 'Marketer',
  asesor: 'Asesor',
};

function roleBadgeClass(role: string | null): string {
  switch (role) {
    case 'owner':
    case 'administrador':
      return 'bg-primary/15 text-primary border-primary/30';
    case 'manager':
      return 'bg-blue-500/15 text-blue-500 border-blue-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function getInitials(name: string | null, email: string): string {
  const base = (name && name.trim()) || email;
  const parts = base.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

export function ImpersonateUserModal({
  open,
  onClose,
  tenantId,
  tenantName,
}: ImpersonateUserModalProps) {
  const { user, profile } = useAuth();
  const [users, setUsers] = useState<TenantUserRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, name, email, is_active_for_assignment')
          .eq('tenant_id', tenantId)
          .eq('is_active_for_assignment', true)
          .order('name', { ascending: true });
        if (error) throw error;

        const ids = (profiles ?? []).map((p) => p.id);
        let rolesById: Record<string, string | null> = {};
        if (ids.length > 0) {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('user_id, tenant_role')
            .in('user_id', ids);
          rolesById = Object.fromEntries(
            (roles ?? []).map((r) => [r.user_id as string, (r.tenant_role as string | null) ?? null]),
          );
        }

        if (cancelled) return;
        setUsers(
          (profiles ?? []).map((p) => ({
            id: p.id as string,
            name: (p.name as string | null) ?? null,
            email: p.email as string,
            tenant_role: rolesById[p.id as string] ?? null,
          })),
        );
      } catch (err) {
        console.error('Error loading tenant users:', err);
        toast.error('No se pudieron cargar los usuarios del tenant');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchUsers();
    return () => {
      cancelled = true;
    };
  }, [open, tenantId]);

  const handleConnect = async (target: TenantUserRow) => {
    setConnectingId(target.id);
    try {
      // Save super admin origin so the banner can offer a "return" action
      try {
        sessionStorage.setItem(
          'noty5_admin_origin',
          JSON.stringify({
            email: user?.email ?? null,
            name: profile?.name ?? user?.email ?? null,
            returnPath: `/admin/tenants/${tenantId}`,
            tenantName,
            targetName: target.name ?? target.email,
            targetEmail: target.email,
          }),
        );
      } catch {
        /* ignore storage errors */
      }

      const { data, error } = await supabase.functions.invoke(
        'admin-impersonate-sso',
        { body: { tenant_id: tenantId, target_user_id: target.id } },
      );
      if (error) {
        const detail = await extractEdgeFunctionError(
          error,
          'No se pudo generar el acceso SSO.',
        );
        toast.error('Error al iniciar impersonación', { description: detail });
        return;
      }
      if (!data?.sso_path) {
        const detail = (data as { error?: string } | null)?.error
          ?? 'No se pudo generar el acceso SSO.';
        toast.error('Error al iniciar impersonación', { description: detail });
        return;
      }

      sessionStorage.setItem('noty5_admin_impersonation', '1');
      toast.success(`Accediendo como ${data.target_email ?? target.email}`);
      window.location.assign(data.sso_path as string);
    } catch (err) {
      console.error(err);
      const detail = await extractEdgeFunctionError(
        err,
        'Error inesperado al generar SSO',
      );
      toast.error('Error al iniciar impersonación', { description: detail });
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border space-y-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Acceder como tenant
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Selecciona el usuario con el que quieres iniciar sesión en{' '}
                <span className="font-medium text-foreground">{tenantName}</span>
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="shrink-0 -mt-1 -mr-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay usuarios activos en este tenant.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {users.map((u) => {
                const isConnecting = connectingId === u.id;
                const isDisabled = connectingId !== null;
                return (
                  <li
                    key={u.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                        {getInitials(u.name, u.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {u.name?.trim() || u.email}
                        </p>
                        {u.tenant_role && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 h-4 font-medium ${roleBadgeClass(u.tenant_role)}`}
                          >
                            {roleLabels[u.tenant_role] ?? u.tenant_role}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.email}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isDisabled}
                      onClick={() => handleConnect(u)}
                      className="shrink-0 gap-1.5"
                    >
                      {isConnecting && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                      {isConnecting ? 'Conectando…' : 'Conectar'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-6 py-3 border-t border-border bg-muted/30 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          <span>Esta sesión quedará registrada en los logs de seguridad.</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}