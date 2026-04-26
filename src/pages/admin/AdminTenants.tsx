import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, Users, Search, MoreHorizontal, Loader2, MessageSquare, ExternalLink, Pause, Play, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TwilioConfigDialog } from '@/components/admin/TwilioConfigDialog';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { z } from 'zod';

interface Tenant {
  id: string;
  name: string;
  plan: string;
  status: string;
  subscription_status?: string;
  created_at: string;
  users_count?: number;
  contacts_count?: number;
  billing_state?: string;
  message_credits?: number;
  monthly_credits_remaining?: number;
  accumulated_credits?: number;
  external_id?: string | null;
  managed_externally?: boolean;
  max_users?: number;
}

const PLAN_CONFIG = {
  trial: { label: 'Trial' },
  starter: { label: 'Starter' },
  growth: { label: 'Growth' },
  pro: { label: 'Pro' },
  scale: { label: 'Scale' },
  enterprise: { label: 'Enterprise' },
};

const tenantSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  ownerName: z.string().trim().min(2, 'El nombre del owner debe tener al menos 2 caracteres').max(100),
  ownerEmail: z.string().trim().email('Email inválido'),
});

const AdminTenants = () => {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [twilioConfigOpen, setTwilioConfigOpen] = useState(false);
  const [selectedTenantForTwilio, setSelectedTenantForTwilio] = useState<Tenant | null>(null);
  const [tenantToSuspend, setTenantToSuspend] = useState<Tenant | null>(null);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [formData, setFormData] = useState({ name: '', ownerName: '', ownerEmail: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchTenants = async () => {
    setIsLoading(true);
    try {
      const { data: tenantsData, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const tenantsWithCounts = await Promise.all(
        (tenantsData || []).map(async (tenant) => {
          // Count ALL profiles in tenant (every profile = 1 seat, incl. owner/admin).
          const { count } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id);
          return { ...tenant, users_count: count || 0, contacts_count: 0 };
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
      result.error.errors.forEach((err) => {
        errors[err.path[0] as string] = err.message;
      });
      setFormErrors(errors);
      return;
    }

    setIsCreating(true);
    try {
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

      const { data: inviteData, error: inviteError } = await supabase.functions.invoke('admin-invite-owner', {
        body: {
          tenantId: tenant.id,
          ownerEmail: formData.ownerEmail,
          ownerName: formData.ownerName,
        },
      });

      if (inviteError || !inviteData?.success) {
        await supabase.from('tenants').delete().eq('id', tenant.id);
        throw new Error(inviteData?.error || inviteError?.message || 'Error al crear el owner');
      }

      toast.success('Tenant creado. Enviamos un enlace al Owner para activar su cuenta.');
      setIsCreateOpen(false);
      setFormData({ name: '', ownerName: '', ownerEmail: '' });
      fetchTenants();
    } catch (error: any) {
      console.error('Error creating tenant:', error);
      toast.error(error.message || 'Error al crear el tenant');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredTenants = tenants.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPlanLabel = (plan: string) => PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG]?.label || plan;

  const getStatusBadgeVariant = (status: string, sub?: string) => {
    if (sub === 'cancel_pending') return 'destructive' as const;
    switch (status) {
      case 'active':
        return 'default' as const;
      case 'suspended':
        return 'destructive' as const;
      case 'trial':
        return 'secondary' as const;
      default:
        return 'secondary' as const;
    }
  };

  const getStatusLabel = (status: string, sub?: string) => {
    if (sub === 'cancel_pending') return 'Cancelación programada';
    switch (status) {
      case 'active':
        return 'Activo';
      case 'suspended':
        return 'Suspendido';
      case 'trial':
        return 'Prueba';
      default:
        return status;
    }
  };

  const getCreditStatusColor = (credits: number, billingState?: string) => {
    if (billingState === 'CREDITS_EXHAUSTED' || credits <= 0) return 'text-destructive';
    if (credits <= 100) return 'text-warning';
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
      const { error } = await supabase.from('tenants').update({ status: newStatus }).eq('id', tenant.id);
      if (error) throw error;
      toast.success(newStatus === 'suspended' ? 'Tenant suspendido' : 'Tenant reactivado');
      setTenantToSuspend(null);
      fetchTenants();
    } catch (error) {
      toast.error('Error al actualizar el estado del tenant');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteTenant = async (tenant: Tenant) => {
    setIsProcessing(true);
    try {
      const { data: profiles } = await supabase.from('profiles').select('id').eq('tenant_id', tenant.id);
      if (profiles && profiles.length > 0) {
        const userIds = profiles.map((p) => p.id);
        await supabase.from('user_roles').delete().in('user_id', userIds);
      }
      await supabase.from('security_events').delete().eq('tenant_id', tenant.id);
      await supabase.from('password_resets').delete().eq('tenant_id', tenant.id);
      await supabase.from('tenant_ai_settings').delete().eq('tenant_id', tenant.id);
      await supabase.from('tenant_integrations').delete().eq('tenant_id', tenant.id);
      await supabase.from('wallets').delete().eq('tenant_id', tenant.id);
      if (profiles && profiles.length > 0) {
        const userIds = profiles.map((p) => p.id);
        await supabase.from('profiles').delete().in('id', userIds);
      }
      const { error } = await supabase.from('tenants').delete().eq('id', tenant.id);
      if (error) throw error;
      toast.success('Tenant eliminado permanentemente');
      setTenantToDelete(null);
      fetchTenants();
    } catch (error: any) {
      toast.error('Error al eliminar el tenant: ' + (error.message || 'Error desconocido'));
    } finally {
      setIsProcessing(false);
    }
  };

  const headerActions = (
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
  );

  return (
    <AdminLayout
      title="Tenants"
      description="Gestiona todos los tenants de la plataforma"
      actions={headerActions}
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                {tenants.filter((t) => t.status === 'active').length}
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

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar tenants..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-card"
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No se encontraron tenants</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Empresa</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Origen</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Plan</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Estado</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Asientos</th>
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
                      {tenant.managed_externally ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase tracking-wider border-accent text-accent bg-accent/10"
                        >
                          Sistema Core
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase tracking-wider text-muted-foreground"
                        >
                          Local
                        </Badge>
                      )}
                    </td>
                    <td className="p-4">
                      <Badge variant="secondary" className="capitalize">
                        {getPlanLabel(tenant.plan)}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant={getStatusBadgeVariant(tenant.status, tenant.subscription_status)} className="capitalize">
                        {getStatusLabel(tenant.status, tenant.subscription_status)}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-foreground">
                        <span className="font-medium">{tenant.users_count ?? 0}</span>
                        <span className="text-muted-foreground"> / {tenant.max_users ?? '—'}</span>
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="min-w-[120px]">
                        <p className="font-medium text-foreground">
                          {totalCredits.toLocaleString('es-MX')} créditos
                        </p>
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
                          <DropdownMenuItem onClick={() => setSelectedTenant(tenant)}>
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

      {selectedTenantForTwilio && (
        <TwilioConfigDialog
          open={twilioConfigOpen}
          onOpenChange={setTwilioConfigOpen}
          tenantId={selectedTenantForTwilio.id}
          tenantName={selectedTenantForTwilio.name}
          onSuccess={() => fetchTenants()}
        />
      )}

      {selectedTenant && (
        <TenantDetailPanel
          tenant={selectedTenant}
          onClose={() => setSelectedTenant(null)}
          onTenantUpdate={fetchTenants}
        />
      )}

      <AlertDialog open={!!tenantToSuspend} onOpenChange={(open) => !open && setTenantToSuspend(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tenantToSuspend?.status === 'suspended' ? 'Reactivar' : 'Suspender'} tenant
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tenantToSuspend?.status === 'suspended'
                ? `¿Estás seguro de que deseas reactivar "${tenantToSuspend?.name}"?`
                : `¿Estás seguro de que deseas suspender "${tenantToSuspend?.name}"? Los usuarios no podrán acceder.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => tenantToSuspend && handleSuspendTenant(tenantToSuspend)}
              disabled={isProcessing}
              className={tenantToSuspend?.status === 'suspended' ? 'bg-success hover:bg-success/90' : 'bg-warning hover:bg-warning/90'}
            >
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tenantToSuspend?.status === 'suspended' ? 'Reactivar' : 'Suspender'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!tenantToDelete} onOpenChange={(open) => !open && setTenantToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Eliminar tenant permanentemente</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar "{tenantToDelete?.name}" <strong>permanentemente</strong>?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => tenantToDelete && handleDeleteTenant(tenantToDelete)}
              disabled={isProcessing}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminTenants;