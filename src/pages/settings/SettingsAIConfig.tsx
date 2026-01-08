import { useState, useEffect } from 'react';
import { Bot, Sparkles, Clock, MessageSquare, Shield, AlertTriangle, Settings2 } from 'lucide-react';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAISettings, useUpdateAISettings, useToggleAI, AITone } from '@/hooks/useAISettings';

const TONE_OPTIONS: { value: AITone; label: string; description: string }[] = [
  { value: 'cordial', label: 'Cordial', description: 'Amable y respetuoso' },
  { value: 'professional', label: 'Profesional', description: 'Formal y directo' },
  { value: 'friendly', label: 'Cercano', description: 'Casual y amigable' },
  { value: 'adaptive', label: 'Adaptable', description: 'Se adapta al cliente' },
];

const TIMEZONE_OPTIONS = [
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Buenos_Aires',
  'America/Sao_Paulo',
  'Europe/Madrid',
];

export default function SettingsAIConfig() {
  const { data: settings, isLoading } = useAISettings();
  const updateSettings = useUpdateAISettings();
  const toggleAI = useToggleAI();

  const [formData, setFormData] = useState({
    agent_name: 'Asistente',
    company_name: '',
    timezone: 'America/Mexico_City',
    response_delay_seconds: 2,
    tone: 'professional' as AITone,
    use_emojis: true,
    max_emojis_per_message: 2,
    never_reveal_ai: true,
    use_customer_name: true,
    escalate_on_frustration: true,
    escalate_on_no_answer: true,
    escalate_on_human_request: true,
    behavior_prompt: '',
    fallback_message: 'Enseguida te atiende un asesor.',
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        agent_name: settings.agent_name,
        company_name: settings.company_name || '',
        timezone: settings.timezone,
        response_delay_seconds: settings.response_delay_seconds,
        tone: settings.tone,
        use_emojis: settings.use_emojis,
        max_emojis_per_message: settings.max_emojis_per_message,
        never_reveal_ai: settings.never_reveal_ai,
        use_customer_name: settings.use_customer_name,
        escalate_on_frustration: settings.escalate_on_frustration,
        escalate_on_no_answer: settings.escalate_on_no_answer,
        escalate_on_human_request: settings.escalate_on_human_request,
        behavior_prompt: settings.behavior_prompt || '',
        fallback_message: settings.fallback_message || 'Enseguida te atiende un asesor.',
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate(formData);
  };

  if (isLoading) {
    return (
      <SettingsLayout title="Configuración IA" description="Configura el comportamiento y capacidades de tu agente inteligente" icon={Bot}>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout title="Configuración IA" description="Configura el comportamiento y capacidades de tu agente inteligente" icon={Bot}>
      <div className="space-y-6 max-w-4xl">
        {/* Tabs Navigation */}
        <Tabs defaultValue="configuracion" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="configuracion">Configuración</TabsTrigger>
            <TabsTrigger value="estilo">Estilo</TabsTrigger>
            <TabsTrigger value="reglas">Reglas</TabsTrigger>
          </TabsList>

          {/* Tab 1: Configuración */}
          <TabsContent value="configuracion" className="space-y-6">
            {/* Enable/Disable + Identity Row */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Asistente IA</CardTitle>
                      <CardDescription>
                        {settings?.enabled ? 'El asistente está activo y respondiendo mensajes' : 'El asistente está desactivado'}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={settings?.enabled ?? false}
                    onCheckedChange={(enabled) => toggleAI.mutate(enabled)}
                    disabled={toggleAI.isPending}
                  />
                </div>
              </CardHeader>
              <CardContent className="border-t pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre del Agente</Label>
                    <Input
                      value={formData.agent_name}
                      onChange={(e) => setFormData({ ...formData, agent_name: e.target.value })}
                      placeholder="Ej: Sofía Castellanos"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre de la Empresa</Label>
                    <Input
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      placeholder="Tu empresa"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Behavior Prompt - Main Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-muted-foreground" />
                  Instrucciones del Agente
                </CardTitle>
                <CardDescription>
                  Define toda la personalidad, comportamiento y reglas de tu agente de IA en un solo lugar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Zona Horaria</Label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    La IA usará esta zona horaria para mostrar fechas y horas correctas a tus clientes
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Instrucciones de Comportamiento</Label>
                    <span className="text-xs text-muted-foreground">
                      {formData.behavior_prompt.length} caracteres
                    </span>
                  </div>
                  <Textarea
                    value={formData.behavior_prompt}
                    onChange={(e) => setFormData({ ...formData, behavior_prompt: e.target.value })}
                    placeholder={`Ejemplo:

INFORMACIÓN DEL NEGOCIO:
- Somos un restaurante de comida mexicana
- Horario: Lunes a Sábado 12pm - 10pm
- Dirección: Av. Reforma 123, CDMX

SERVICIOS:
- Reservaciones para grupos de hasta 20 personas
- Servicio a domicilio en zona centro
- Eventos privados

ESPECIALIDADES:
- Tacos al pastor
- Enchiladas suizas
- Margaritas artesanales

PROMOCIONES VIGENTES:
- Martes: 2x1 en margaritas
- Jueves: 15% descuento en cenas familiares`}
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Mensaje de Escalamiento</Label>
                  <Input
                    value={formData.fallback_message}
                    onChange={(e) => setFormData({ ...formData, fallback_message: e.target.value })}
                    placeholder="Enseguida te atiende un asesor."
                  />
                  <p className="text-xs text-muted-foreground">
                    Este mensaje se envía cuando la IA no puede responder y necesita escalar a un humano
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Estilo */}
          <TabsContent value="estilo" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  Estilo de Comunicación
                </CardTitle>
                <CardDescription>
                  Define cómo se comunica tu agente con los clientes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Tono de Comunicación</Label>
                  <Select
                    value={formData.tone}
                    onValueChange={(value: AITone) => setFormData({ ...formData, tone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TONE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="font-medium">{opt.label}</span>
                          <span className="text-muted-foreground ml-2">— {opt.description}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <Label>Usar nombre del cliente</Label>
                    <p className="text-sm text-muted-foreground">
                      El agente llamará al cliente por su nombre cuando esté disponible
                    </p>
                  </div>
                  <Switch
                    checked={formData.use_customer_name}
                    onCheckedChange={(checked) => setFormData({ ...formData, use_customer_name: checked })}
                  />
                </div>

                <div className="p-4 rounded-lg border space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Usar Emojis</Label>
                      <p className="text-sm text-muted-foreground">
                        Incluir emojis en las respuestas para hacerlas más amigables
                      </p>
                    </div>
                    <Switch
                      checked={formData.use_emojis}
                      onCheckedChange={(checked) => setFormData({ ...formData, use_emojis: checked })}
                    />
                  </div>

                  {formData.use_emojis && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex justify-between items-center">
                        <Label className="text-sm">Máximo de emojis por mensaje</Label>
                        <span className="text-sm font-medium">{formData.max_emojis_per_message}</span>
                      </div>
                      <Slider
                        value={[formData.max_emojis_per_message]}
                        onValueChange={([value]) => setFormData({ ...formData, max_emojis_per_message: value })}
                        min={1}
                        max={5}
                        step={1}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  Tiempo de Respuesta
                </CardTitle>
                <CardDescription>
                  Configura el tiempo de espera antes de responder
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <Label>Retraso simulado</Label>
                      <p className="text-sm text-muted-foreground">
                        Simula tiempo de escritura para respuestas más naturales
                      </p>
                    </div>
                    <span className="text-2xl font-bold text-primary">{formData.response_delay_seconds}s</span>
                  </div>
                  <Slider
                    value={[formData.response_delay_seconds]}
                    onValueChange={([value]) => setFormData({ ...formData, response_delay_seconds: value })}
                    min={1}
                    max={10}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Un retraso de 2-4 segundos hace que las respuestas parezcan más humanas
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Reglas */}
          <TabsContent value="reglas" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  Reglas de Identidad
                </CardTitle>
                <CardDescription>
                  Configura cómo el agente maneja su identidad
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <Label>Nunca revelar que es IA</Label>
                    <p className="text-sm text-muted-foreground">
                      El agente siempre actuará como si fuera una persona real
                    </p>
                  </div>
                  <Switch
                    checked={formData.never_reveal_ai}
                    onCheckedChange={(checked) => setFormData({ ...formData, never_reveal_ai: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                  Reglas de Escalamiento
                </CardTitle>
                <CardDescription>
                  Define cuándo el agente debe transferir la conversación a un humano
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <Label>Escalar por frustración</Label>
                    <p className="text-sm text-muted-foreground">
                      Detecta cuando el cliente está molesto o frustrado y escala automáticamente
                    </p>
                  </div>
                  <Switch
                    checked={formData.escalate_on_frustration}
                    onCheckedChange={(checked) => setFormData({ ...formData, escalate_on_frustration: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <Label>Escalar sin respuesta</Label>
                    <p className="text-sm text-muted-foreground">
                      Cuando no encuentra información en la base de conocimiento
                    </p>
                  </div>
                  <Switch
                    checked={formData.escalate_on_no_answer}
                    onCheckedChange={(checked) => setFormData({ ...formData, escalate_on_no_answer: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <Label>Escalar por solicitud</Label>
                    <p className="text-sm text-muted-foreground">
                      Cuando el cliente pide explícitamente hablar con una persona
                    </p>
                  </div>
                  <Switch
                    checked={formData.escalate_on_human_request}
                    onCheckedChange={(checked) => setFormData({ ...formData, escalate_on_human_request: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button - Always visible */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={updateSettings.isPending} size="lg">
            {updateSettings.isPending ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </div>
      </div>
    </SettingsLayout>
  );
}
