import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface LeadDiagnosticsData {
  pipeline_stage: string;
  re_block_reason: string | null;
  re_visit_outcome: string | null;
}

interface LeadDiagnosticsCardProps {
  data: LeadDiagnosticsData;
  onChange: (data: LeadDiagnosticsData) => void;
}

// Pipeline stages with labels
export const PIPELINE_STAGES = [
  { value: 'new_lead', label: 'Nuevo lead' },
  { value: 'interest_confirmed', label: 'Interés confirmado' },
  { value: 'financial_validation', label: 'Validación financiera' },
  { value: 'searching', label: 'En búsqueda' },
  { value: 'visit_scheduled', label: 'Visita agendada' },
  { value: 'visit_done', label: 'Visita realizada' },
  { value: 'follow_up', label: 'Seguimiento' },
  { value: 'negotiation', label: 'Oferta / Negociación' },
  { value: 'closed_won', label: 'Cerrado' },
  { value: 'closed_lost', label: 'Perdido' },
];

// Block reasons
export const BLOCK_REASONS = [
  { value: 'NO_RESPONSE', label: 'No responde' },
  { value: 'BUDGET_TOO_LOW', label: 'Presupuesto insuficiente' },
  { value: 'CREDIT_NOT_APPROVED', label: 'Crédito no aprobado' },
  { value: 'CREDIT_UNKNOWN_AMOUNT', label: 'No sabe monto de crédito' },
  { value: 'CREDIT_NOT_COMPATIBLE', label: 'Crédito no compatible' },
  { value: 'NO_PROPERTIES_MATCH', label: 'No hay propiedades compatibles' },
  { value: 'NOT_INTERESTED_AFTER_VISIT', label: 'No le gustó después de la visita' },
  { value: 'POSTPONED', label: 'Postergado' },
  { value: 'OTHER', label: 'Otro' },
];

// Visit outcomes
export const VISIT_OUTCOMES = [
  { value: 'LIKED', label: 'Le gustó' },
  { value: 'DIDNT_LIKE', label: 'No le gustó' },
  { value: 'NO_SHOW', label: 'No asistió' },
  { value: 'RESCHEDULE', label: 'Reagendar' },
  { value: 'PENDING', label: 'Pendiente' },
];

// Helper to get stage index
const getStageIndex = (stage: string) => {
  return PIPELINE_STAGES.findIndex(s => s.value === stage);
};

export function LeadDiagnosticsCard({ data, onChange }: LeadDiagnosticsCardProps) {
  const updateField = <K extends keyof LeadDiagnosticsData>(field: K, value: LeadDiagnosticsData[K]) => {
    onChange({ ...data, [field]: value });
  };

  const showBlockReason = data.pipeline_stage !== 'closed_won';
  const visitDoneIndex = getStageIndex('visit_done');
  const currentIndex = getStageIndex(data.pipeline_stage);
  const showVisitOutcome = currentIndex >= visitDoneIndex;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Diagnóstico y bloqueos del proceso de venta
      </p>

      {/* Block Reason - visible unless closed_won */}
      {showBlockReason && (
        <div className="space-y-2">
          <Label htmlFor="re_block_reason">Motivo de bloqueo</Label>
          <Select 
            value={data.re_block_reason || 'none'} 
            onValueChange={(v) => updateField('re_block_reason', v === 'none' ? null : v)}
          >
            <SelectTrigger id="re_block_reason">
              <SelectValue placeholder="Sin bloqueo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin bloqueo</SelectItem>
              {BLOCK_REASONS.map((reason) => (
                <SelectItem key={reason.value} value={reason.value}>
                  {reason.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            ¿Qué está bloqueando el avance de este lead?
          </p>
        </div>
      )}

      {/* Visit Outcome - visible from visit_done onwards */}
      {showVisitOutcome && (
        <div className="space-y-2">
          <Label htmlFor="re_visit_outcome">Resultado de visita</Label>
          <Select 
            value={data.re_visit_outcome || 'none'} 
            onValueChange={(v) => updateField('re_visit_outcome', v === 'none' ? null : v)}
          >
            <SelectTrigger id="re_visit_outcome">
              <SelectValue placeholder="Sin registrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin registrar</SelectItem>
              {VISIT_OUTCOMES.map((outcome) => (
                <SelectItem key={outcome.value} value={outcome.value}>
                  {outcome.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!showBlockReason && !showVisitOutcome && (
        <p className="text-sm text-muted-foreground py-4">
          No hay campos de diagnóstico disponibles para la etapa actual.
        </p>
      )}
    </div>
  );
}
