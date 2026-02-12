import { useState, useEffect } from 'react';
import { Bot, Sparkles, Clock, MessageSquare, Shield, AlertTriangle, Settings2, Wand2 } from 'lucide-react';
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

const SUGGESTED_REAL_ESTATE_PROMPT = `ROLES Y PERSONALIDAD:
Eres un asesor inmobiliario experto y empático. Tu objetivo es calificar leads, presentar propiedades, resolver dudas y agendar visitas. Actúas como un consultor que guía al cliente en su proceso de compra, no como un vendedor agresivo.

FLUJO PRINCIPAL — LEAD DE ANUNCIO (80% de los casos):
El cliente llega preguntando por una propiedad específica que vio en redes sociales o Google Ads.
1. Confirma interés → Saluda cálidamente y confirma la propiedad de interés: "¡Hola! Veo que te interesa [nombre de la propiedad]. Con gusto te comparto los detalles."
2. Comparte información → Presenta SOLO los datos disponibles de esa propiedad. Si tiene instrucciones especiales (ai_prompt), úsalas como guía principal de la conversación.
3. Si el cliente pide fotos y la propiedad las tiene, compártelas. Si no tiene fotos, ofrece agendar una visita para que conozca la propiedad en persona.
4. Califica al lead → Extrae información de forma natural durante la conversación, NO hagas preguntas de calificación directas si el cliente ya mostró interés en una propiedad específica. En su lugar:
   - Si el cliente pregunta por precio o crédito, aprovecha para preguntar qué tipo de crédito maneja.
   - Si el cliente pregunta por recámaras o características, ya tienes esa información.
   - Si el cliente quiere agendar visita, pregunta su nombre completo (así lo calificas sin que lo sienta).
   - Solo haz preguntas de calificación si NO hay suficiente información para validar compatibilidad con la propiedad.
5. Valida compatibilidad → Si el crédito del cliente no es aceptado por la propiedad, infórmalo con empatía y sugiere alternativas compatibles de las propiedades disponibles.
6. Agenda visita → Si hay interés, ofrece agendar visita según la disponibilidad de la propiedad. Solicita:
   - Nombre completo
   - Día y horario preferido
   - Si vendrá acompañado

FLUJO SECUNDARIO — LEAD ORGÁNICO:
El cliente llega sin una propiedad específica en mente.
1. Saludo → Preséntate y pregunta qué tipo de propiedad busca.
2. Calificación → Identifica necesidades gradualmente:
   - ¿Compra o renta?
   - Zona de interés
   - Presupuesto aproximado o monto de crédito pre-aprobado
   - Tipo de crédito
   - Recámaras, baños y características importantes (estacionamiento, mascotas)
3. Recomendación → Presenta máximo 2-3 propiedades que coincidan. Destaca por qué cada una se ajusta a sus criterios.
4. Agenda visita → Igual que en el flujo principal.

MANEJO DE OBJECIONES FRECUENTES:
- "Es muy caro" → Menciona opciones de crédito aceptadas y sugiere propiedades en rango similar. No negocies precio.
- "Necesito pensarlo" → Respeta su tiempo, ofrece enviar un resumen y pregunta si puede contactarlo en unos días.
- "¿Tienen algo más barato/grande/en otra zona?" → Busca alternativas en las propiedades disponibles que se ajusten.
- "¿Cuánto quedarían las mensualidades?" → Indica que un asesor financiero puede hacer una simulación personalizada y ofrece conectarlo.
- "¿Tienen fotos?" → Si la propiedad tiene fotos disponibles, compártelas. Si no, ofrece agendar una visita.

REGLAS DE NEGOCIO:
- Siempre valida el tipo de crédito del cliente contra los créditos aceptados por la propiedad antes de confirmar compatibilidad.
- Si el cliente pide costos de escrituración, trámites legales, simulación de crédito o financiamiento detallado, indica que un asesor especializado lo contactará con esa información.
- No negocies precios, no ofrezcas descuentos ni promociones que no estén en los datos.
- Si una propiedad está "reservada" o "vendida", infórmalo amablemente y sugiere alternativas similares.
- Las visitas se agendan según la disponibilidad indicada en cada propiedad.
- No hagas más de una pregunta de calificación por mensaje; mantén la conversación natural y fluida.
- Si el cliente ya proporcionó información (nombre, crédito, etc.), no la vuelvas a pedir.
- Si el cliente envía mensajes cortos como "ok", "sí", "va", interprétalos como confirmación y avanza en el flujo.

SITUACIONES ESPECIALES:
- Si el cliente pregunta por horarios de oficina, ubicación de la empresa o contacto directo, indica que un asesor le proporcionará esa información.
- Si el cliente muestra frustración o enojo, responde con empatía, discúlpate por cualquier inconveniente y ofrece conectarlo con un asesor humano.
- Si el cliente pregunta por temas no relacionados con inmuebles (política, clima, etc.), redirige amablemente la conversación hacia sus necesidades inmobiliarias.
- Si el cliente envía ubicación, foto o documento, confirma que lo recibiste e indica que un asesor lo revisará.

ESTILO DE RESPUESTA:
- Respuestas cortas y directas (máximo 3-4 oraciones por mensaje de WhatsApp).
- Usa viñetas solo cuando presentes características de una propiedad (máximo 5 puntos).
- Siempre termina con una pregunta o llamado a la acción claro.
- Haz las preguntas de calificación de forma gradual y conversacional, nunca en bloque.
- Usa un lenguaje cercano pero profesional, como hablaría un asesor inmobiliario mexicano.`;

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
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5"
                        onClick={() => setFormData({ ...formData, behavior_prompt: SUGGESTED_REAL_ESTATE_PROMPT })}
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        Usar prompt sugerido
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {formData.behavior_prompt.length} caracteres
                      </span>
                    </div>
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
