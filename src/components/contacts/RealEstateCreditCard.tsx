import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export interface RealEstateCreditData {
  re_budget_estimated_mxn: number | null;
  re_credit_type: 'INFONAVIT' | 'COFINAVIT' | 'BANK' | 'CASH' | 'MIXED' | null;
  re_credit_preapproved: boolean;
  re_down_payment_mxn: number | null;
  re_monthly_income_mxn: number | null;
}

interface RealEstateCreditCardProps {
  data: RealEstateCreditData;
  onChange: (data: RealEstateCreditData) => void;
}

const CREDIT_TYPE_LABELS: Record<string, string> = {
  INFONAVIT: 'Infonavit',
  COFINAVIT: 'Cofinavit',
  BANK: 'Bancario',
  CASH: 'Contado',
  MIXED: 'Mixto',
};

export function RealEstateCreditCard({ data, onChange }: RealEstateCreditCardProps) {
  const updateField = <K extends keyof RealEstateCreditData>(field: K, value: RealEstateCreditData[K]) => {
    onChange({ ...data, [field]: value });
  };

  const parseNumber = (value: string): number | null => {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : Math.max(0, parsed);
  };

  return (
    <div className="space-y-4">
      {/* Row 1: Presupuesto + Tipo de crédito */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="re_budget_estimated_mxn">Presupuesto estimado (MXN)</Label>
          <Input
            id="re_budget_estimated_mxn"
            type="number"
            min={0}
            placeholder="Ej. 2,500,000"
            value={data.re_budget_estimated_mxn ?? ''}
            onChange={(e) => updateField('re_budget_estimated_mxn', parseNumber(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="re_credit_type">Tipo de crédito</Label>
          <Select 
            value={data.re_credit_type ?? ''} 
            onValueChange={(v) => updateField('re_credit_type', v as RealEstateCreditData['re_credit_type'])}
          >
            <SelectTrigger id="re_credit_type">
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CREDIT_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Preaprobado toggle */}
      <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/50">
        <Label htmlFor="re_credit_preapproved" className="text-sm font-medium">Crédito preaprobado</Label>
        <Switch
          id="re_credit_preapproved"
          checked={data.re_credit_preapproved}
          onCheckedChange={(v) => updateField('re_credit_preapproved', v)}
        />
      </div>

      {/* Row 2: Enganche + Ingreso mensual */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="re_down_payment_mxn">Enganche disponible (MXN)</Label>
          <Input
            id="re_down_payment_mxn"
            type="number"
            min={0}
            placeholder="Ej. 500,000"
            value={data.re_down_payment_mxn ?? ''}
            onChange={(e) => updateField('re_down_payment_mxn', parseNumber(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="re_monthly_income_mxn">Ingreso mensual (MXN)</Label>
          <Input
            id="re_monthly_income_mxn"
            type="number"
            min={0}
            placeholder="Ej. 50,000"
            value={data.re_monthly_income_mxn ?? ''}
            onChange={(e) => updateField('re_monthly_income_mxn', parseNumber(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
