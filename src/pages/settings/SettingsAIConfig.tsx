import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, Sparkles, Clock, MessageSquare, Shield, AlertTriangle, Settings2, Wand2, Globe, UserCog } from 'lucide-react';
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
import { useAISettings, useUpdateAISettings, useToggleAI, AITone, BusinessHours, HandoffTriggers } from '@/hooks/useAISettings';
import { supabase } from '@/integrations/supabase/client';
import { AISandboxDialog } from '@/components/settings/AISandboxDialog';
import { PlayCircle } from 'lucide-react';

const TONE_OPTIONS: { value: AITone; label: string; description: string }[] = [
  { value: 'cordial', label: 'Cordial', description: 'Amable y respetuoso' },
  { value: 'professional', label: 'Profesional', description: 'Formal y directo' },
  { value: 'friendly', label: 'Cercano', description: 'Casual y amigable' },
  { value: 'adaptive', label: 'Adaptable', description: 'Se adapta al cliente' },
];

const REGION_OPTIONS = [
  { value: 'MX', label: 'México 🇲🇽' },
  { value: 'CO', label: 'Colombia 🇨🇴' },
  { value: 'PE', label: 'Perú 🇵🇪' },
  { value: 'AR', label: 'Argentina 🇦🇷' },
  { value: 'CL', label: 'Chile 🇨🇱' },
  { value: 'ES', label: 'España 🇪🇸' },
  { value: 'US', label: 'EE.UU. (hispano) 🇺🇸' },
];

const TIMEZONE_OPTIONS = [
  'America/Mexico_City', 'America/Bogota', 'America/Lima', 'America/Santiago',
  'America/Buenos_Aires', 'America/Sao_Paulo', 'Europe/Madrid',
];

const DAYS: { key: keyof BusinessHours['days']; label: string }[] = [
  { key: 'mon', label: 'Lun' }, { key: 'tue', label: 'Mar' }, { key: 'wed', label: 'Mié' },
  { key: 'thu', label: 'Jue' }, { key: 'fri', label: 'Vie' }, { key: 'sat', label: 'Sáb' },
  { key: 'sun', label: 'Dom' },
];

const DEFAULT_BH: BusinessHours = {
  enabled: false,
  timezone: 'America/Mexico_City',
  days: {
    mon: { open: '09:00', close: '19:00' }, tue: { open: '09:00', close: '19:00' },
    wed: { open: '09:00', close: '19:00' }, thu: { open: '09:00', close: '19:00' },
    fri: { open: '09:00', close: '19:00' }, sat: { open: '10:00', close: '14:00' },
    sun: null,
  },
};

const DEFAULT_TRIGGERS: HandoffTriggers = {
  on_price_negotiation: true,
  on_legal_question: true,
  on_schedule_visit: false,
  on_after_hours: true,
  on_max_turns: true,
};

function usePromptPresets() {
  return useQuery({
    queryKey: ['ai-prompt-presets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_prompt_presets' as any)
        .select('id, region_code, name, description, prompt')
        .order('region_code', { ascending: true });
      if (error) throw error;
      return ((data || []) as unknown) as Array<{ id: string; region_code: string; name: string; description: string | null; prompt: string }>;
    },
  });
}

export default function SettingsAIConfig() {
  const { data: settings, isLoading } = useAISettings();
  const updateSettings = useUpdateAISettings();
  const toggleAI = useToggleAI();
  const { data: presets = [] } = usePromptPresets();
  const [sandboxOpen, setSandboxOpen] = useState(false);

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
    escalate_on_no_answer: true,
    escalate_on_human_request: true,
    escalate_on_frustration: true,
    behavior_prompt: '',
    fallback_message: 'Enseguida te atiende un asesor.',
    region_code: 'MX',
    language: 'es' as 'es' | 'en' | 'pt',
    formality: 'tu' as 'tu' | 'usted' | 'vos',
    max_message_length: 320,
    max_ai_turns_before_handoff: 8,
    business_hours: DEFAULT_BH as BusinessHours,
    out_of_hours_message: 'Gracias por escribirnos. Nuestro horario es L-V 9am-7pm. Te respondemos en cuanto abramos.',
    handoff_triggers: DEFAULT_TRIGGERS as HandoffTriggers,
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
        escalate_on_no_answer: settings.escalate_on_no_answer,
        escalate_on_human_request: settings.escalate_on_human_request,
        escalate_on_frustration: (settings as any).escalate_on_frustration ?? true,
        behavior_prompt: settings.behavior_prompt || '',
        fallback_message: settings.fallback_message || 'Enseguida te atiende un asesor.',
        region_code: settings.region_code || 'MX',
        language: (settings.language || 'es') as any,
        formality: (settings.formality || 'tu') as any,
        max_message_length: settings.max_message_length || 320,
        max_ai_turns_before_handoff: settings.max_ai_turns_before_handoff || 8,
        business_hours: (settings.business_hours as BusinessHours) || DEFAULT_BH,
        out_of_hours_message: settings.out_of_hours_message || '',
        handoff_triggers: (settings.handoff_triggers as HandoffTriggers) || DEFAULT_TRIGGERS,
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate(formData as any);
  };

  const setBH = (patch: Partial<BusinessHours>) =>
    setFormData(p => ({ ...p, business_hours: { ...p.business_hours, ...patch } }));
  const setBHDay = (day: keyof BusinessHours['days'], v: { open: string; close: string } | null) =>
    setFormData(p => ({ ...p, business_hours: { ...p.business_hours, days: { ...p.business_hours.days, [day]: v } } }));
  const setTrigger = (key: keyof HandoffTriggers, val: boolean) =>
    setFormData(p => ({ ...p, handoff_triggers: { ...p.handoff_triggers, [key]: val } }));

  const filteredPresets = presets.filter(p => p.region_code === formData.region_code);

  if (isLoading) {
    return (
      <SettingsLayout title="Configuración IA" description="Configura el comportamiento de tu agente inteligente" icon={Bot}>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout title="Configuración IA" description="Configura el comportamiento de tu agente inteligente" icon={Bot}>
      <div className="space-y-6 max-w-4xl">
        {/* Master toggle always visible */}
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
        </Card>

        <Tabs defaultValue="identidad" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="identidad"><UserCog className="h-4 w-4 mr-1" />Identidad</TabsTrigger>
            <TabsTrigger value="instrucciones"><Settings2 className="h-4 w-4 mr-1" />Instrucciones</TabsTrigger>
            <TabsTrigger value="estilo"><MessageSquare className="h-4 w-4 mr-1" />Estilo</TabsTrigger>
            <TabsTrigger value="handoff"><AlertTriangle className="h-4 w-4 mr-1" />Handoff</TabsTrigger>
          </TabsList>

          {/* TAB 1: Identidad */}
          <TabsContent value="identidad" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Identidad del agente</CardTitle>
                <CardDescription>Cómo se presenta tu agente al cliente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre del agente</Label>
                    <Input value={formData.agent_name} onChange={(e) => setFormData({ ...formData, agent_name: e.target.value })} placeholder="Ej: Sofía" />
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre de la empresa</Label>
                    <Input value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} placeholder="Tu empresa" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <Label>Nunca revelar que es IA</Label>
                    <p className="text-sm text-muted-foreground">El agente actuará como una persona real</p>
                  </div>
                  <Switch checked={formData.never_reveal_ai} onCheckedChange={(c) => setFormData({ ...formData, never_reveal_ai: c })} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-muted-foreground" />Región e idioma</CardTitle>
                <CardDescription>La IA usará modismos, moneda y trato apropiados para esta región</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Región</Label>
                    <Select value={formData.region_code} onValueChange={(v) => setFormData({ ...formData, region_code: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{REGION_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Idioma de respuesta</Label>
                    <Select value={formData.language} onValueChange={(v: any) => setFormData({ ...formData, language: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="pt">Português</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Trato al cliente</Label>
                    <Select value={formData.formality} onValueChange={(v: any) => setFormData({ ...formData, formality: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tu">Tú (informal)</SelectItem>
                        <SelectItem value="usted">Usted (formal)</SelectItem>
                        <SelectItem value="vos">Vos (rioplatense)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Zona horaria</Label>
                  <Select value={formData.timezone} onValueChange={(v) => setFormData({ ...formData, timezone: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIMEZONE_OPTIONS.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: Instrucciones */}
          <TabsContent value="instrucciones" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Instrucciones del agente</CardTitle>
                <CardDescription>El núcleo del comportamiento. Describe el negocio, el flujo y las reglas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {filteredPresets.length > 0 && (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Wand2 className="h-4 w-4" />
                      Plantillas para {REGION_OPTIONS.find(r => r.value === formData.region_code)?.label}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {filteredPresets.map(p => (
                        <Button key={p.id} type="button" variant="outline" size="sm"
                          onClick={() => setFormData(s => ({ ...s, behavior_prompt: p.prompt }))}>
                          {p.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Instrucciones de comportamiento</Label>
                    <span className="text-xs text-muted-foreground">{formData.behavior_prompt.length} caracteres</span>
                  </div>
                  <Textarea
                    value={formData.behavior_prompt}
                    onChange={(e) => setFormData({ ...formData, behavior_prompt: e.target.value })}
                    placeholder="Describe el negocio, el flujo de atención, las reglas y el manejo de objeciones..."
                    rows={16}
                    className="font-mono text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: Estilo */}
          <TabsContent value="estilo" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Estilo de comunicación</CardTitle>
                <CardDescription>Tono, longitud y ritmo de los mensajes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Tono</Label>
                  <Select value={formData.tone} onValueChange={(v: AITone) => setFormData({ ...formData, tone: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TONE_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>
                          <span className="font-medium">{o.label}</span>
                          <span className="text-muted-foreground ml-2">— {o.description}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Largo máximo del mensaje</Label>
                    <span className="text-sm font-medium">{formData.max_message_length} caracteres</span>
                  </div>
                  <Slider
                    value={[formData.max_message_length]}
                    onValueChange={([v]) => setFormData({ ...formData, max_message_length: v })}
                    min={120} max={800} step={20}
                  />
                  <p className="text-xs text-muted-foreground">Recomendado para WhatsApp: 280–400 caracteres.</p>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <Label>Usar nombre del cliente</Label>
                    <p className="text-sm text-muted-foreground">El agente llamará al cliente por su nombre cuando lo tenga</p>
                  </div>
                  <Switch checked={formData.use_customer_name} onCheckedChange={(c) => setFormData({ ...formData, use_customer_name: c })} />
                </div>

                <div className="p-4 rounded-lg border space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Usar emojis</Label>
                      <p className="text-sm text-muted-foreground">Si lo desactivas, los emojis se eliminan automáticamente del mensaje</p>
                    </div>
                    <Switch checked={formData.use_emojis} onCheckedChange={(c) => setFormData({ ...formData, use_emojis: c })} />
                  </div>
                  {formData.use_emojis && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex justify-between items-center">
                        <Label className="text-sm">Máximo de emojis por mensaje</Label>
                        <span className="text-sm font-medium">{formData.max_emojis_per_message}</span>
                      </div>
                      <Slider
                        value={[formData.max_emojis_per_message]}
                        onValueChange={([v]) => setFormData({ ...formData, max_emojis_per_message: v })}
                        min={1} max={5} step={1}
                      />
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Label>Retraso antes de responder</Label>
                    </div>
                    <span className="text-2xl font-bold text-primary">{formData.response_delay_seconds}s</span>
                  </div>
                  <Slider
                    value={[formData.response_delay_seconds]}
                    onValueChange={([v]) => setFormData({ ...formData, response_delay_seconds: v })}
                    min={1} max={10} step={1}
                  />
                  <p className="text-xs text-muted-foreground">2–4 segundos suele sentirse más natural.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: Handoff */}
          <TabsContent value="handoff" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-muted-foreground" />Cuándo escalar a humano</CardTitle>
                <CardDescription>Define automáticamente cuándo la IA pasa la conversación a un asesor</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ToggleRow label="Cliente pide hablar con humano" desc='Detecta "asesor", "agente", "persona real"…'
                  checked={formData.escalate_on_human_request}
                  onChange={(c) => setFormData({ ...formData, escalate_on_human_request: c })} />
                <ToggleRow label="Cliente pide negociar precio" desc="Pasa la negociación al equipo comercial"
                  checked={formData.handoff_triggers.on_price_negotiation}
                  onChange={(c) => setTrigger('on_price_negotiation', c)} />
                <ToggleRow label="Pregunta legal o financiera específica" desc="Trámites notariales, simulación de crédito, escrituras"
                  checked={formData.handoff_triggers.on_legal_question}
                  onChange={(c) => setTrigger('on_legal_question', c)} />
                <ToggleRow label="Cliente pide agendar visita" desc="Si lo activas, la IA escala apenas se mencione una visita"
                  checked={formData.handoff_triggers.on_schedule_visit}
                  onChange={(c) => setTrigger('on_schedule_visit', c)} />
                <ToggleRow label="Sin respuesta en base de conocimiento" desc="Si la IA no encuentra el dato, escala con [ESCALAR]"
                  checked={formData.escalate_on_no_answer}
                  onChange={(c) => setFormData({ ...formData, escalate_on_no_answer: c })} />

                <div className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Escalar tras N turnos sin avance</Label>
                      <p className="text-sm text-muted-foreground">Evita que la IA se quede atrapada en bucle</p>
                    </div>
                    <Switch checked={formData.handoff_triggers.on_max_turns} onCheckedChange={(c) => setTrigger('on_max_turns', c)} />
                  </div>
                  {formData.handoff_triggers.on_max_turns && (
                    <div className="pt-2 border-t space-y-2">
                      <div className="flex justify-between items-center">
                        <Label className="text-sm">Máximo de turnos</Label>
                        <span className="text-sm font-medium">{formData.max_ai_turns_before_handoff}</span>
                      </div>
                      <Slider
                        value={[formData.max_ai_turns_before_handoff]}
                        onValueChange={([v]) => setFormData({ ...formData, max_ai_turns_before_handoff: v })}
                        min={3} max={20} step={1}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Mensaje de escalamiento</Label>
                  <Input value={formData.fallback_message} onChange={(e) => setFormData({ ...formData, fallback_message: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Se envía cuando la IA pasa al asesor humano.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Horario de atención humano</CardTitle>
                <CardDescription>Fuera de este horario la IA enviará el mensaje configurado</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <Label>Activar horario de atención</Label>
                    <p className="text-sm text-muted-foreground">Si está apagado, la IA responde 24/7</p>
                  </div>
                  <Switch checked={formData.business_hours.enabled} onCheckedChange={(c) => setBH({ enabled: c })} />
                </div>

                {formData.business_hours.enabled && (
                  <>
                    <div className="space-y-2">
                      {DAYS.map(d => {
                        const v = formData.business_hours.days[d.key];
                        return (
                          <div key={d.key} className="flex items-center gap-3 p-2 rounded border">
                            <div className="w-10 text-sm font-medium">{d.label}</div>
                            <Switch
                              checked={!!v}
                              onCheckedChange={(c) => setBHDay(d.key, c ? { open: '09:00', close: '19:00' } : null)}
                            />
                            {v ? (
                              <div className="flex items-center gap-2 flex-1">
                                <Input type="time" value={v.open} onChange={(e) => setBHDay(d.key, { ...v, open: e.target.value })} className="w-32" />
                                <span className="text-muted-foreground">–</span>
                                <Input type="time" value={v.close} onChange={(e) => setBHDay(d.key, { ...v, close: e.target.value })} className="w-32" />
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground flex-1">Cerrado</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-2">
                      <Label>Mensaje fuera de horario</Label>
                      <Textarea
                        value={formData.out_of_hours_message}
                        onChange={(e) => setFormData({ ...formData, out_of_hours_message: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4 border-t sticky bottom-0 bg-background py-3">
          <Button variant="outline" onClick={() => setSandboxOpen(true)} size="lg" className="mr-2">
            <PlayCircle className="h-4 w-4 mr-2" />
            Probar conversación
          </Button>
          <Button onClick={handleSave} disabled={updateSettings.isPending} size="lg">
            {updateSettings.isPending ? 'Guardando...' : 'Guardar configuración'}
          </Button>
        </div>
      </div>
      <AISandboxDialog open={sandboxOpen} onOpenChange={setSandboxOpen} settings={formData} />
    </SettingsLayout>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border">
      <div className="pr-4">
        <Label>{label}</Label>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}