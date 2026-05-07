import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, AlertTriangle, Sparkles, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Msg { role: 'user' | 'assistant'; content: string; flags?: { escalar?: boolean; seguimiento?: boolean } }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  settings: any;
}

export function AISandboxDialog({ open, onOpenChange, settings }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setMessages([]);
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
          messages: next.map(m => ({ role: m.role, content: m.content })),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: (data as any).response || '(sin respuesta)',
        flags: (data as any).detected,
      }]);
    } catch (e: any) {
      toast.error(e.message || 'Error en el sandbox');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Probar conversación
          </DialogTitle>
          <DialogDescription>
            Simula un chat con la configuración actual sin afectar a clientes reales. Los cambios sin guardar también se aplican.
          </DialogDescription>
        </DialogHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-muted/20">
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
      </DialogContent>
    </Dialog>
  );
}
