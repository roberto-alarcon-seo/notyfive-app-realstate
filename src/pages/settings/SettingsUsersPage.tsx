import { useState, useEffect } from 'react';
import { Plus, Search, MoreHorizontal, Loader2, UserCheck, UserX, Eye, EyeOff, Users, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, TenantRole } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface TenantUser {
  id: string;
  name: string;
  email: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
  tenant_role: TenantRole | null;
}

const userSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  tenant_role: z.enum(['administrador', 'manager', 'asesor']),
});

const ROLE_ORDER: Record<TenantRole, number> = {
  administrador: 0,
  manager: 1,
  asesor: 2,
};

export default function SettingsUsers() {
  const { profile, tenant, tenantRole } = useAuth();
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Edit role dialog state
  const [editRoleUser, setEditRoleUser] = useState<TenantUser | null>(null);
  const [newRole, setNewRole] = useState<TenantRole>('asesor');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    tenant_role: 'asesor' as TenantRole,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Computed values
  const activeUsersCount = users.filter(u => u.status === 'active').length;
  const adminCount = users.filter(u => u.tenant_role === 'administrador' && u.status === 'active').length;

  // Check access - only administrador can access this module
  const hasAccess = tenantRole === 'administrador';

  const fetchUsers = async () => {
    if (!profile?.tenant_id) return;
    
    setIsLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('tenant_id', profile.tenant_id);

      if (profilesError) throw profilesError;

      const userIds = profiles?.map(p => p.id) || [];
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .in('user_id', userIds)
        .eq('global_role', 'user');

      if (rolesError) throw rolesError;

      const usersWithRoles: TenantUser[] = (profiles || [])
        .filter(p => roles?.some(r => r.user_id === p.id))
        .map(p => {
          const role = roles?.find(r => r.user_id === p.id);
          return {
            id: p.id,
            name: p.name,
            email: p.email,
            status: p.status,
            last_login_at: p.last_login_at,
            created_at: p.created_at,
            tenant_role: role?.tenant_role as TenantRole | null,
          };
        })
        .sort((a, b) => {
          const roleA = ROLE_ORDER[a.tenant_role || 'asesor'];
          const roleB = ROLE_ORDER[b.tenant_role || 'asesor'];
          if (roleA !== roleB) return roleA - roleB;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error al cargar los usuarios');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccess) {
      fetchUsers();
    }
  }, [profile?.tenant_id, hasAccess]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    if (!profile?.tenant_id) {
      toast.error('No se encontró el tenant');
      return;
    }

    const result = userSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        errors[err.path[0] as string] = err.message;
      });
      setFormErrors(errors);
      return;
    }

    setIsCreating(true);

    try {
      const { error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            name: formData.name,
            tenant_id: profile.tenant_id,
            global_role: 'user',
            tenant_role: formData.tenant_role,
          },
        },
      });

      if (authError) throw authError;

      toast.success('Usuario creado correctamente');
      setIsCreateOpen(false);
      setFormData({ name: '', email: '', password: '', tenant_role: 'asesor' });
      setShowPassword(false);
      fetchUsers();
    } catch (error: any) {
      if (error.message?.includes('already registered')) {
        toast.error('Este email ya está registrado');
      } else {
        toast.error(error.message || 'Error al crear el usuario');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateStatus = async (userId: string, newStatus: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (newStatus === 'disabled' && user.tenant_role === 'administrador' && adminCount <= 1) {
      toast.error('No puedes desactivar al único Administrador de este tenant.');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', userId);

      if (error) throw error;
      toast.success(`Usuario ${newStatus === 'active' ? 'activado' : 'desactivado'} correctamente`);
      fetchUsers();
    } catch (error) {
      toast.error('Error al actualizar el estado');
    }
  };

  const handleUpdateRole = async () => {
    if (!editRoleUser) return;

    if (editRoleUser.tenant_role === 'administrador' && newRole !== 'administrador' && adminCount <= 1) {
      toast.error('Debe existir al menos un Administrador en cada empresa.');
      setEditRoleUser(null);
      return;
    }

    setIsUpdatingRole(true);

    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ tenant_role: newRole })
        .eq('user_id', editRoleUser.id);

      if (error) throw error;
      toast.success('Rol actualizado correctamente');
      setEditRoleUser(null);
      fetchUsers();
    } catch (error) {
      toast.error('Error al actualizar el rol');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeVariant = (role: TenantRole | null) => {
    switch (role) {
      case 'administrador': return 'default';
      case 'manager': return 'secondary';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: TenantRole | null) => {
    switch (role) {
      case 'administrador': return 'Administrador';
      case 'manager': return 'Manager';
      case 'asesor': return 'Asesor';
      default: return 'Sin rol';
    }
  };

  // Access denied view
  if (!hasAccess) {
    return (
      <SettingsLayout title="Usuarios" description="Gestión del equipo" icon={Users}>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Acceso restringido</h2>
          <p className="text-muted-foreground max-w-md">
            Solo los Administradores pueden gestionar los usuarios del equipo.
          </p>
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout 
      title="Usuarios del equipo" 
      description={`Gestiona los usuarios de ${tenant?.name || 'tu empresa'}`}
      icon={Users}
    >
      <div className="space-y-6 max-w-4xl">
        {/* Header with button */}
        <div className="flex items-center justify-between">
          <div />
          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) {
              setShowPassword(false);
              setFormErrors({});
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo usuario
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Crear nuevo usuario</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nombre</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Juan Pérez"
                    disabled={isCreating}
                  />
                  {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="usuario@empresa.com"
                    disabled={isCreating}
                  />
                  {formErrors.email && <p className="text-xs text-destructive">{formErrors.email}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Contraseña</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••"
                      disabled={isCreating}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {formErrors.password && <p className="text-xs text-destructive">{formErrors.password}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Rol interno</label>
                  <Select
                    value={formData.tenant_role}
                    onValueChange={(value: TenantRole) => setFormData({ ...formData, tenant_role: value })}
                    disabled={isCreating}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="administrador">Administrador — Acceso completo</SelectItem>
                      <SelectItem value="manager">Manager — Acceso operativo total</SelectItem>
                      <SelectItem value="asesor">Asesor — Solo propiedades asignadas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creando...</> : 'Crear usuario'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Users Info Card */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="text-sm font-medium text-foreground">Usuarios activos</span>
              <p className="text-2xl font-semibold text-foreground">{activeUsersCount}</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuarios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No se encontraron usuarios
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Usuario</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Rol</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Estado</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getRoleBadgeVariant(user.tenant_role)}>
                        {getRoleLabel(user.tenant_role)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.status === 'active' ? 'default' : 'outline'} 
                             className={user.status === 'active' ? 'bg-green-500/10 text-green-500' : ''}>
                        {user.status === 'active' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setEditRoleUser(user);
                            setNewRole(user.tenant_role || 'asesor');
                          }}>
                            Cambiar rol
                          </DropdownMenuItem>
                          {user.status === 'active' ? (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(user.id, 'disabled')}>
                              <UserX className="h-4 w-4 mr-2" />
                              Desactivar
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(user.id, 'active')}>
                              <UserCheck className="h-4 w-4 mr-2" />
                              Activar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Role Dialog */}
      <AlertDialog open={!!editRoleUser} onOpenChange={() => setEditRoleUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiar rol de {editRoleUser?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Selecciona el nuevo rol para este usuario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={newRole} onValueChange={(value: TenantRole) => setNewRole(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="administrador">Administrador — Acceso completo</SelectItem>
              <SelectItem value="manager">Manager — Acceso operativo total</SelectItem>
              <SelectItem value="asesor">Asesor — Solo propiedades asignadas</SelectItem>
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpdateRole} disabled={isUpdatingRole}>
              {isUpdatingRole ? 'Guardando...' : 'Guardar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsLayout>
  );
}