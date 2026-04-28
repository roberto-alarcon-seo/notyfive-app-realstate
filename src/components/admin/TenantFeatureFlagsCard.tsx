import { useEffect, useState } from 'react';
import { Megaphone, Filter, Workflow, Save, Loader2, Info, ToggleLeft, KeyRound } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TenantFeatureFlagsCardProps {
  tenantId: string;
  partnerId?: string | null;
  partnerName?: string | null;
  onUpdate?: () => void;
}

type FeatureKey = 'campaigns' | 'segments' | 'automations_builder' | 'api_access';

interface FeatureOption {
  key: FeatureKey;
  label: string;
  description: string;
  icon: typeof Megaphone;
  outreach: boolean;
}

const FEATURE_OPTIONS: FeatureOption[] = [
  {
    key: 'campaigns',
    label: 'Campañas Outreach',
    description: 'Envíos masivos vía plantillas de WhatsApp.',
    icon: Megaphone,
    outreach: true,
  },
  {
    key: 'segments',
    label: 'Segmentos Dinámicos',
    description: 'Audiencias filtradas por reglas avanzadas.',
    icon: Filter,
    outreach: true,
  },
  {
    key: 'automations_builder',
    label: 'Automatizaciones Avanzadas',
    description: 'Constructor visual de flujos automatizados.',
    icon: Workflow,
    outreach: false,
  },
  {
    key: 'api_access',
    label: 'Acceso a API & Webhooks',
    description: 'Tokens, endpoints REST y webhooks salientes.',
    icon: KeyRound,
    outreach: false,
  },
];

function isMlsLatamPartner(partnerId?: string | null, partnerName?: string | null): boolean {
  const id = (partnerId ?? '').toLowerCase();
  const name = (partnerName ?? '').toLowerCase();
  return id === 'mls_latam' || name.includes('mls latam');
}

export function TenantFeatureFlagsCard({
  tenantId,
  partnerId,
  partnerName,
  onUpdate,
}: TenantFeatureFlagsCardProps) {
  const [enabled, setEnabled] = useState<Set<FeatureKey>>(new Set());
  const [original, setOriginal] = useState<Set<FeatureKey>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resolvedPartnerName, setResolvedPartnerName] = useState<string | null>(
    partnerName ?? null,
  );

  const isMls = isMlsLatamPartner(partnerId, resolvedPartnerName);

  useEffect(() => {
    if (partnerName || !partnerId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('partners')
        .select('name')
        .eq('id', partnerId)
        .maybeSingle();
      if (!cancelled && data?.name) setResolvedPartnerName(data.name);
    })();
    return () => {
      cancelled = true;
    };
  }, [partnerId, partnerName]);

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

  const toggleFeature = (key: FeatureKey, disabled: boolean) => {
    if (disabled) return;
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
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <ToggleLeft className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            Configuración de Módulos (Feature Flags)
          </p>
          <p className="text-xs text-muted-foreground">
            Habilita o deshabilita módulos avanzados para este tenant.
          </p>
        </div>
      </div>

      {isMls && (
        <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-warning/10 border border-warning/30">
          <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-warning-foreground">
            Las funciones de Outreach (Campañas y Segmentos) no están disponibles
            para este partner.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {FEATURE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const blocked = isMls && opt.outreach;
            const checked = enabled.has(opt.key);
            return (
              <label
                key={opt.key}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  blocked
                    ? 'bg-muted/20 border-border opacity-60 cursor-not-allowed'
                    : 'bg-background/50 border-border hover:border-primary/40 cursor-pointer'
                }`}
              >
                <Checkbox
                  checked={checked}
                  disabled={blocked || saving}
                  onCheckedChange={() => toggleFeature(opt.key, blocked)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {opt.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {opt.description}
                  </p>
                </div>
              </label>
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
