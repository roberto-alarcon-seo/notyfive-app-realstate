import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Variable } from "lucide-react";
import { useCustomFields } from "@/hooks/useCustomFields";

interface VariableSelectorProps {
  onSelect: (variable: string) => void;
}

const baseContactFields = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'email', label: 'Email' },
  { key: 'pais', label: 'País' },
];

const campaignFields = [
  { key: 'campaña', label: 'Nombre de campaña' },
  { key: 'fecha_envio', label: 'Fecha de envío' },
];

const tenantFields = [
  { key: 'empresa', label: 'Nombre de empresa' },
];

export function VariableSelector({ onSelect }: VariableSelectorProps) {
  const { customFields } = useCustomFields();
  
  const handleSelect = (key: string, isCustom: boolean = false) => {
    const variable = isCustom ? `custom.${key}` : key;
    onSelect(`{{${variable}}}`);
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" type="button">
          <Variable className="w-4 h-4 mr-2" />
          Insertar variable
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto">
        <DropdownMenuLabel>Datos del contacto</DropdownMenuLabel>
        {baseContactFields.map((field) => (
          <DropdownMenuItem key={field.key} onClick={() => handleSelect(field.key)}>
            <code className="mr-2 text-xs bg-accent/20 px-1 rounded">{`{{${field.key}}}`}</code>
            <span className="text-muted-foreground">{field.label}</span>
          </DropdownMenuItem>
        ))}
        
        {customFields.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Campos personalizados</DropdownMenuLabel>
            {customFields.map((field) => (
              <DropdownMenuItem key={field.id} onClick={() => handleSelect(field.key, true)}>
                <code className="mr-2 text-xs bg-accent/20 px-1 rounded">{`{{custom.${field.key}}}`}</code>
                <span className="text-muted-foreground">{field.name}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Datos de campaña</DropdownMenuLabel>
        {campaignFields.map((field) => (
          <DropdownMenuItem key={field.key} onClick={() => handleSelect(field.key)}>
            <code className="mr-2 text-xs bg-accent/20 px-1 rounded">{`{{${field.key}}}`}</code>
            <span className="text-muted-foreground">{field.label}</span>
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Datos del tenant</DropdownMenuLabel>
        {tenantFields.map((field) => (
          <DropdownMenuItem key={field.key} onClick={() => handleSelect(field.key)}>
            <code className="mr-2 text-xs bg-accent/20 px-1 rounded">{`{{${field.key}}}`}</code>
            <span className="text-muted-foreground">{field.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
