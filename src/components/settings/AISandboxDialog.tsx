import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, AlertTriangle, Sparkles, RotateCcw, Bug, Clock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useEffectiveTenantId } from '@/hooks/useEffectiveTenantId';

interface Msg { role: 'user' | 'assistant'; content: string; flags?: { escalar?: boolean; seguimiento?: boolean }; raw?: string; preAi?: string | null; matched?: string | null }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  settings: any;
}

export function AISandboxDialog({ open, onOpenChange, settings }: Props) {
  const tenantId = useEffectiveTenantId();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [simulateDelay, setSimulateDelay] = useState(false);
  const [lastDebug, setLastDebug] = useState<{ raw: string; clean: string; flags: any; chars: number; preAi?: string | null; matched?: string | null; appliedDelay?: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setLastDebug(null);
      setSystemPrompt('');
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const next: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-sandbox-test', {
        body: {
          settings,
          tenant_id: tenantId,
          simulate_delay: simulateDelay,
          messages: next.map(m => ({ role: m.role, content: m.content })),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = data as any;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: d.response || '(sin respuesta)',
        flags: d.detected,
        raw: d.raw,
        preAi: d.pre_ai_escalation || null,
        matched: d.matched_trigger || null,
      }]);
      if (d.system_prompt_preview) setSystemPrompt(d.system_prompt_preview);
      setLastDebug({
        raw: d.raw || '',
        clean: d.response || '',
        flags: d.detected || {},
        chars: (d.response || '').length,
        preAi: d.pre_ai_escalation || null,
        matched: d.matched_trigger || null,
        appliedDelay: d.applied_delay_seconds || 0,
      });
    } catch (e: any) {
      toast.error(e.message || 'Error en el sandbox');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('h-[85vh] flex flex-col p-0 gap-0 transition-[max-width]', debugOpen ? 'max-w-5xl' : 'max-w-2xl')}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Probar conversación
            </DialogTitle>
            <Button
              variant={debugOpen ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDebugOpen(v => !v)}
              className="gap-1"
            >
              <Bug className="h-3.5 w-3.5" />
              Debug
            </Button>
          </div>
          <DialogDescription>
            Simula un chat con la configuración actual sin afectar a clientes reales. Los cambios sin guardar también se aplican.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex min-h-0">
          <div className={cn('flex flex-col min-h-0', debugOpen ? 'flex-1 border-r' : 'flex-1')}>
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-6 py-4 space-y-4 relative"
              style={{
                backgroundColor: 'hsl(var(--muted))',
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'><g fill='none' stroke='hsl(279 65%25 49%25)' stroke-opacity='0.18' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'><circle cx='30' cy='30' r='10'/><path d='M65 22 q6 -10 12 0 t12 0 t12 0'/><circle cx='140' cy='35' r='5'/><path d='M155 25 l-6 12 l12 0 z'/><circle cx='25' cy='90' r='6'/><path d='M55 85 a12 12 0 0 0 24 0'/><circle cx='90' cy='95' r='14'/><path d='M82 95 a8 8 0 0 0 16 0'/><circle cx='150' cy='100' r='8'/><path d='M20 145 q8 -8 16 0 t16 0'/><circle cx='75' cy='150' r='5'/><path d='M110 145 l8 8 l-16 0 z'/><circle cx='155' cy='155' r='9'/><path d='M145 155 a10 10 0 0 0 20 0'/></g></svg>"), radial-gradient(circle at 25% 20%, hsl(var(--primary) / 0.10), transparent 45%), radial-gradient(circle at 80% 80%, hsl(var(--primary) / 0.08), transparent 45%)`,
                backgroundSize: '180px 180px, auto, auto',
                backgroundRepeat: 'repeat, no-repeat, no-repeat',
              }}
            >
          {messages.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12">
              <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Escribe el primer mensaje como si fueras un cliente.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              {m.role === 'assistant' && (
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={cn(
                'rounded-2xl px-4 py-2 max-w-[75%] text-sm whitespace-pre-wrap',
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-background border rounded-bl-sm'
              )}>
                {m.content}
                {m.flags && (m.flags.escalar || m.flags.seguimiento) && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {m.flags.escalar && <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="h-3 w-3" />ESCALAR</Badge>}
                    {m.flags.seguimiento && <Badge variant="secondary" className="text-[10px]">SEGUIMIENTO_HUMANO</Badge>}
                    {m.preAi && <Badge variant="outline" className="text-[10px]">pre-AI: {m.preAi}{m.matched ? ` · "${m.matched}"` : ''}</Badge>}
                  </div>
                )}
              </div>
              {m.role === 'user' && (
                <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 justify-start">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary animate-pulse" />
              </div>
              <div className="bg-background border rounded-2xl rounded-bl-sm px-4 py-2 text-sm text-muted-foreground">
                Pensando…
              </div>
            </div>
          )}
            </div>

            <div className="border-t p-4 flex gap-2 items-center">
          <div className="flex items-center gap-2 mr-2">
            <Switch id="sim-delay" checked={simulateDelay} onCheckedChange={setSimulateDelay} />
            <Label htmlFor="sim-delay" className="text-xs flex items-center gap-1 cursor-pointer">
              <Clock className="h-3 w-3" /> Delay
            </Label>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMessages([])} disabled={loading || messages.length === 0} title="Reiniciar">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Escribe como cliente…"
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={send} disabled={loading || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
            </div>
          </div>

          {debugOpen && (
            <aside className="w-80 shrink-0 overflow-y-auto bg-muted/30 p-4 space-y-4 text-xs">
              <DebugSection title="System Prompt (preview)">
                <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                  {systemPrompt || '— Envía un mensaje para generar el prompt —'}
                </pre>
              </DebugSection>

              {lastDebug && (
                <>
                  <DebugSection title="Última respuesta (cruda)">
                    <pre className="whitespace-pre-wrap font-mono text-[11px]">{lastDebug.raw || '—'}</pre>
                  </DebugSection>
                  <DebugSection title="Procesada (mostrada al cliente)">
                    <pre className="whitespace-pre-wrap font-mono text-[11px]">{lastDebug.clean || '—'}</pre>
                    <p className="mt-1 text-muted-foreground">{lastDebug.chars} chars (límite {settings.max_message_length || 320})</p>
                    {lastDebug.appliedDelay ? (
                      <p className="mt-1 text-muted-foreground">Delay aplicado: {lastDebug.appliedDelay}s</p>
                    ) : null}
                  </DebugSection>
                  <DebugSection title="Marcadores detectados">
                    <div className="flex flex-wrap gap-1">
                      {lastDebug.flags.escalar && <Badge variant="destructive" className="text-[10px]">ESCALAR</Badge>}
                      {lastDebug.flags.seguimiento && <Badge variant="secondary" className="text-[10px]">SEGUIMIENTO_HUMANO</Badge>}
                      {lastDebug.preAi && <Badge variant="outline" className="text-[10px]">pre-AI: {lastDebug.preAi}</Badge>}
                      {!lastDebug.flags.escalar && !lastDebug.flags.seguimiento && !lastDebug.preAi && (
                        <span className="text-muted-foreground">Ninguno</span>
                      )}
                    </div>
                    {lastDebug.matched && (
                      <p className="mt-1 text-muted-foreground">Trigger: "{lastDebug.matched}"</p>
                    )}
                  </DebugSection>
                </>
              )}

              <DebugSection title="Configuración aplicada">
                <ul className="space-y-1">
                  <DebugRow k="Región" v={settings.region_code} />
                  <DebugRow k="Idioma" v={settings.language} />
                  <DebugRow k="Trato" v={settings.formality} />
                  <DebugRow k="Tono" v={settings.tone} />
                  <DebugRow k="Emojis" v={settings.use_emojis ? `Sí (≤${settings.max_emojis_per_message})` : 'No'} />
                  <DebugRow k="Max chars" v={String(settings.max_message_length)} />
                  <DebugRow k="Oculta IA" v={settings.never_reveal_ai ? 'Sí' : 'No'} />
                </ul>
              </DebugSection>
            </aside>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DebugSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h4 className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">{title}</h4>
      <div className="rounded-md border bg-background p-2">{children}</div>
    </section>
  );
}

function DebugRow({ k, v }: { k: string; v: any }) {
  return (
    <li className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono">{v ?? '—'}</span>
    </li>
  );
}
