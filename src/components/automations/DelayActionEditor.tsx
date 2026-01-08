import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, Timer, MessageSquareText, Calendar, Hourglass } from 'lucide-react';
import type { AutomationAction } from '@/hooks/useAutomations';

interface DelayActionEditorProps {
  action: AutomationAction;
  index: number;
  updateAction: (index: number, updates: Partial<AutomationAction>) => void;
  triggerType: string;
}

export function DelayActionEditor({ action, index, updateAction, triggerType }: DelayActionEditorProps) {
  const waitMode = (action.config.wait_mode as string) || 'fixed_time';
  
  const isEventTrigger = triggerType.startsWith('event.');
  const isMessageTrigger = triggerType.startsWith('message.');
  
  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <RadioGroup 
        value={waitMode} 
        onValueChange={(value) => updateAction(index, { 
          config: { ...action.config, wait_mode: value } 
        })}
        className="space-y-2"
      >
        <div 
          className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${
            waitMode === 'fixed_time' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
        >
          <RadioGroupItem value="fixed_time" id="wait-fixed" />
          <Label htmlFor="wait-fixed" className="cursor-pointer flex-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Esperar tiempo fijo</p>
                <p className="text-xs text-muted-foreground">Esperar una cantidad específica de tiempo</p>
              </div>
            </div>
          </Label>
        </div>
        
        <div 
          className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${
            waitMode === 'until_event' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
        >
          <RadioGroupItem value="until_event" id="wait-until" />
          <Label htmlFor="wait-until" className="cursor-pointer flex-1">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Esperar hasta que ocurra algo</p>
                <p className="text-xs text-muted-foreground">Continúa cuando suceda una condición específica</p>
              </div>
            </div>
          </Label>
        </div>
      </RadioGroup>
      
      {/* Fixed time configuration */}
      {waitMode === 'fixed_time' && (
        <div className="flex items-center gap-3 pl-4 pt-2">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Esperar</Label>
            <Input
              type="number"
              value={(action.config.value as number) || 5}
              onChange={(e) => updateAction(index, { 
                config: { ...action.config, value: parseInt(e.target.value) || 5 } 
              })}
              className="w-20"
              min={1}
            />
          </div>
          <div className="space-y-2 flex-1">
            <Label className="text-xs text-muted-foreground">Unidad</Label>
            <Select
              value={(action.config.unit as string) || 'minutes'}
              onValueChange={(value) => updateAction(index, { 
                config: { ...action.config, unit: value } 
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutos</SelectItem>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="days">Días</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      
      {/* Until event configuration */}
      {waitMode === 'until_event' && (
        <div className="space-y-4 pl-4 pt-2">
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground font-medium">Esperar hasta que:</Label>
            
            {/* Wait for response option */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-foreground">El cliente responda</span>
              </div>
              <Switch
                checked={(action.config.wait_for_response as boolean) ?? true}
                onCheckedChange={(checked) => updateAction(index, { 
                  config: { ...action.config, wait_for_response: checked } 
                })}
              />
            </div>
            
            {/* Wait for event option - only show for event triggers */}
            {isEventTrigger && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-foreground">El evento ocurra</span>
                </div>
                <Switch
                  checked={(action.config.wait_for_event as boolean) ?? false}
                  onCheckedChange={(checked) => updateAction(index, { 
                    config: { ...action.config, wait_for_event: checked } 
                  })}
                />
              </div>
            )}
            
            {/* Wait for window expiration option */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
              <div className="flex items-center gap-2">
                <Hourglass className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-foreground">Expire la ventana de WhatsApp</span>
              </div>
              <Switch
                checked={(action.config.wait_for_window_expire as boolean) ?? false}
                onCheckedChange={(checked) => updateAction(index, { 
                  config: { ...action.config, wait_for_window_expire: checked } 
                })}
              />
            </div>
          </div>
          
          {/* Maximum wait time (fallback) */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <Label className="text-xs text-muted-foreground font-medium">Tiempo máximo de espera (fallback)</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={(action.config.max_wait_value as number) || 4}
                onChange={(e) => updateAction(index, { 
                  config: { ...action.config, max_wait_value: parseInt(e.target.value) || 4 } 
                })}
                className="w-20"
                min={1}
              />
              <Select
                value={(action.config.max_wait_unit as string) || 'hours'}
                onValueChange={(value) => updateAction(index, { 
                  config: { ...action.config, max_wait_unit: value } 
                })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutos</SelectItem>
                  <SelectItem value="hours">Horas</SelectItem>
                  <SelectItem value="days">Días</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">como máximo</span>
            </div>
          </div>
          
          {/* Summary text */}
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {generateWaitSummary(action)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function generateWaitSummary(action: AutomationAction): string {
  const conditions: string[] = [];
  
  if (action.config.wait_for_response) conditions.push('el cliente responda');
  if (action.config.wait_for_event) conditions.push('ocurra el evento');
  if (action.config.wait_for_window_expire) conditions.push('expire la ventana de WhatsApp');
  
  if (conditions.length === 0) {
    return 'Selecciona al menos una condición de espera.';
  }
  
  const maxWaitValue = action.config.max_wait_value || 4;
  const maxWaitUnit = action.config.max_wait_unit === 'minutes' ? 'minutos' : 
                      action.config.max_wait_unit === 'days' ? 'días' : 'horas';
  
  return `Esperar hasta que ${conditions.join(' o ')} o hasta ${maxWaitValue} ${maxWaitUnit} como máximo.`;
}
