import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { TenantSettings, MetaEventMapping, DEFAULT_MAPPINGS } from "@/hooks/useConversionSettings";
import { Facebook, Loader2, Plus, RotateCcw, Check, Phone, Mail, Key, Globe, AlertTriangle, Zap, Send } from "lucide-react";
import { MetaEventMappingTable } from "./MetaEventMappingTable";
import { DataQualityIndicator } from "./DataQualityIndicator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface MetaIntegrationCardProps {
  settings: TenantSettings;
  mappings: MetaEventMapping[];
  onSaveSettings: (settings: Partial<TenantSettings>) => Promise<unknown>;
  onSaveMappings: (mappings: MetaEventMapping[]) => Promise<unknown>;
  onResetMappings: () => Promise<void>;
}

export function MetaIntegrationCard({ 
  settings, 
  mappings, 
  onSaveSettings, 
  onSaveMappings,
  onResetMappings 
}: MetaIntegrationCardProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = profile?.tenant_id;

  const [localSettings, setLocalSettings] = useState({
    meta_enabled: settings.meta_enabled,
    meta_pixel_id: settings.meta_pixel_id || '',
    meta_send_pixel: settings.meta_send_pixel,
    meta_send_capi: settings.meta_send_capi,
    meta_capi_access_token: settings.meta_capi_access_token || '',
    meta_test_event_code: settings.meta_test_event_code || '',
  });
  const [localMappings, setLocalMappings] = useState<MetaEventMapping[]>(mappings);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingMappings, setIsSavingMappings] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Validation checks
  const pixelIdValid = /^\d{10,20}$/.test(localSettings.meta_pixel_id);
  const hasPixelId = localSettings.meta_pixel_id.length > 0;
  const hasCapiToken = localSettings.meta_capi_access_token.length > 0 && localSettings.meta_capi_access_token !== '••••••••••••••••';
  const capiTokenExists = settings.meta_capi_access_token_exists || hasCapiToken;

  const canSaveSettings = () => {
    if (!localSettings.meta_enabled) return true;
    if (!hasPixelId) return false;
    if (hasPixelId && !pixelIdValid) return false;
    if (localSettings.meta_send_capi && !capiTokenExists) return false;
    return true;
  };

  const handleSaveSettings = async () => {
    if (!canSaveSettings()) return;
    setIsSavingSettings(true);
    try {
      await onSaveSettings({
        meta_enabled: localSettings.meta_enabled,
        meta_pixel_id: localSettings.meta_pixel_id || null,
        meta_send_pixel: localSettings.meta_send_pixel,
        meta_send_capi: localSettings.meta_send_capi,
        meta_capi_access_token: localSettings.meta_capi_access_token || null,
        meta_test_event_code: localSettings.meta_test_event_code || null,
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveMappings = async () => {
    setIsSavingMappings(true);
    try {
      await onSaveMappings(localMappings);
    } finally {
      setIsSavingMappings(false);
    }
  };

  const handleResetMappings = async () => {
    setIsResetting(true);
    try {
      await onResetMappings();
      setLocalMappings(DEFAULT_MAPPINGS);
    } finally {
      setIsResetting(false);
    }
  };

  const handleSendTestEvent = async () => {
    if (!tenantId) return;
    setIsSendingTest(true);
    try {
      const testEventId = `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const { error } = await supabase.functions.invoke('meta-capi-track', {
        body: {
          tenant_id: tenantId,
          contact_id: '00000000-0000-0000-0000-000000000000',
          event_name: 'Lead',
          event_type: 'STANDARD',
          event_id: testEventId,
          is_test: true,
          custom_data: {
            pipeline_stage: 'test',
            test: true,
          },
          user_data: {
            email: 'test@example.com',
            phone: '+5215512345678',
            external_id: 'test-contact',
          },
        },
      });

      if (error) throw error;
      // Refetch event logs so the panel shows the new event
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['conversion-event-logs'] });
      }, 1500);
      toast.success('Evento de prueba enviado exitosamente. Revisa el historial de eventos abajo.');
    } catch (error) {
      toast.error(`Error al enviar evento de prueba: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  const addMapping = () => {
    setLocalMappings(prev => [...prev, {
      pipeline_stage: 'new_lead',
      meta_event_type: 'STANDARD',
      meta_event_name: 'Lead',
      send_pixel: true,
      send_capi: false,
      is_active: true,
      currency: 'MXN',
    }]);
  };

  const updateMapping = (index: number, updates: Partial<MetaEventMapping>) => {
    setLocalMappings(prev => prev.map((m, i) => i === index ? { ...m, ...updates } : m));
  };

  const removeMapping = (index: number) => {
    setLocalMappings(prev => prev.filter((_, i) => i !== index));
  };

  // Status indicators
  const pixelActive = localSettings.meta_enabled && localSettings.meta_send_pixel && hasPixelId;
  const capiActive = localSettings.meta_enabled && localSettings.meta_send_capi && capiTokenExists;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Facebook className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <CardTitle>Meta (Pixel + CAPI)</CardTitle>
            <CardDescription>
              Envía señales del pipeline a Meta para optimizar campañas.
            </CardDescription>
          </div>
          {/* Status indicators */}
          {localSettings.meta_enabled && (
            <div className="flex gap-2">
              <Badge variant={pixelActive ? "default" : "secondary"} className="text-xs">
                {pixelActive ? <Check className="h-3 w-3 mr-1" /> : null}
                Pixel {pixelActive ? "activo" : "inactivo"}
              </Badge>
              <Badge variant={capiActive ? "default" : "secondary"} className="text-xs">
                {capiActive ? <Check className="h-3 w-3 mr-1" /> : null}
                CAPI {capiActive ? "activo" : "inactivo"}
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Connection Section */}
        <div className="space-y-6">
          <h3 className="font-medium text-foreground">Conexión</h3>
          
          {/* Enable Meta toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="meta-enabled">Activar integración Meta</Label>
            </div>
            <Switch
              id="meta-enabled"
              checked={localSettings.meta_enabled}
              onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, meta_enabled: checked }))}
            />
          </div>

          {localSettings.meta_enabled && (
            <>
              {/* Warnings */}
              {!hasPixelId && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Meta está activado pero no hay Pixel ID configurado.</span>
                </div>
              )}
              {localSettings.meta_send_capi && !capiTokenExists && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>CAPI está activo pero no hay Access Token. Configúralo para poder guardar.</span>
                </div>
              )}

              {/* Pixel ID */}
              <div className="space-y-2">
                <Label htmlFor="pixel-id">Meta Pixel ID</Label>
                <Input
                  id="pixel-id"
                  value={localSettings.meta_pixel_id}
                  onChange={(e) => {
                    // Only allow numbers
                    const val = e.target.value.replace(/\D/g, '');
                    setLocalSettings(prev => ({ ...prev, meta_pixel_id: val }));
                  }}
                  placeholder="Ej: 1234567890123456"
                  className={`max-w-md ${hasPixelId && !pixelIdValid ? 'border-destructive' : ''}`}
                />
                {hasPixelId && !pixelIdValid && (
                  <p className="text-xs text-destructive">El Pixel ID debe ser un número de 10 a 20 dígitos.</p>
                )}
              </div>

              {/* Send Pixel toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="send-pixel">Enviar eventos por Pixel (Browser)</Label>
                </div>
                <Switch
                  id="send-pixel"
                  checked={localSettings.meta_send_pixel}
                  onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, meta_send_pixel: checked }))}
                />
              </div>

              {/* Send CAPI toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="send-capi">Enviar eventos por Conversions API (Server)</Label>
                </div>
                <Switch
                  id="send-capi"
                  checked={localSettings.meta_send_capi}
                  onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, meta_send_capi: checked }))}
                />
              </div>

              {localSettings.meta_send_capi && (
                <div className="space-y-2">
                  <Label htmlFor="capi-token">Access Token CAPI</Label>
                  <Input
                    id="capi-token"
                    type="password"
                    value={localSettings.meta_capi_access_token}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, meta_capi_access_token: e.target.value }))}
                    placeholder="Ingresa tu access token"
                    className="max-w-md"
                  />
                </div>
              )}

              {(localSettings.meta_send_capi || localSettings.meta_send_pixel) && (
                <div className="space-y-2">
                  <Label htmlFor="test-code">Test Event Code (opcional)</Label>
                  <Input
                    id="test-code"
                    value={localSettings.meta_test_event_code}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, meta_test_event_code: e.target.value }))}
                    placeholder="Ej: TEST12345"
                    className="max-w-md"
                  />
                  <p className="text-sm text-muted-foreground">
                    Para validar eventos en Events Manager sin afectar producción.
                  </p>
                </div>
              )}

              {/* Deduplication info */}
              {localSettings.meta_send_pixel && localSettings.meta_send_capi && (
                <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                  <Zap className="h-4 w-4 shrink-0" />
                  <span>Deduplicación activa: Pixel y CAPI comparten el mismo <code className="font-mono text-xs bg-blue-100 px-1 rounded">event_id</code> para evitar doble conteo en Meta.</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                {/* Test event button */}
                {localSettings.meta_send_capi && capiTokenExists && hasPixelId && (
                  <Button variant="outline" size="sm" onClick={handleSendTestEvent} disabled={isSendingTest}>
                    {isSendingTest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Enviar evento de prueba
                  </Button>
                )}
                <div className="flex-1" />
                <Button onClick={handleSaveSettings} disabled={isSavingSettings || !canSaveSettings()}>
                  {isSavingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar conexión
                </Button>
              </div>
            </>
          )}
        </div>

        {localSettings.meta_enabled && (
          <>
            <Separator />
            
            {/* Event Mapping Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">Mapeo de eventos</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleResetMappings} disabled={isResetting}>
                    {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                    Restaurar recomendado
                  </Button>
                  <Button variant="outline" size="sm" onClick={addMapping}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar mapeo
                  </Button>
                </div>
              </div>

              <MetaEventMappingTable 
                mappings={localMappings}
                onUpdate={updateMapping}
                onRemove={removeMapping}
              />

              <div className="pt-2 flex justify-end">
                <Button onClick={handleSaveMappings} disabled={isSavingMappings}>
                  {isSavingMappings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar mapeo
                </Button>
              </div>
            </div>

            <Separator />

            {/* Identifiers Section with data quality */}
            <div className="space-y-4">
              <h3 className="font-medium text-foreground">Identificadores y calidad de datos</h3>
              <p className="text-sm text-muted-foreground">
                NotyFive enviará user_data cuando sea posible. La calidad del matching en Meta depende de la completitud de datos de tus contactos.
              </p>
              
              <DataQualityIndicator />

              <div className="flex flex-wrap gap-3 pt-2">
                <Badge variant="outline" className="flex items-center gap-2 py-1.5 px-3">
                  <Phone className="h-3.5 w-3.5" />
                  <span>phone</span>
                  <Check className="h-3.5 w-3.5 text-green-500" />
                </Badge>
                <Badge variant="outline" className="flex items-center gap-2 py-1.5 px-3">
                  <Mail className="h-3.5 w-3.5" />
                  <span>email</span>
                  <Check className="h-3.5 w-3.5 text-green-500" />
                </Badge>
                <Badge variant="outline" className="flex items-center gap-2 py-1.5 px-3">
                  <Key className="h-3.5 w-3.5" />
                  <span>external_id</span>
                  <Check className="h-3.5 w-3.5 text-green-500" />
                </Badge>
                <Badge variant="outline" className="flex items-center gap-2 py-1.5 px-3">
                  <Globe className="h-3.5 w-3.5" />
                  <span>client_ip / user_agent</span>
                  <Check className="h-3.5 w-3.5 text-green-500" />
                </Badge>
                <Badge variant="outline" className="flex items-center gap-2 py-1.5 px-3">
                  <Facebook className="h-3.5 w-3.5" />
                  <span>fbp / fbc</span>
                  <Check className="h-3.5 w-3.5 text-green-500" />
                </Badge>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
