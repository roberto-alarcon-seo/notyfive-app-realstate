import { useState, useEffect } from 'react';
import { Plus, Loader2, Search, MoreHorizontal, Shield, User as UserIcon, Trash2, Mail, Lock, Eye, EyeOff, Sparkles } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SuperAdminRow {
  id: string;
  email: string;
  name: string | null;
  status: string;
  created_at: string;
  last_login_at: string | null;
  partner_scope: string | null;
  partner_name: string | null;
}

interface TenantUserRow {
  id: string;
  email: string;
  name: string | null;
  status: string;
  tenant_id: string | null;
  tenant_name: string | null;
  tenant_managed_externally: boolean;
  tenant_partner_id: string | null;
  global_role: string;
  tenant_role: string | null;
  created_at: string;
  last_login_at: string | null;
}

interface PartnerOption {
  id: string;
  name: string;
}

const inviteSchema = z.object({
  name: z.string().trim().min(2, 'Nombre muy corto').max(100),
  email: z.string().trim().email('Email inválido'),
  partnerScope: z.string().min(1, 'Selecciona un partner'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72, 'Máximo 72 caracteres'),
});

const AdminUsers = () => {
  const { user: currentUser, partnerScope: currentPartnerScope } = useAuth();
  const [tab, setTab] = useState<'super_admins' | 'all_users'>('super_admins');

  // Super admins state
  const [superAdmins, setSuperAdmins] = useState<SuperAdminRow[]>([]);
  const [loadingSA, setLoadingSA] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', partnerScope: 'global', password: '' });
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [saToDelete, setSaToDelete] = useState<SuperAdminRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // All users state
  const [allUsers, setAllUsers] = useState<TenantUserRow[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const [searchAll, setSearchAll] = useState('');

  // Partners catalog
  const [partners, setPartners] = useState<PartnerOption[]>([]);

  const fetchPartners = async () => {
    const { data } = await (supabase as any).from('partners').select('id, name').order('name');
    setPartners(data || []);
  };

  const fetchSuperAdmins = async () => {
    setLoadingSA(true);
    try {
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, partner_scope' as any)
        .eq('global_role', 'super_admin');
      if (rolesError) throw rolesError;
      const rolesArr = (roles || []) as unknown as Array<{ user_id: string; partner_scope: string | null }>;
      const ids = rolesArr.map((r) => r.user_id);
      const scopeMap = rolesArr.reduce((acc, r) => {
        acc[r.user_id] = r.partner_scope;
        return acc;
      }, {} as Record<string, string | null>);
      if (ids.length === 0) {
        setSuperAdmins([]);
        return;
      }
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, name, status, created_at, last_login_at')
        .in('id', ids)
        .order('created_at', { ascending: false });
      if (profilesError) throw profilesError;
      const { data: partnersData } = await (supabase as any).from('partners').select('id, name');
      const partnerNameMap = (partnersData || []).reduce((acc: Record<string, string>, p: any) => {
        acc[p.id] = p.name;
        return acc;
      }, {});
      const enriched: SuperAdminRow[] = (profiles || []).map((p: any) => {
        const scope = scopeMap[p.id] ?? null;
        return {
          ...p,
          partner_scope: scope,
          partner_name: scope ? partnerNameMap[scope] ?? scope : null,
        };
      });
      // If current super admin has a partner scope, only show admins of same partner + globals
      const filtered = currentPartnerScope
        ? enriched.filter((sa) => sa.partner_scope === currentPartnerScope || sa.partner_scope === null)
        : enriched;
      setSuperAdmins(filtered);
    } catch (e: any) {
      console.error(e);
      toast.error('Error al cargar super admins');
    } finally {
      setLoadingSA(false);
    }
  };

  const fetchAllUsers = async () => {
    setLoadingAll(true);
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, name, status, tenant_id, created_at, last_login_at, tenants(name, managed_externally, partner_id)' as any)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;

      const ids = (profiles || []).map((p: any) => p.id);
      let rolesMap: Record<string, { global_role: string; tenant_role: string | null }> = {};
      if (ids.length > 0) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id, global_role, tenant_role')
          .in('user_id', ids);
        rolesMap = (roles || []).reduce((acc, r: any) => {
          acc[r.user_id] = { global_role: r.global_role, tenant_role: r.tenant_role };
          return acc;
        }, {} as Record<string, { global_role: string; tenant_role: string | null }>);
      }

      const rows: TenantUserRow[] = (profiles || []).map((p: any) => ({
        id: p.id,
        email: p.email,
        name: p.name,
        status: p.status,
        tenant_id: p.tenant_id,
        tenant_name: p.tenants?.name ?? null,
        tenant_managed_externally: Boolean(p.tenants?.managed_externally),
        tenant_partner_id: p.tenants?.partner_id ?? null,
        global_role: rolesMap[p.id]?.global_role ?? 'user',
        tenant_role: rolesMap[p.id]?.tenant_role ?? null,
        created_at: p.created_at,
        last_login_at: p.last_login_at,
      }));
      // If current super admin has partner_scope, filter to that partner's tenants only
      const filtered = currentPartnerScope
        ? rows.filter((r) => r.tenant_partner_id === currentPartnerScope)
        : rows;
      setAllUsers(filtered);
    } catch (e: any) {
      console.error(e);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoadingAll(false);
    }
  };

  useEffect(() => {
    fetchPartners();
    fetchSuperAdmins();
    fetchAllUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPartnerScope]);

  const handleInviteSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteErrors({});
    const result = inviteSchema.safeParse(inviteForm);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        errs[err.path[0] as string] = err.message;
      });
      setInviteErrors(errs);
      return;
    }

    setIsInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-invite-super-admin', {
        body: {
          email: inviteForm.email,
          name: inviteForm.name,
          partnerScope: inviteForm.partnerScope === 'global' ? null : inviteForm.partnerScope,
          password: inviteForm.password,
        },
      });
      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Error al crear super admin');
      }
      toast.success('Super Admin creado. Ya puede acceder a /rs_admin');
      setInviteOpen(false);
      setInviteForm({ name: '', email: '', partnerScope: 'global', password: '' });
      setShowPassword(false);
      fetchSuperAdmins();
      fetchAllUsers();
    } catch (err: any) {
      toast.error(err.message || 'Error al crear super admin');
    } finally {
      setIsInviting(false);
    }
  };

  const generateRandomPassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%^&*';
    const all = upper + lower + digits + symbols;
    const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
    let pw = pick(upper) + pick(lower) + pick(digits) + pick(symbols);
    for (let i = 0; i < 12; i++) pw += pick(all);
    pw = pw.split('').sort(() => Math.random() - 0.5).join('');
    setInviteForm((f) => ({ ...f, password: pw }));
    setShowPassword(true);
  };

  const handleDeleteSuperAdmin = async () => {
    if (!saToDelete) return;
    if (saToDelete.id === currentUser?.id) {
      toast.error('No puedes eliminar tu propia cuenta');
      return;
    }
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-invite-super-admin', {
        body: { action: 'delete', userId: saToDelete.id },
      });
      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Error al eliminar');
      }
      toast.success('Super admin eliminado');
      setSaToDelete(null);
      fetchSuperAdmins();
      fetchAllUsers();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredAll = allUsers.filter((u) => {
    const q = searchAll.toLowerCase();
    return (
      !q ||
      u.email.toLowerCase().includes(q) ||
      (u.name || '').toLowerCase().includes(q) ||
      (u.tenant_name || '').toLowerCase().includes(q)
    );
  });

  // A user falls outside the current admin's scope when the logged super admin
  // has a partner_scope but the row belongs to a different partner. Global
  // super admins (no scope) can act on everyone.
  const isOutsideScope = (u: { tenant_partner_id: string | null; global_role: string }) => {
    if (!currentPartnerScope) return false;
    if (u.global_role === 'super_admin') return true; // partner admins never touch other super admins
    return u.tenant_partner_id !== currentPartnerScope;
  };

  const getRoleLabel = (u: TenantUserRow) => {
    if (u.global_role === 'super_admin') return 'Super Admin';
    return u.tenant_role || 'Usuario';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">Activo</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactivo</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Suspendido</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const headerActions =
    tab === 'super_admins' ? (
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogTrigger asChild>
          <Button className="gradient-primary">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Super Admin
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Super Admin</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInviteSuperAdmin} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre completo</label>
              <Input
                value={inviteForm.name}
                onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                placeholder="Nombre del administrador"
                disabled={isInviting}
              />
              {inviteErrors.name && <p className="text-xs text-destructive">{inviteErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="admin@ejemplo.com"
                disabled={isInviting}
              />
              {inviteErrors.email && <p className="text-xs text-destructive">{inviteErrors.email}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Partner / Empresa a administrar</label>
              <Select
                value={inviteForm.partnerScope}
                onValueChange={(v) => setInviteForm({ ...inviteForm, partnerScope: v })}
                disabled={isInviting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un partner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">🌐 Global (todos los partners)</SelectItem>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {inviteErrors.partnerScope && (
                <p className="text-xs text-destructive">{inviteErrors.partnerScope}</p>
              )}
              <p className="text-xs text-muted-foreground">
                El admin solo verá tenants y usuarios del partner asignado. Selecciona "Global" para acceso total.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Contraseña</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={generateRandomPassword}
                  disabled={isInviting}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Generar aleatoria
                </Button>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                  disabled={isInviting}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {inviteErrors.password && (
                <p className="text-xs text-destructive">{inviteErrors.password}</p>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)} disabled={isInviting}>
                Cancelar
              </Button>
              <Button type="submit" className="gradient-primary" disabled={isInviting}>
                {isInviting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Crear Super Admin
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    ) : null;

  return (
    <AdminLayout
      title="Usuarios"
      description="Administra super admins y usuarios de todos los tenants"
      actions={headerActions}
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList>
          <TabsTrigger value="super_admins">
            <Shield className="h-4 w-4 mr-2" />
            Super Admins
          </TabsTrigger>
          <TabsTrigger value="all_users">
            <UserIcon className="h-4 w-4 mr-2" />
            Todos los usuarios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="super_admins" className="mt-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loadingSA ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : superAdmins.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No hay super admins registrados
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Nombre</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Email</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Ámbito</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Estado</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Último acceso</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {superAdmins.map((sa) => (
                    <tr key={sa.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <Shield className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium text-foreground">{sa.name || '—'}</span>
                          {sa.id === currentUser?.id && (
                            <Badge variant="outline" className="text-xs">Tú</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-foreground">{sa.email}</td>
                      <td className="p-4">
                        {sa.partner_scope ? (
                          <Badge variant="outline" className="text-xs">
                            {sa.partner_name || sa.partner_scope}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            🌐 Global
                          </Badge>
                        )}
                      </td>
                      <td className="p-4">{getStatusBadge(sa.status)}</td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {sa.last_login_at
                          ? new Date(sa.last_login_at).toLocaleString('es-MX')
                          : 'Nunca'}
                      </td>
                      <td className="p-4 text-right">
                        {(() => {
                          // Partner admins cannot manage Global super admins or
                          // admins whose scope differs from their own.
                          const outOfScope = !!currentPartnerScope && sa.partner_scope !== currentPartnerScope;
                          const isSelf = sa.id === currentUser?.id;
                          const disabled = isSelf || outOfScope;
                          return (
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" disabled={disabled}>
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          onClick={() => setSaToDelete(sa)}
                                          className="text-destructive focus:text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Eliminar
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </span>
                                </TooltipTrigger>
                                {outOfScope && !isSelf && (
                                  <TooltipContent side="left" className="max-w-xs">
                                    No puedes administrar super admins fuera de tu ámbito ({sa.partner_name || 'Global'}).
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="all_users" className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, email o tenant..."
              value={searchAll}
              onChange={(e) => setSearchAll(e.target.value)}
              className="pl-10 bg-card"
            />
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loadingAll ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredAll.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No se encontraron usuarios</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Usuario</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Tenant</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Rol</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Estado</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Acceso</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Último acceso</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAll.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{u.name || '—'}</span>
                          <span className="text-xs text-muted-foreground">{u.email}</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-foreground">
                        <div className="flex items-center gap-2">
                          {u.tenant_name || (
                            <span className="text-muted-foreground italic">Sin tenant</span>
                          )}
                          {u.tenant_managed_externally && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-accent/40 text-accent bg-accent/10"
                            >
                              Core
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant={u.global_role === 'super_admin' ? 'default' : 'secondary'} className="capitalize">
                          {getRoleLabel(u)}
                        </Badge>
                      </td>
                      <td className="p-4">{getStatusBadge(u.status)}</td>
                      <td className="p-4">
                        {u.tenant_managed_externally ? (
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 border border-border rounded-md px-2 py-1">
                                  <Lock className="h-3 w-3" />
                                  Solo lectura
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                Este usuario pertenece a un tenant gestionado por el Sistema Core.
                                La gestión de acceso (alta, baja, roles) se realiza desde el Core.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-xs text-muted-foreground">Editable</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleString('es-MX')
                          : 'Nunca'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Mostrando hasta 500 usuarios. La gestión de usuarios por tenant se realiza desde el detalle de cada tenant.
          </p>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!saToDelete} onOpenChange={(open) => !open && setSaToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Eliminar super admin</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar permanentemente a <strong>{saToDelete?.email}</strong>?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSuperAdmin}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminUsers;