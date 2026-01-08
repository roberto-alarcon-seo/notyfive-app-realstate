import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, Check, Link2 } from 'lucide-react';

interface VariableMapping {
  source: 'base' | 'custom' | 'fixed';
  field: string;
  field_key?: string;
  fixed_value?: string;
}

interface VariableMappingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variables: string[];
  currentMapping: Record<string, VariableMapping>;
  customFields: Array<{ key: string; name: string }>;
  onSave: (mapping: Record<string, VariableMapping>) => void;
}

const BASE_FIELDS = [
  { key: 'name', label: 'Nombre' },
  { key: 'email', label: 'Correo electrónico' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'country', label: 'País' },
];

export function VariableMappingModal({
  open,
  onOpenChange,
  variables,
  currentMapping,
  customFields,
  onSave,
}: VariableMappingModalProps) {
  const [mapping, setMapping] = useState<Record<string, VariableMapping>>({});

  // Initialize mapping from props
  useEffect(() => {
    if (open) {
      const initialMapping: Record<string, VariableMapping> = {};
      for (const variable of variables) {
        if (currentMapping[variable]) {
          initialMapping[variable] = currentMapping[variable];
        } else {
          // Try auto-mapping
          const varLower = variable.toLowerCase();
          const baseField = BASE_FIELDS.find(f => 
            f.key === varLower || 
            (varLower === 'nombre' && f.key === 'name') ||
            (varLower === 'correo' && f.key === 'email') ||
            (varLower === 'telefono' && f.key === 'phone')
          );
          
          if (baseField) {
            initialMapping[variable] = { source: 'base', field: baseField.key };
          } else {
            const customField = customFields.find(cf => 
              cf.key.toLowerCase() === varLower || cf.name.toLowerCase() === varLower
            );
            if (customField) {
              initialMapping[variable] = { 
                source: 'custom', 
                field: customField.name, 
                field_key: customField.key 
              };
            }
          }
        }
      }
      setMapping(initialMapping);
    }
  }, [open, variables, currentMapping, customFields]);

  const handleFieldChange = (variable: string, value: string) => {
    if (value === '__none__') {
      const newMapping = { ...mapping };
      delete newMapping[variable];
      setMapping(newMapping);
      return;
    }

    if (value.startsWith('base:')) {
      const field = value.replace('base:', '');
      setMapping(prev => ({
        ...prev,
        [variable]: { source: 'base', field }
      }));
    } else if (value.startsWith('custom:')) {
      const key = value.replace('custom:', '');
      const customField = customFields.find(cf => cf.key === key);
      if (customField) {
        setMapping(prev => ({
          ...prev,
          [variable]: { source: 'custom', field: customField.name, field_key: customField.key }
        }));
      }
    }
  };

  const getSelectValue = (variable: string): string => {
    const m = mapping[variable];
    if (!m) return '__none__';
    if (m.source === 'base') return `base:${m.field}`;
    if (m.source === 'custom') return `custom:${m.field_key}`;
    return '__none__';
  };

  const unmappedCount = variables.filter(v => !mapping[v]).length;
  const allMapped = unmappedCount === 0;

  const handleSave = () => {
    onSave(mapping);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Mapeo de variables
          </DialogTitle>
          <DialogDescription>
            Asigna cada variable del mensaje a un campo del contacto
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
          {variables.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay variables en el mensaje
            </p>
          ) : (
            variables.map((variable) => {
              const isMapped = !!mapping[variable];
              
              return (
                <div key={variable} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-32">
                    <Badge 
                      variant={isMapped ? "default" : "destructive"}
                      className="font-mono text-xs"
                    >
                      {`{{${variable}}}`}
                    </Badge>
                  </div>
                  
                  <div className="flex-1">
                    <Select
                      value={getSelectValue(variable)}
                      onValueChange={(value) => handleFieldChange(variable, value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona un campo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-muted-foreground">Sin mapear</span>
                        </SelectItem>
                        
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          Campos base
                        </div>
                        {BASE_FIELDS.map((field) => (
                          <SelectItem key={field.key} value={`base:${field.key}`}>
                            {field.label}
                          </SelectItem>
                        ))}
                        
                        {customFields.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                              Campos personalizados
                            </div>
                            {customFields.map((field) => (
                              <SelectItem key={field.key} value={`custom:${field.key}`}>
                                {field.name}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-6">
                    {isMapped ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!allMapped && variables.length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
            <span className="text-destructive">
              {unmappedCount} variable(s) sin mapear. El envío podría fallar.
            </span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Guardar mapeo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
