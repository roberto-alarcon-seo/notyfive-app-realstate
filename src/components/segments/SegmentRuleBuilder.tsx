import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SegmentCondition,
  SegmentRules,
  OPERATORS_BY_TYPE,
  BASE_CONTACT_FIELDS,
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

export function SegmentRuleBuilder({
  rules,
  onChange,
  customFields,
  customFieldOptions,
}: SegmentRuleBuilderProps) {
  const allFields = [
    ...BASE_CONTACT_FIELDS.map((f) => ({
      key: f.key,
      label: f.label,
      dataType: f.dataType,
      fieldType: "base" as const,
    })),
    ...customFields.map((f) => ({
      key: f.key,
      label: f.name,
      dataType: f.data_type,
      fieldType: "custom" as const,
    })),
  ];

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

  const getOptionsForSelectField = (fieldKey: string) => {
    const customField = customFields.find((f) => f.key === fieldKey);
    if (!customField) return [];
    return customFieldOptions.filter((o) => o.field_id === customField.id);
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
              <SelectItem key={opt.id} value={opt.value}>
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
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Campo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_header_base" disabled className="text-xs text-muted-foreground font-semibold">
                  Campos base
                </SelectItem>
                {BASE_CONTACT_FIELDS.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {f.label}
                  </SelectItem>
                ))}
                {customFields.length > 0 && (
                  <>
                    <SelectItem value="_header_custom" disabled className="text-xs text-muted-foreground font-semibold mt-2">
                      Campos personalizados
                    </SelectItem>
                    {customFields.map((f) => (
                      <SelectItem key={f.key} value={f.key}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </>
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
