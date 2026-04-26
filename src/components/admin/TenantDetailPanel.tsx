import { X, Shield } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TenantOverviewTab } from './TenantOverviewTab';
import { TenantWalletTab } from './TenantWalletTab';
import { TenantWhatsAppTab } from './TenantWhatsAppTab';
import { TenantUsageTab } from './TenantUsageTab';
import { TenantAutomationTab } from './TenantAutomationTab';
import { TenantSupportTab } from './TenantSupportTab';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Tenant {
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

interface TenantDetailPanelProps {
  tenant: Tenant;
  onClose: () => void;
  onTenantUpdate?: () => void;
}

export function TenantDetailPanel({ tenant, onClose, onTenantUpdate }: TenantDetailPanelProps) {
  const { isSuperAdmin } = useAuth();
  const [isImpersonating, setIsImpersonating] = useState(false);

  const handleStartSupportMode = async () => {
    setIsImpersonating(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'admin-impersonate-sso',
        { body: { tenant_id: tenant.id } },
      );
      if (error || !data?.sso_path) {
        const detail = (error as { message?: string } | null)?.message
          ?? (data as { error?: string } | null)?.error
          ?? 'No se pudo generar el acceso SSO.';
        toast.error('Error al iniciar impersonación', { description: detail });
        return;
      }
      toast.success(`Accediendo como ${data.target_email}`);
      window.location.assign(data.sso_path as string);
    } catch (err) {
      console.error(err);
      toast.error('Error inesperado al generar SSO');
    } finally {
      setIsImpersonating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="fixed inset-y-0 right-0 w-full max-w-4xl bg-card border-l border-border shadow-xl animate-slide-in-right overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{tenant.name}</h2>
            <p className="text-sm text-muted-foreground">ID: {tenant.id.slice(0, 8)}...</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Impersonation button - only for super_admin */}
            {isSuperAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleStartSupportMode}
                    disabled={isImpersonating}
                    className="gap-2"
                  >
                    <Shield className="h-4 w-4" />
                    {isImpersonating ? 'Generando…' : 'Acceder como Tenant'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  Genera un acceso SSO al CRM como administrador del tenant.
                  La acción queda registrada en auditoría.
                </TooltipContent>
              </Tooltip>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start px-6 py-0 h-auto bg-transparent border-b border-border rounded-none shrink-0">
            <TabsTrigger 
              value="overview" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="wallet"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
            >
              Wallet
            </TabsTrigger>
            <TabsTrigger 
              value="whatsapp"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
            >
              WhatsApp
            </TabsTrigger>
            <TabsTrigger 
              value="usage"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
            >
              Uso
            </TabsTrigger>
            <TabsTrigger 
              value="automation"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
            >
              Automatización
            </TabsTrigger>
            <TabsTrigger 
              value="support"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
            >
              Soporte
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="overview" className="mt-0 p-6">
              <TenantOverviewTab tenant={tenant} onTenantUpdate={onTenantUpdate} />
            </TabsContent>
            <TabsContent value="wallet" className="mt-0 p-6">
              <TenantWalletTab tenantId={tenant.id} />
            </TabsContent>
            <TabsContent value="whatsapp" className="mt-0 p-6">
              <TenantWhatsAppTab tenantId={tenant.id} tenantName={tenant.name} />
            </TabsContent>
            <TabsContent value="usage" className="mt-0 p-6">
              <TenantUsageTab tenantId={tenant.id} />
            </TabsContent>
            <TabsContent value="automation" className="mt-0 p-6">
              <TenantAutomationTab tenantId={tenant.id} />
            </TabsContent>
            <TabsContent value="support" className="mt-0 p-6">
              <TenantSupportTab tenantId={tenant.id} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
