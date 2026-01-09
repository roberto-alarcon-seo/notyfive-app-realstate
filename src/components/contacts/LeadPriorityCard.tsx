import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp } from "lucide-react";

export interface LeadPriorityData {
  lead_score: number;
  lead_temperature: 'cold' | 'warm' | 'hot';
  engagement_level: 'low' | 'medium' | 'high';
  source: string;
  opt_in_status: 'unknown' | 'opt_in' | 'opt_out';
  next_action_at: string;
  last_interaction_at: string | null;
}

interface LeadPriorityCardProps {
  data: LeadPriorityData;
  onChange: (data: LeadPriorityData) => void;
}

export function LeadPriorityCard({ data, onChange }: LeadPriorityCardProps) {
  const updateField = <K extends keyof LeadPriorityData>(field: K, value: LeadPriorityData[K]) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <Card className="h-fit">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle>Prioridad del lead</CardTitle>
        </div>
        <CardDescription>Campos operativos para segmentar, priorizar y dar seguimiento</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Row 1: Lead Score + Temperatura */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="lead_score">Lead Score (0-100)</Label>
            <Input
              id="lead_score"
              type="number"
              min={0}
              max={100}
              value={data.lead_score}
              onChange={(e) => updateField('lead_score', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
            />
            <p className="text-xs text-muted-foreground">0 = sin calificar, 100 = máxima prioridad</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead_temperature">Temperatura</Label>
            <Select value={data.lead_temperature} onValueChange={(v) => updateField('lead_temperature', v as 'cold' | 'warm' | 'hot')}>
              <SelectTrigger id="lead_temperature">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cold">❄️ Frío</SelectItem>
                <SelectItem value="warm">🌡️ Tibio</SelectItem>
                <SelectItem value="hot">🔥 Caliente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Engagement + Opt-in */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="engagement_level">Engagement</Label>
            <Select value={data.engagement_level} onValueChange={(v) => updateField('engagement_level', v as 'low' | 'medium' | 'high')}>
              <SelectTrigger id="engagement_level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Bajo</SelectItem>
                <SelectItem value="medium">Medio</SelectItem>
                <SelectItem value="high">Alto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="opt_in_status">Estado Opt-in</Label>
            <Select value={data.opt_in_status} onValueChange={(v) => updateField('opt_in_status', v as 'unknown' | 'opt_in' | 'opt_out')}>
              <SelectTrigger id="opt_in_status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Desconocido</SelectItem>
                <SelectItem value="opt_in">✅ Aceptó</SelectItem>
                <SelectItem value="opt_out">❌ Opt-out</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Source */}
        <div className="space-y-2">
          <Label htmlFor="source">Fuente</Label>
          <Input
            id="source"
            placeholder="Meta Ads, Google Ads, Referido, Portal..."
            value={data.source}
            onChange={(e) => updateField('source', e.target.value)}
          />
        </div>

        {/* Next Action */}
        <div className="space-y-2">
          <Label htmlFor="next_action_at">Próxima acción</Label>
          <Input
            id="next_action_at"
            type="datetime-local"
            value={data.next_action_at}
            onChange={(e) => updateField('next_action_at', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Define el siguiente seguimiento</p>
        </div>

        {/* Last Interaction (Read-only display) */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Label className="text-sm text-muted-foreground">Última interacción</Label>
          <span className="text-sm text-muted-foreground">
            {data.last_interaction_at 
              ? new Date(data.last_interaction_at).toLocaleDateString('es-MX', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : '—'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
