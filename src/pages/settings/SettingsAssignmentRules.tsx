import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Users } from "lucide-react";
import { SettingsLayout } from "@/components/settings/SettingsLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useAssignmentRules, useAssignableAgents, type TimeoutAction } from "@/hooks/useAssignmentRules";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export default function SettingsAssignmentRules() {
  const { tenantRole, isSuperAdmin } = useAuth();
  const { data: rules, isLoading, update } = useAssignmentRules();
  const { data: agents, setActive } = useAssignableAgents();

  const [form, setForm] = useState({
    round_robin_enabled: true,
    sticky_agent_enabled: true,
    sticky_overrides_property: false,
    lead_timeout_minutes: 30,
    timeout_action: "notify" as TimeoutAction,
    max_active_leads_per_agent: "" as string,
  });

  useEffect(() => {
    if (rules) {
      setForm({
        round_robin_enabled: rules.round_robin_enabled,
        sticky_agent_enabled: rules.sticky_agent_enabled,
        sticky_overrides_property: rules.sticky_overrides_property,
        lead_timeout_minutes: rules.lead_timeout_minutes,
        timeout_action: rules.timeout_action,
        max_active_leads_per_agent:
          rules.max_active_leads_per_agent == null ? "" : String(rules.max_active_leads_per_agent),
      });
    }
  }, [rules]);

  if (!isSuperAdmin && tenantRole !== "administrador") {
    return <Navigate to="/settings/whatsapp" replace />;
  }

  const handleSave = () => {
    const max = form.max_active_leads_per_agent.trim();
    update.mutate({
      round_robin_enabled: form.round_robin_enabled,
      sticky_agent_enabled: form.sticky_agent_enabled,
      sticky_overrides_property: form.sticky_overrides_property,
      lead_timeout_minutes: Number(form.lead_timeout_minutes) || 30,
      timeout_action: form.timeout_action,
      max_active_leads_per_agent: max === "" ? null : Math.max(1, Number(max)),
    });
  };

  return (
    <SettingsLayout
      title="Asignación de leads"
      description="Define cómo se asignan los clientes a los asesores"
      icon={Users}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6 max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Reglas de asignación</CardTitle>
              <CardDescription>
                Orden de evaluación: Sticky Agent → Asesor del inmueble → Round Robin → Fallback.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium">Round Robin</Label>
                  <p className="text-xs text-muted-foreground">
                    Rota nuevos leads entre los asesores activos.
                  </p>
                </div>
                <Switch
                  checked={form.round_robin_enabled}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, round_robin_enabled: v }))}
                />
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium">Sticky Agent</Label>
                  <p className="text-xs text-muted-foreground">
                    Si el cliente ya fue atendido, vuelve siempre con el mismo asesor.
                  </p>
                </div>
                <Switch
                  checked={form.sticky_agent_enabled}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, sticky_agent_enabled: v }))}
                />
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium">Sticky tiene prioridad sobre el inmueble</Label>
                  <p className="text-xs text-muted-foreground">
                    Si está apagado, cuando el cliente vuelve interesado en otro inmueble que tiene asesor asignado,
                    se usa el asesor del inmueble.
                  </p>
                </div>
                <Switch
                  checked={form.sticky_overrides_property}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, sticky_overrides_property: v }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="timeout">Timeout de respuesta (minutos)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    min={1}
                    max={1440}
                    value={form.lead_timeout_minutes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, lead_timeout_minutes: Number(e.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Acción al cumplir el timeout</Label>
                  <Select
                    value={form.timeout_action}
                    onValueChange={(v) => setForm((f) => ({ ...f, timeout_action: v as TimeoutAction }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="notify">Notificar al manager</SelectItem>
                      <SelectItem value="reassign">Reasignar automáticamente</SelectItem>
                      <SelectItem value="notify_and_reassign">Notificar y reasignar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="max">Máximo de leads activos por asesor</Label>
                  <Input
                    id="max"
                    type="number"
                    min={1}
                    placeholder="Sin límite"
                    value={form.max_active_leads_per_agent}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, max_active_leads_per_agent: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Deja vacío para no aplicar límite. Cuando un asesor llega al tope, se salta en la rotación.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={update.isPending}>
                  {update.isPending ? "Guardando..." : "Guardar reglas"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Asesores disponibles</CardTitle>
              <CardDescription>
                Activa o pausa asesores en la rotación sin desactivar su cuenta.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              {(agents ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground py-4">
                  No hay asesores en esta organización.
                </p>
              )}
              {(agents ?? []).map((a) => (
                <div key={a.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {a.is_active_for_assignment ? "Activo" : "Pausado"}
                    </span>
                    <Switch
                      checked={a.is_active_for_assignment}
                      onCheckedChange={(v) => setActive.mutate({ userId: a.id, active: v })}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </SettingsLayout>
  );
}
