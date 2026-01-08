import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Bot, RotateCcw, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface CopilotChatPanelProps {
  messages: CopilotMessage[];
  isLoading: boolean;
  uiPhase?: string;
  onSendMessage: (message: string) => void;
  onReset: () => void;
}

const QUICK_SUGGESTIONS = [
  { label: 'Campaña de Navidad', prompt: 'Quiero crear una campaña de promoción para Navidad' },
  { label: 'Reactivar clientes', prompt: 'Ayúdame a reactivar clientes inactivos de más de 60 días' },
  { label: 'Recordatorio de pago', prompt: 'Necesito enviar recordatorios de pago a clientes morosos' },
  { label: 'Nuevo producto', prompt: 'Quiero anunciar un nuevo producto a mis clientes VIP' },
];

const INITIAL_MESSAGE: CopilotMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `¡Hola! 👋 Soy tu copiloto de campañas de WhatsApp.

Puedo ayudarte a diseñar campañas completas:
• Analizar tus contactos y sugerir segmentos
• Crear copys personalizados para cada audiencia
• Validar que todo cumpla con las reglas de WhatsApp

**Cuéntame, ¿qué tipo de campaña quieres crear?**`,
  timestamp: new Date(),
};

export function CopilotChatPanel({ messages, isLoading, uiPhase, onSendMessage, onReset }: CopilotChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Combine initial message with conversation
  const allMessages = messages.length === 0 ? [INITIAL_MESSAGE] : messages;

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allMessages, isLoading]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleQuickSuggestion = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Copiloto de Campañas</h2>
              <p className="text-xs text-muted-foreground">Tu asistente de marketing IA</p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Nueva conversación
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4 max-w-2xl mx-auto">
          {allMessages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl p-4',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-card border border-border rounded-bl-sm'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-primary">Copiloto IA</span>
                  </div>
                )}
                <div className="text-sm whitespace-pre-line">{message.content}</div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-sm text-muted-foreground">Analizando datos...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick suggestions (only when no messages) */}
      {messages.length === 0 && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-warning" />
            <span className="text-xs text-muted-foreground">Sugerencias rápidas</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_SUGGESTIONS.map((suggestion) => (
              <Button
                key={suggestion.label}
                variant="outline"
                size="sm"
                onClick={() => handleQuickSuggestion(suggestion.prompt)}
              >
                {suggestion.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Input
            ref={inputRef}
            placeholder="Describe tu campaña..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="flex-1"
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={!input.trim() || isLoading}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
