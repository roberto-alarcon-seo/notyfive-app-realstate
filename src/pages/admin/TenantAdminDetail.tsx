import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Loader2, Lock, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TenantOverviewTab } from '@/components/admin/TenantOverviewTab';
import { TenantWalletTab } from '@/components/admin/TenantWalletTab';
import { TenantWhatsAppTab } from '@/components/admin/TenantWhatsAppTab';
import { TenantInventoryTab } from '@/components/admin/TenantInventoryTab';
import { TenantUsersTab } from '@/components/admin/TenantUsersTab';
import { TenantLogsTab } from '@/components/admin/TenantLogsTab';
import { TenantFeatureFlagsCard } from '@/components/admin/TenantFeatureFlagsCard';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { extractEdgeFunctionError } from '@/lib/edgeFunctionError';
import { ImpersonateUserModal } from '@/components/admin/ImpersonateUserModal';

interface TenantRecord {
  id: string;
  name: string;
  plan: string;
  status: string;
  created_at: string;
  billing_state?: string;
  message_credits?: number;
  initial_credits_granted?: boolean;
  external_id?: string | null;
  managed_externally?: boolean;
  max_users?: number;
}

export default function TenantAdminDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const [impersonateModalOpen, setImpersonateModalOpen] = useState(false);

  const [tenant, setTenant] = useState<TenantRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTenant = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error('No se encontró el tenant');
        navigate('/admin/tenants');
        return;
      }
      setTenant(data as TenantRecord);
    } catch (err) {
      console.error('Error loading tenant:', err);
      toast.error('Error al cargar el tenant');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading || !tenant) {
    return (
      <AdminLayout title="Tenant" description="Cargando…">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const externallyManaged = !!tenant.managed_externally;

  const headerActions = (
    <>
      {isSuperAdmin && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImpersonateModalOpen(true)}
              className="gap-2"
            >
              <Shield className="h-4 w-4" />
              Acceder como Tenant
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            Genera un acceso SSO al CRM como administrador del tenant. La acción
            queda registrada en auditoría.
          </TooltipContent>
        </Tooltip>
      )}
      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/tenants')} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Button>
    </>
  );

  return (
    <AdminLayout title={tenant.name} description={`ID: ${tenant.id}`} actions={headerActions}>
      {/* Tenant header card */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6 flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-foreground truncate">{tenant.name}</h2>
            {externallyManaged ? (
              <Badge
                variant="outline"
                className="text-[10px] uppercase tracking-wider border-accent text-accent bg-accent/10 gap-1"
              >
                <Lock className="h-3 w-3" />
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
            <Badge variant="secondary" className="capitalize">
              {tenant.plan}
            </Badge>
          </div>
          <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              Creado el{' '}
              {new Date(tenant.created_at).toLocaleDateString('es-MX', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            {tenant.external_id && (
              <span className="font-mono">External ID: {tenant.external_id}</span>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none h-auto p-0 mb-6 overflow-x-auto">
          {[
            { value: 'general', label: 'General' },
            { value: 'wallet', label: 'Wallet' },
            { value: 'inventory', label: 'Inventario' },
            { value: 'users', label: 'Usuarios' },
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'modules', label: 'Módulos' },
            { value: 'logs', label: 'Logs' },
          ].map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general" className="mt-0">
          <TenantOverviewTab tenant={tenant} onTenantUpdate={fetchTenant} />
        </TabsContent>
        <TabsContent value="wallet" className="mt-0">
          <TenantWalletTab tenantId={tenant.id} />
        </TabsContent>
        <TabsContent value="inventory" className="mt-0">
          <TenantInventoryTab tenantId={tenant.id} managedExternally={externallyManaged} />
        </TabsContent>
        <TabsContent value="users" className="mt-0">
          <TenantUsersTab tenantId={tenant.id} managedExternally={externallyManaged} />
        </TabsContent>
        <TabsContent value="whatsapp" className="mt-0">
          <TenantWhatsAppTab tenantId={tenant.id} tenantName={tenant.name} />
        </TabsContent>
        <TabsContent value="modules" className="mt-0">
          <TenantFeatureFlagsCard tenantId={tenant.id} onUpdate={fetchTenant} />
        </TabsContent>
        <TabsContent value="logs" className="mt-0">
          <TenantLogsTab tenantId={tenant.id} />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}