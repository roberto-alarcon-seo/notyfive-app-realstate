import { useEffect, useState } from 'react';
import { Megaphone, Filter, Workflow, Save, Loader2, ToggleLeft, KeyRound, Target } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface TenantFeatureFlagsCardProps {
  tenantId: string;
  /** @deprecated Partner-based restrictions removed. Kept for backwards compatibility. */
  partnerId?: string | null;
  /** @deprecated Partner-based restrictions removed. Kept for backwards compatibility. */
  partnerName?: string | null;
  onUpdate?: () => void;
}

type FeatureKey =
  | 'campaigns'
  | 'segments'
  | 'automations_builder'
  | 'api_access'
  | 'conversions_capi';

interface FeatureOption {
  key: FeatureKey;
  label: string;
  description: string;
  value: string;
  icon: typeof Megaphone;
}

const FEATURE_OPTIONS: FeatureOption[] = [
  {
    key: 'campaigns',
    label: 'Campañas',
    description: 'Envíos masivos vía plantillas de WhatsApp con seguimiento por contacto.',
    value: 'Acelera la generación de leads y reactivaciones a escala.',
    icon: Megaphone,
  },
  {
    key: 'segments',
    label: 'Segmentos',
    description: 'Audiencias dinámicas filtradas por reglas avanzadas.',
    value: 'Permite hipersegmentar y personalizar la comunicación.',
    icon: Filter,
  },
  {
    key: 'automations_builder',
    label: 'Automatizaciones',
    description: 'Constructor visual de flujos automatizados multipaso.',
    value: 'Reduce tareas repetitivas y mejora tiempos de respuesta.',
    icon: Workflow,
  },
  {
    key: 'api_access',
    label: 'API & Webhooks',
    description: 'Tokens, endpoints REST y webhooks salientes para integraciones.',
    value: 'Conecta el CRM con sistemas externos y portales propios.',
    icon: KeyRound,
  },
  {
    key: 'conversions_capi',
    label: 'Conversiones (CAPI)',
    description:
      'Configuración avanzada de Meta Conversions API y Pixel para rastrear eventos de ventas.',
    value:
      'Ideal para clientes que invierten en Meta Ads y necesitan medir su retorno de inversión.',
    icon: Target,
  },
];

export function TenantFeatureFlagsCard({
  tenantId,
  onUpdate,
}: TenantFeatureFlagsCardProps) {
  const [enabled, setEnabled] = useState<Set<FeatureKey>>(new Set());
  const [original, setOriginal] = useState<Set<FeatureKey>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('tenants')
        .select('enabled_features')
        .eq('id', tenantId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('Error loading feature flags:', error);
        toast.error('No se pudieron cargar los feature flags');
        setLoading(false);
        return;
      }
      const list = Array.isArray(data?.enabled_features)
        ? (data!.enabled_features as string[])
        : [];
      const set = new Set<FeatureKey>(
        list.filter((f): f is FeatureKey =>
          FEATURE_OPTIONS.some((opt) => opt.key === f),
        ),
      );
      setEnabled(set);
      setOriginal(new Set(set));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const toggleFeature = (key: FeatureKey) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isDirty = (() => {
    if (enabled.size !== original.size) return true;
    for (const k of enabled) if (!original.has(k)) return true;
    return false;
  })();

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = Array.from(enabled);
      const { error } = await supabase
        .from('tenants')
        .update({ enabled_features: payload })
        .eq('id', tenantId);
      if (error) {
        toast.error(error.message || 'Error al guardar feature flags');
        return;
      }
      setOriginal(new Set(enabled));
      toast.success('Feature flags actualizados');
      // Invalidación instantánea: refresca tenant context y feature flags
      // para que la UI (sidebar, gates, etc.) reaccione sin recargar la página.
      queryClient.invalidateQueries({ queryKey: ['tenant-context'] });
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      onUpdate?.();
    } catch (err) {
      console.error(err);
      toast.error('Error inesperado al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-secondary/30 border border-border rounded-xl p-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 rounded-lg bg-primary/10">
          <ToggleLeft className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            Módulos del Tenant
          </p>
          <p className="text-xs text-muted-foreground">
            Activa o desactiva funcionalidades avanzadas para este tenant.
            Solo visible para Super Admin.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {FEATURE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const checked = enabled.has(opt.key);
            return (
              <div
                key={opt.key}
                className="flex items-start gap-4 p-4 rounded-lg border border-border bg-background/50 hover:border-primary/40 transition-colors"
              >
                <div className="p-2 rounded-md bg-muted/50 shrink-0">
                  <Icon className="h-4 w-4 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-foreground">
                      {opt.label}
                    </span>
                    <Switch
                      checked={checked}
                      disabled={saving}
                      onCheckedChange={() => toggleFeature(opt.key)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {opt.description}
                  </p>
                  <p className="text-[11px] text-muted-foreground/80 mt-1 italic">
                    {opt.value}
                  </p>
                </div>
              </div>
            );
          })}

          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || saving}
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Save className="h-3 w-3 mr-1" />
              )}
              Guardar cambios
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
