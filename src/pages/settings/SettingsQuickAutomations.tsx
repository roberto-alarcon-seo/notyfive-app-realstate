import { useEffect, useState } from "react";
import { Zap, Calendar, MessageCircleReply, RefreshCw, Loader2 } from "lucide-react";
import { SettingsLayout } from "@/components/settings/SettingsLayout";
import { PremiumGate } from "@/components/settings/PremiumGate";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveTenantId } from "@/hooks/useEffectiveTenantId";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

type RecipeKey = "visit_reminder_24h" | "followup_12h_no_reply" | "inactive_lead_7d";

interface Recipe {
  key: RecipeKey;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  // Stored fields for the automations row
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  conditions: unknown[];
  actions: { id: string; type: string; config: Record<string, unknown> }[];
}

const RECIPES: Recipe[] = [
  {
    key: "visit_reminder_24h",
    name: "Confirmación de Cita",
    description:
      "Enviar recordatorio por WhatsApp 24 horas antes de una visita agendada.",
    icon: Calendar,
    color: "text-blue-500 bg-blue-500/10",
    trigger_type: "event.upcoming",
    trigger_config: { hours_before: 24 },
    conditions: [{ field: "event.status", operator: "equals", value: "scheduled" }],
    actions: [
      {
        id: crypto.randomUUID(),
        type: "send_message",
        config: {
          message:
            "Hola {{contact.name}}, te recordamos tu visita programada para mañana. ¿Podrías confirmarla? 🙌",
        },
      },
    ],
  },
  {
    key: "followup_12h_no_reply",
    name: "Seguimiento Automático",
    description:
      "Contactar al lead si no ha respondido 12 horas después del último mensaje.",
    icon: MessageCircleReply,
    color: "text-amber-500 bg-amber-500/10",
    trigger_type: "window_expiring",
    trigger_config: { hours_since_last_message: 12 },
    conditions: [],
    actions: [
      {
        id: crypto.randomUUID(),
        type: "send_message",
        config: {
          message:
            "Hola {{contact.name}}, ¿pudiste revisar la información que te compartí? Quedo atento para resolver cualquier duda. 😊",
        },
      },
    ],
  },
  {
    key: "inactive_lead_7d",
    name: "Reactivación de Leads",
    description:
      "Enviar un mensaje de cortesía a leads inactivos por más de 7 días.",
    icon: RefreshCw,
    color: "text-emerald-500 bg-emerald-500/10",
    trigger_type: "scheduled",
    trigger_config: { days_since_last_interaction: 7, cron: "0 10 * * *" },
    conditions: [],
    actions: [
      {
        id: crypto.randomUUID(),
        type: "send_message",
        config: {
          message:
            "Hola {{contact.name}}, queríamos saber si todavía estás buscando una propiedad. Tenemos novedades que podrían interesarte. 🏡",
        },
      },
    ],
  },
];

const recipeNameSentinel = (key: RecipeKey) => `__recipe__${key}`;

export default function SettingsQuickAutomations() {
  const { enabled: hasAccess, isLoading: flagLoading } = useFeatureFlag("automations_builder");

  return (
    <SettingsLayout
      title="Automatizaciones Rápidas"
      description="Activa flujos predefinidos para confirmar citas, dar seguimiento y reactivar leads."
      icon={Zap}
    >
      <PremiumGate
        hasAccess={!flagLoading && hasAccess}
        featureName="Acciones Automáticas"
        description="Las Automatizaciones Rápidas son una función Pro. Contacta a soporte para habilitarlas en tu cuenta."
      >
        <RecipesList />
      </PremiumGate>
    </SettingsLayout>
  );
}

function RecipesList() {
  const tenantId = useEffectiveTenantId();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<RecipeKey | null>(null);
  // recipeKey -> { id, status }
  const [state, setState] = useState<Record<string, { id: string; status: string }>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!tenantId) return;
      setLoading(true);
      const names = RECIPES.map((r) => recipeNameSentinel(r.key));
      const { data, error } = await supabase
        .from("automations")
        .select("id, name, status")
        .eq("tenant_id", tenantId)
        .in("name", names);
      if (cancelled) return;
      if (error) {
        toast({
          title: "Error al cargar recetas",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      const map: Record<string, { id: string; status: string }> = {};
      for (const row of data ?? []) {
        const recipe = RECIPES.find((r) => recipeNameSentinel(r.key) === row.name);
        if (recipe) map[recipe.key] = { id: row.id, status: row.status };
      }
      setState(map);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tenantId, toast]);

  async function toggle(recipe: Recipe, next: boolean) {
    if (!tenantId) return;
    setPendingKey(recipe.key);
    try {
      const existing = state[recipe.key];
      const targetStatus = next ? "active" : "paused";

      if (existing) {
        const { error } = await supabase
          .from("automations")
          .update({ status: targetStatus })
          .eq("id", existing.id)
          .eq("tenant_id", tenantId);
        if (error) throw error;
        setState((s) => ({ ...s, [recipe.key]: { ...existing, status: targetStatus } }));
      } else {
        const { data: userRes } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from("automations")
          .insert({
            tenant_id: tenantId,
            name: recipeNameSentinel(recipe.key),
            description: recipe.description,
            status: targetStatus,
            trigger_type: recipe.trigger_type as never,
            trigger_config: recipe.trigger_config as never,
            conditions: recipe.conditions as never,
            actions: recipe.actions as never,
            created_by: userRes.user?.id ?? null,
          })
          .select("id, status")
          .single();
        if (error) throw error;
        setState((s) => ({ ...s, [recipe.key]: { id: data.id, status: data.status } }));
      }

      toast({
        title: next ? "Receta activada" : "Receta pausada",
        description: recipe.name,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar la receta";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setPendingKey(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {RECIPES.map((r) => (
          <Skeleton key={r.key} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Automatizaciones Sugeridas</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Activa flujos listos para usar. Puedes pausarlos en cualquier momento.
        </p>
      </div>

      <div className="space-y-3">
        {RECIPES.map((recipe) => {
          const Icon = recipe.icon;
          const current = state[recipe.key];
          const isOn = current?.status === "active";
          const isPending = pendingKey === recipe.key;
          return (
            <Card key={recipe.key} className="border-border bg-card">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${recipe.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground">{recipe.name}</h4>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {recipe.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {isPending && (
                      <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                    )}
                    <Switch
                      checked={isOn}
                      disabled={isPending}
                      onCheckedChange={(v) => toggle(recipe, v)}
                      aria-label={`Activar ${recipe.name}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
