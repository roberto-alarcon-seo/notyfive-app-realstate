import { useState, useEffect } from 'react';
import { Plus, Building2, Users, Search, MoreHorizontal, Loader2, MessageSquare, ExternalLink, LogOut, User, Pause, Play, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TwilioConfigDialog } from '@/components/admin/TwilioConfigDialog';
import { TenantDetailPanel } from '@/components/admin/TenantDetailPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useSignOutRedirect } from '@/hooks/useSignOutRedirect';
import { useNavigate } from 'react-router-dom';

interface Tenant {
  id: string;
  name: string;
  plan: string;
  status: string;
  subscription_status?: string;
  created_at: string;
  users_count?: number;
  contacts_count?: number;
  // Billing fields from database
  billing_state?: string;
  message_credits?: number;
  monthly_credits_remaining?: number;
  accumulated_credits?: number;
}

// Plan configuration for display purposes
const PLAN_CONFIG = {
  trial: { label: 'Trial', description: 'Plan de prueba sin créditos.' },
  starter: { label: 'Starter', description: 'Plan de entrada con volumen limitado de mensajes.' },
  growth: { label: 'Growth', description: 'Plan más popular, balance entre volumen y costo.' },
  pro: { label: 'Pro', description: 'Plan avanzado con límites más altos.' },
  scale: { label: 'Scale', description: 'Plan de alto volumen para uso intensivo.' },
  enterprise: { label: 'Enterprise', description: 'Plan personalizado. La configuración y límites se definen manualmente.' },
};

// Simplified schema - no plan or password required
const tenantSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  ownerName: z.string().trim().min(2, "El nombre del owner debe tener al menos 2 caracteres").max(100),
  ownerEmail: z.string().trim().email("Email inválido"),
});

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Twilio config dialog state
  const [twilioConfigOpen, setTwilioConfigOpen] = useState(false);
  const [selectedTenantForTwilio, setSelectedTenantForTwilio] = useState<Tenant | null>(null);
  
  // Tenant detail panel state
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  // Suspend/Delete confirmation state
  const [tenantToSuspend, setTenantToSuspend] = useState<Tenant | null>(null);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form state - simplified without plan and password
  const [formData, setFormData] = useState({
    name: '',
    ownerName: '',
    ownerEmail: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleSignOut = useSignOutRedirect();

  const fetchTenants = async () => {
    setIsLoading(true);
    try {
      const { data: tenantsData, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user counts for each tenant (only counting users with global_role = 'user')
      const tenantsWithCounts = await Promise.all(
        (tenantsData || []).map(async (tenant) => {
          // Count active users with global_role = 'user' in this tenant
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id')
            .eq('tenant_id', tenant.id)
            .eq('status', 'active');

          // For each profile, check if they have global_role = 'user'
          let usersCount = 0;
          if (profiles && profiles.length > 0) {
            const { count } = await supabase
              .from('user_roles')
              .select('*', { count: 'exact', head: true })
              .in('user_id', profiles.map(p => p.id))
              .eq('global_role', 'user');
            usersCount = count || 0;
          }

          // Contacts count will be 0 until contacts table exists
          const contactsCount = 0;

          return { 
            ...tenant, 
            users_count: usersCount,
            contacts_count: contactsCount 
          };
        })
      );

      setTenants(tenantsWithCounts);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast.error('Error al cargar los tenants');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const result = tenantSchema.safeParse(formData);
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
      // 1. Create tenant with forced trial values (backend controlled)
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({ 
          name: formData.name, 
          plan: 'trial',
          status: 'trial',
          billing_state: 'CREDITS_EXHAUSTED',
          message_credits: 0,
          monthly_credits_remaining: 0,
          accumulated_credits: 0,
          initial_credits_granted: false,
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      // 2. Create owner via edge function (uses Admin API to create user without password)
      const { data: inviteData, error: inviteError } = await supabase.functions.invoke('admin-invite-owner', {
        body: {
          tenantId: tenant.id,
          ownerEmail: formData.ownerEmail,
          ownerName: formData.ownerName,
        },
      });

      if (inviteError || !inviteData?.success) {
        // Rollback tenant creation
        await supabase.from('tenants').delete().eq('id', tenant.id);
        throw new Error(inviteData?.error || inviteError?.message || 'Error al crear el owner');
      }

      toast.success('Tenant creado. Enviamos un enlace al Owner para activar su cuenta.');
      setIsCreateOpen(false);
      setFormData({
        name: '',
        ownerName: '',
        ownerEmail: '',
      });
      fetchTenants();
    } catch (error: any) {
      console.error('Error creating tenant:', error);
      toast.error(error.message || 'Error al crear el tenant');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredTenants = tenants.filter(tenant =>
    tenant.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case 'enterprise': return 'default';
      case 'pro': return 'default';
      case 'growth': return 'secondary';
      case 'starter': return 'secondary';
      case 'trial': return 'outline';
      default: return 'outline';
    }
  };

  const getPlanLabel = (plan: string) => {
    return PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG]?.label || plan;
  };

  const getStatusBadgeVariant = (status: string, subscriptionStatus?: string) => {
    if (subscriptionStatus === 'cancel_pending') return 'destructive';
    switch (status) {
      case 'active': return 'default';
      case 'suspended': return 'destructive';
      case 'trial': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string, subscriptionStatus?: string) => {
    if (subscriptionStatus === 'cancel_pending') return 'Cancelación programada';
    switch (status) {
      case 'active': return 'Activo';
      case 'suspended': return 'Suspendido';
      case 'trial': return 'Prueba';
      default: return status;
    }
  };

  const getCreditStatusColor = (credits: number, billingState?: string) => {
    if (billingState === 'CREDITS_EXHAUSTED' || billingState === 'SUBSCRIPTION_REQUIRED' || credits <= 0) {
      return 'text-destructive';
    }
    if (credits <= 100) {
      return 'text-warning';
    }
    return 'text-success';
  };

  const getCreditStatusLabel = (credits: number, billingState?: string) => {
    if (billingState === 'SUBSCRIBED_ACTIVE') return 'Suscrito';
    if (billingState === 'CREDITS_EXHAUSTED' || credits <= 0) return 'Sin saldo';
    if (credits <= 100) return 'Bajo';
    return 'Activo';
  };

  const handleSuspendTenant = async (tenant: Tenant) => {
    setIsProcessing(true);
    try {
      const newStatus = tenant.status === 'suspended' ? 'active' : 'suspended';
      const { error } = await supabase
        .from('tenants')
        .update({ status: newStatus })
        .eq('id', tenant.id);

      if (error) throw error;

      toast.success(newStatus === 'suspended' ? 'Tenant suspendido' : 'Tenant reactivado');
      setTenantToSuspend(null);
      fetchTenants();
    } catch (error: any) {
      console.error('Error updating tenant status:', error);
      toast.error('Error al actualizar el estado del tenant');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteTenant = async (tenant: Tenant) => {
    setIsProcessing(true);
    try {
      // Get users associated with this tenant
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('tenant_id', tenant.id);

      // Delete user_roles for tenant users
      if (profiles && profiles.length > 0) {
        const userIds = profiles.map(p => p.id);
        await supabase.from('user_roles').delete().in('user_id', userIds);
      }

      // Delete all related records before deleting tenant
      // Order matters due to foreign key constraints
      await supabase.from('security_events').delete().eq('tenant_id', tenant.id);
      await supabase.from('password_resets').delete().eq('tenant_id', tenant.id);
      await supabase.from('tenant_ai_settings').delete().eq('tenant_id', tenant.id);
      await supabase.from('tenant_integrations').delete().eq('tenant_id', tenant.id);
      await supabase.from('wallets').delete().eq('tenant_id', tenant.id);
      
      // Delete profiles after cleaning up user-related tables
      if (profiles && profiles.length > 0) {
        const userIds = profiles.map(p => p.id);
        await supabase.from('profiles').delete().in('id', userIds);
      }

      // Delete tenant
      const { error } = await supabase.from('tenants').delete().eq('id', tenant.id);
      if (error) throw error;

      toast.success('Tenant eliminado permanentemente');
      setTenantToDelete(null);
      fetchTenants();
    } catch (error: any) {
      console.error('Error deleting tenant:', error);
      toast.error('Error al eliminar el tenant: ' + (error.message || 'Error desconocido'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Panel de Administración</h1>
            <p className="text-muted-foreground">Gestiona todos los tenants de la plataforma</p>
          </div>
          <div className="flex items-center gap-3">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Tenant
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Crear nuevo Tenant</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateTenant} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nombre de la empresa</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Mi Empresa"
                      disabled={isCreating}
                    />
                    {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
                  </div>

                  <div className="border-t border-border pt-4">
                    <p className="text-sm font-medium mb-3">Usuario Owner</p>
                    
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">Nombre</label>
                        <Input
                          value={formData.ownerName}
                          onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                          placeholder="Juan Pérez"
                          disabled={isCreating}
                        />
                        {formErrors.ownerName && <p className="text-xs text-destructive">{formErrors.ownerName}</p>}
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">Email</label>
                        <Input
                          type="email"
                          value={formData.ownerEmail}
                          onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                          placeholder="owner@empresa.com"
                          disabled={isCreating}
                        />
                        {formErrors.ownerEmail && <p className="text-xs text-destructive">{formErrors.ownerEmail}</p>}
                      </div>

                      <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded-md">
                        💡 Crearemos la cuenta del Owner y le enviaremos un enlace seguro para establecer su contraseña.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="gradient-primary" disabled={isCreating}>
                      {isCreating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creando...
                        </>
                      ) : (
                        'Crear Tenant'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            
            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full">
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium text-foreground">Super Admin</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{tenants.length}</p>
                <p className="text-sm text-muted-foreground">Tenants totales</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Building2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">
                  {tenants.filter(t => t.status === 'active').length}
                </p>
                <p className="text-sm text-muted-foreground">Activos</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Users className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">
                  {tenants.reduce((acc, t) => acc + (t.users_count || 0), 0)}
                </p>
                <p className="text-sm text-muted-foreground">Usuarios totales</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tenants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card"
          />
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No se encontraron tenants
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Empresa</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Plan</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Estado</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Saldo</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Creado</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map((tenant) => {
                  const monthlyRemaining = tenant.monthly_credits_remaining ?? 0;
                  const accumulated = tenant.accumulated_credits ?? 0;
                  const totalCredits = monthlyRemaining + accumulated;
                  
                  return (
                    <tr key={tenant.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <span className="font-medium text-foreground">{tenant.name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant={getPlanBadgeVariant(tenant.plan)} className="capitalize">
                          {getPlanLabel(tenant.plan)}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge variant={getStatusBadgeVariant(tenant.status, tenant.subscription_status)} className="capitalize">
                          {getStatusLabel(tenant.status, tenant.subscription_status)}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="min-w-[120px]">
                          <p className="font-medium text-foreground">
                            {totalCredits.toLocaleString('es-MX')} créditos
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Mes: {monthlyRemaining.toLocaleString('es-MX')}</span>
                            <span className="text-primary">Acum: {accumulated.toLocaleString('es-MX')}</span>
                          </div>
                          <span className={`text-xs ${getCreditStatusColor(totalCredits, tenant.billing_state)}`}>
                            {getCreditStatusLabel(totalCredits, tenant.billing_state)}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground text-sm">
                        {new Date(tenant.created_at).toLocaleDateString('es-MX')}
                      </td>
                      <td className="p-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => setSelectedTenant(tenant)}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Ver detalles
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedTenantForTwilio(tenant);
                                setTwilioConfigOpen(true);
                              }}
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Configurar WhatsApp
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.info('Editar - próximamente')}>
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => setTenantToSuspend(tenant)}
                              className={tenant.status === 'suspended' ? 'text-success' : 'text-warning'}
                            >
                              {tenant.status === 'suspended' ? (
                                <>
                                  <Play className="h-4 w-4 mr-2" />
                                  Reactivar
                                </>
                              ) : (
                                <>
                                  <Pause className="h-4 w-4 mr-2" />
                                  Suspender
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setTenantToDelete(tenant)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Twilio Config Dialog */}
      {selectedTenantForTwilio && (
        <TwilioConfigDialog
          open={twilioConfigOpen}
          onOpenChange={setTwilioConfigOpen}
          tenantId={selectedTenantForTwilio.id}
          tenantName={selectedTenantForTwilio.name}
          onSuccess={() => fetchTenants()}
        />
      )}

      {/* Tenant Detail Panel */}
      {selectedTenant && (
        <TenantDetailPanel
          tenant={selectedTenant}
          onClose={() => setSelectedTenant(null)}
          onTenantUpdate={fetchTenants}
        />
      )}

      {/* Suspend/Reactivate Confirmation Dialog */}
      <AlertDialog open={!!tenantToSuspend} onOpenChange={(open) => !open && setTenantToSuspend(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tenantToSuspend?.status === 'suspended' ? 'Reactivar' : 'Suspender'} tenant
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tenantToSuspend?.status === 'suspended' 
                ? `¿Estás seguro de que deseas reactivar "${tenantToSuspend?.name}"? El tenant podrá volver a operar normalmente.`
                : `¿Estás seguro de que deseas suspender "${tenantToSuspend?.name}"? Los usuarios no podrán acceder a la plataforma mientras esté suspendido.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => tenantToSuspend && handleSuspendTenant(tenantToSuspend)}
              disabled={isProcessing}
              className={tenantToSuspend?.status === 'suspended' ? 'bg-success hover:bg-success/90' : 'bg-warning hover:bg-warning/90'}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {tenantToSuspend?.status === 'suspended' ? 'Reactivar' : 'Suspender'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!tenantToDelete} onOpenChange={(open) => !open && setTenantToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Eliminar tenant permanentemente</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar "{tenantToDelete?.name}" <strong>permanentemente</strong>? 
              Esta acción no se puede deshacer y eliminará todos los datos asociados incluyendo usuarios, 
              contactos, conversaciones y configuraciones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => tenantToDelete && handleDeleteTenant(tenantToDelete)}
              disabled={isProcessing}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Eliminar permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;
