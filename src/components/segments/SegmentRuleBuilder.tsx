import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SegmentCondition,
  SegmentRules,
  OPERATORS_BY_TYPE,
  BASE_CONTACT_FIELDS,
  UNIVERSAL_FIXED_FIELDS,
  REAL_ESTATE_FIXED_FIELDS,
} from "@/types/segments";

interface CustomField {
  id: string;
  key: string;
  name: string;
  data_type: string;
}

interface CustomFieldOption {
  id: string;
  field_id: string;
  label: string;
  value: string;
}

interface SegmentRuleBuilderProps {
  rules: SegmentRules;
  onChange: (rules: SegmentRules) => void;
  customFields: CustomField[];
  customFieldOptions: CustomFieldOption[];
}

// Field category types for organized display
interface FieldDef {
  key: string;
  label: string;
  dataType: string;
  fieldType: "base" | "system" | "custom";
  options?: string[];
}

export function SegmentRuleBuilder({
  rules,
  onChange,
  customFields,
  customFieldOptions,
}: SegmentRuleBuilderProps) {
  // Organize fields by category
  const baseFields: FieldDef[] = BASE_CONTACT_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    dataType: f.dataType,
    fieldType: "base" as const,
    options: (f as any).options,
  }));

  const universalFields: FieldDef[] = UNIVERSAL_FIXED_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    dataType: f.dataType,
    fieldType: "system" as const,
    options: (f as any).options,
  }));

  const realEstateFields: FieldDef[] = REAL_ESTATE_FIXED_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    dataType: f.dataType,
    fieldType: "system" as const,
    options: (f as any).options,
  }));

  const customFieldsDef: FieldDef[] = customFields.map((f) => ({
    key: f.key,
    label: f.name,
    dataType: f.data_type,
    fieldType: "custom" as const,
  }));

  // All fields combined for lookup
  const allFields = [...baseFields, ...universalFields, ...realEstateFields, ...customFieldsDef];

  const addCondition = () => {
    const newCondition: SegmentCondition = {
      id: crypto.randomUUID(),
      field: "name",
      fieldType: "base",
      dataType: "short_text",
      operator: "contains",
      value: "",
    };

    onChange({
      ...rules,
      conditions: [...rules.conditions, newCondition],
    });
  };

  const removeCondition = (id: string) => {
    onChange({
      ...rules,
      conditions: rules.conditions.filter((c) => c.id !== id),
    });
  };

  const updateCondition = (id: string, updates: Partial<SegmentCondition>) => {
    onChange({
      ...rules,
      conditions: rules.conditions.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    });
  };

  const handleFieldChange = (conditionId: string, fieldKey: string) => {
    const field = allFields.find((f) => f.key === fieldKey);
    if (!field) return;

    const operators = OPERATORS_BY_TYPE[field.dataType] || OPERATORS_BY_TYPE.short_text;
    const defaultOperator = operators[0]?.value || "equals";

    updateCondition(conditionId, {
      field: fieldKey,
      fieldType: field.fieldType,
      dataType: field.dataType,
      operator: defaultOperator,
      value: "",
    });
  };

  const getOperatorsForCondition = (condition: SegmentCondition) => {
    return OPERATORS_BY_TYPE[condition.dataType] || OPERATORS_BY_TYPE.short_text;
  };

  const getOptionsForSelectField = (fieldKey: string): { value: string; label: string }[] => {
    // First check if it's a system field with predefined options
    const systemField = allFields.find((f) => f.key === fieldKey && f.options);
    if (systemField && systemField.options) {
      return systemField.options.map((opt: string) => ({
        value: opt,
        label: formatOptionLabel(opt),
      }));
    }

    // Otherwise check custom fields
    const customField = customFields.find((f) => f.key === fieldKey);
    if (!customField) return [];
    return customFieldOptions
      .filter((o) => o.field_id === customField.id)
      .map((o) => ({ value: o.value, label: o.label }));
  };

  const formatOptionLabel = (value: string): string => {
    // Format system option values to readable labels
    const labelMap: Record<string, string> = {
      // Temperature
      cold: "Frío",
      warm: "Tibio",
      hot: "Caliente",
      // Engagement
      low: "Bajo",
      medium: "Medio",
      high: "Alto",
      // Opt-in status
      unknown: "Desconocido",
      opt_in: "Opt-in",
      opt_out: "Opt-out",
      // Contact status
      active: "Activo",
      inactive: "Inactivo",
      archived: "Archivado",
      // Credit types
      INFONAVIT: "INFONAVIT",
      COFINAVIT: "COFINAVIT",
      BANK: "Bancario",
      CASH: "Contado",
      FOVISSSTE: "Fovissste",
      ISFAM: "ISFAM",
      CFE: "CFE",
      // RE Reason
      BUY: "Comprar",
      RENT: "Rentar",
      INVEST: "Invertir",
      MOVE: "Mudarse",
      UPGRADE: "Mejorar",
      DOWNSIZE: "Reducir",
      OTHER: "Otro",
      // RE Situation
      RENTING: "Rentando",
      OWNING: "Propietario",
      LIVING_WITH_FAMILY: "Vive con familia",
      LOOKING_TO_MOVE: "Buscando mudarse",
    };
    return labelMap[value] || value;
  };

  const renderValueInput = (condition: SegmentCondition) => {
    const { operator, dataType, field } = condition;

    // Some operators don't need a value
    if (["is_empty", "is_not_empty", "is_true", "is_false"].includes(operator)) {
      return null;
    }

    if (dataType === "boolean") {
      return null;
    }

    if (dataType === "select") {
      const options = getOptionsForSelectField(field);
      return (
        <Select
          value={condition.value as string}
          onValueChange={(val) => updateCondition(condition.id, { value: val })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Seleccionar..." />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (dataType === "date" || dataType === "datetime") {
      if (["last_days", "next_days"].includes(operator)) {
        return (
          <Input
            type="number"
            placeholder="Días"
            value={condition.value as string}
            onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
            className="w-[100px]"
          />
        );
      }
      return (
        <Input
          type="date"
          value={condition.value as string}
          onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
          className="w-[180px]"
        />
      );
    }

    if (dataType === "number" || dataType === "decimal") {
      return (
        <Input
          type="number"
          placeholder="Valor"
          value={condition.value as string}
          onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
          className="w-[150px]"
        />
      );
    }

    return (
      <Input
        type="text"
        placeholder="Valor"
        value={condition.value as string}
        onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
        className="w-[200px]"
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Reglas del segmento</Label>
        <Select
          value={rules.logic}
          onValueChange={(val: "AND" | "OR") => onChange({ ...rules, logic: val })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">Cumplir TODAS (Y)</SelectItem>
            <SelectItem value="OR">Cumplir ALGUNA (O)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {rules.conditions.map((condition, index) => (
          <div key={condition.id} className="flex items-center gap-2 flex-wrap">
            {index > 0 && (
              <span className="text-sm text-muted-foreground w-8">
                {rules.logic === "AND" ? "Y" : "O"}
              </span>
            )}
            {index === 0 && <span className="w-8" />}

            <Select
              value={condition.field}
              onValueChange={(val) => handleFieldChange(condition.id, val)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Campo" />
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                {/* Base fields */}
                <SelectGroup>
                  <SelectLabel className="text-xs text-muted-foreground font-semibold">
                    Campos base
                  </SelectLabel>
                  {baseFields.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectGroup>

                {/* Universal/Lead fields */}
                <SelectGroup>
                  <SelectLabel className="text-xs text-muted-foreground font-semibold">
                    Campos de lead
                  </SelectLabel>
                  {universalFields.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectGroup>

                {/* Real Estate fields */}
                <SelectGroup>
                  <SelectLabel className="text-xs text-muted-foreground font-semibold">
                    Real Estate
                  </SelectLabel>
                  {realEstateFields.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectGroup>

                {/* Custom fields */}
                {customFieldsDef.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-xs text-muted-foreground font-semibold">
                      Campos personalizados
                    </SelectLabel>
                    {customFieldsDef.map((f) => (
                      <SelectItem key={f.key} value={f.key}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>

            <Select
              value={condition.operator}
              onValueChange={(val) => updateCondition(condition.id, { operator: val })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Operador" />
              </SelectTrigger>
              <SelectContent>
                {getOperatorsForCondition(condition).map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {renderValueInput(condition)}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeCondition(condition.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={addCondition}>
        <Plus className="w-4 h-4 mr-2" />
        Agregar regla
      </Button>

      {rules.conditions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sin reglas, el segmento incluirá todos los contactos.
        </p>
      )}
    </div>
  );
}
