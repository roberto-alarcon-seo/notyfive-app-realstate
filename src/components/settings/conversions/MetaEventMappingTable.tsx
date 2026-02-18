import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MetaEventMapping } from "@/hooks/useConversionSettings";
import { Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PIPELINE_STAGES = [
  { value: 'new_lead', label: 'Nuevo Lead' },
  { value: 'interest_confirmed', label: 'Interés Confirmado' },
  { value: 'financial_validation', label: 'Validación Financiera' },
  { value: 'searching', label: 'En Búsqueda' },
  { value: 'visit_scheduled', label: 'Visita Agendada' },
  { value: 'visit_done', label: 'Visita Realizada' },
  { value: 'follow_up', label: 'Seguimiento' },
  { value: 'negotiation', label: 'Negociación' },
  { value: 'closed_won', label: 'Cerrado Ganado' },
  { value: 'closed_lost', label: 'Cerrado Perdido' },
];

const STANDARD_META_EVENTS = [
  { value: 'Lead', label: 'Lead' },
  { value: 'ViewContent', label: 'ViewContent' },
  { value: 'Schedule', label: 'Schedule' },
  { value: 'InitiateCheckout', label: 'InitiateCheckout' },
  { value: 'Purchase', label: 'Purchase' },
  { value: 'Custom', label: 'Custom (personalizado)' },
];

const CURRENCIES = [
  { value: 'MXN', label: 'MXN' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'COP', label: 'COP' },
  { value: 'ARS', label: 'ARS' },
  { value: 'CLP', label: 'CLP' },
  { value: 'PEN', label: 'PEN' },
  { value: 'BRL', label: 'BRL' },
];

interface MetaEventMappingTableProps {
  mappings: MetaEventMapping[];
  onUpdate: (index: number, updates: Partial<MetaEventMapping>) => void;
  onRemove: (index: number) => void;
}

export function MetaEventMappingTable({ mappings, onUpdate, onRemove }: MetaEventMappingTableProps) {
  const getEventDisplayValue = (mapping: MetaEventMapping) => {
    if (mapping.meta_event_type === 'CUSTOM') {
      return 'Custom';
    }
    return mapping.meta_event_name;
  };

  const handleEventChange = (index: number, value: string) => {
    if (value === 'Custom') {
      onUpdate(index, { meta_event_type: 'CUSTOM', meta_event_name: '' });
    } else {
      onUpdate(index, { meta_event_type: 'STANDARD', meta_event_name: value });
    }
  };

  if (mappings.length === 0) {
    return (
      <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
        No hay mapeos configurados. Haz clic en "Agregar mapeo" o "Restaurar recomendado" para comenzar.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[160px]">Stage</TableHead>
            <TableHead className="w-[160px]">Evento Meta</TableHead>
            <TableHead className="w-[100px]">Valor</TableHead>
            <TableHead className="w-[80px]">Moneda</TableHead>
            <TableHead className="w-[60px] text-center">Pixel</TableHead>
            <TableHead className="w-[60px] text-center">CAPI</TableHead>
            <TableHead className="w-[60px] text-center">Activo</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mappings.map((mapping, index) => (
            <TableRow key={index}>
              <TableCell>
                <Select
                  value={mapping.pipeline_stage}
                  onValueChange={(value) => onUpdate(index, { pipeline_stage: value })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STAGES.map((stage) => (
                      <SelectItem key={stage.value} value={stage.value}>
                        {stage.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <div className="space-y-2">
                  <Select
                    value={getEventDisplayValue(mapping)}
                    onValueChange={(value) => handleEventChange(index, value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STANDARD_META_EVENTS.map((event) => (
                        <SelectItem key={event.value} value={event.value}>
                          {event.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {mapping.meta_event_type === 'CUSTOM' && (
                    <Input
                      value={mapping.meta_event_name}
                      onChange={(e) => onUpdate(index, { meta_event_name: e.target.value })}
                      placeholder="Nombre del evento"
                      className="h-8"
                    />
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={mapping.event_value || ''}
                  onChange={(e) => onUpdate(index, { event_value: e.target.value ? Number(e.target.value) : null })}
                  placeholder="0.00"
                  className="h-9 w-[90px]"
                />
              </TableCell>
              <TableCell>
                <Select
                  value={mapping.currency || 'MXN'}
                  onValueChange={(value) => onUpdate(index, { currency: value })}
                >
                  <SelectTrigger className="h-9 w-[75px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-center">
                <Switch
                  checked={mapping.send_pixel}
                  onCheckedChange={(checked) => onUpdate(index, { send_pixel: checked })}
                />
              </TableCell>
              <TableCell className="text-center">
                <Switch
                  checked={mapping.send_capi}
                  onCheckedChange={(checked) => onUpdate(index, { send_capi: checked })}
                />
              </TableCell>
              <TableCell className="text-center">
                <Switch
                  checked={mapping.is_active}
                  onCheckedChange={(checked) => onUpdate(index, { is_active: checked })}
                />
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onRemove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
