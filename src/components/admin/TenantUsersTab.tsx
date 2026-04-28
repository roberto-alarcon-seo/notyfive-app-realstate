import { useEffect, useState } from 'react';
import { Loader2, Lock, ShieldCheck, UserRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

interface TenantUsersTabProps {
  tenantId: string;
  managedExternally?: boolean;
}

interface ProfileRow {
  id: string;
  name: string;
  email: string;
  status: string;
  first_login_required: boolean;
  last_login_at: string | null;
  created_at: string;
  tenant_role: string | null;
  global_role: string | null;
  provisioned_via: string | null;
}

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  administrador: 'Administrador',
  manager: 'Manager',
  marketer: 'Marketer',
  asesor: 'Asesor',
};

export function TenantUsersTab({ tenantId, managedExternally }: TenantUsersTabProps) {
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, name, email, status, first_login_required, last_login_at, created_at, provisioned_via')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: true });
        if (error) throw error;

        const ids = (profiles ?? []).map((p) => p.id);
        let rolesById: Record<string, { tenant_role: string | null; global_role: string | null }> = {};
        if (ids.length > 0) {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('user_id, tenant_role, global_role')
            .in('user_id', ids);
          rolesById = Object.fromEntries(
            (roles ?? []).map((r: any) => [r.user_id, { tenant_role: r.tenant_role, global_role: r.global_role }]),
          );
        }

        setUsers(
          (profiles ?? []).map((p: any) => ({
            ...p,
            tenant_role: rolesById[p.id]?.tenant_role ?? null,
            global_role: rolesById[p.id]?.global_role ?? null,
          })),
        );
      } catch (err) {
        console.error('Error loading tenant users:', err);
        toast.error('No se pudo cargar los usuarios del tenant');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, [tenantId]);

  return (
    <div className="space-y-6">
      {managedExternally && (
        <div className="rounded-lg border border-accent/40 bg-accent/10 p-4 flex items-start gap-3">
          <Lock className="h-4 w-4 text-accent mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Usuarios sincronizados por el Core</p>
            <p className="text-muted-foreground">
              Las altas, bajas y roles de los usuarios son dictados por el sistema externo. Esta vista es de solo lectura.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <UserRound className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Este tenant aún no tiene usuarios.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead>Origen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const roleLabel = u.tenant_role
                  ? roleLabels[u.tenant_role] ?? u.tenant_role
                  : '—';
                const isSuperAdmin = u.global_role === 'super_admin';
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-foreground truncate max-w-[240px]">
                          {u.name || '(sin nombre)'}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">{u.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="capitalize">
                          {roleLabel}
                        </Badge>
                        {isSuperAdmin && (
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase tracking-wider border-primary text-primary bg-primary/10 gap-1"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            Super Admin
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={u.status === 'active' ? 'secondary' : 'outline'}
                        className="capitalize"
                      >
                        {u.status === 'active' ? 'Activo' : u.status}
                      </Badge>
                      {u.first_login_required && u.provisioned_via !== 'sso' && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-warning">
                          Pendiente activación
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.last_login_at
                        ? new Date(u.last_login_at).toLocaleDateString('es-MX')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {managedExternally ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase tracking-wider border-accent text-accent bg-accent/10 gap-1"
                        >
                          <Lock className="h-3 w-3" />
                          Solo lectura
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase tracking-wider text-muted-foreground"
                        >
                          Local
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}