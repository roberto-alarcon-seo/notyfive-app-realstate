import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Check, Sparkles, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SegmentProposal } from '@/hooks/useCampaignCopilot';

interface AssistantWizardStep1AudienceProps {
  proposals: SegmentProposal[];
  selectedSegment?: SegmentProposal;
  onSelectSegment: (segment: SegmentProposal) => void;
  hasProposals: boolean;
  onRequestProposals: () => void;
}

export function AssistantWizardStep1Audience({
  proposals,
  selectedSegment,
  onSelectSegment,
  hasProposals,
  onRequestProposals,
}: AssistantWizardStep1AudienceProps) {
  if (!hasProposals || proposals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <MessageSquare className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Describe tu campaña al Copiloto</h3>
        <p className="text-muted-foreground max-w-md mb-6">
          Cuéntale al Copiloto qué tipo de campaña quieres crear y te sugerirá audiencias personalizadas.
        </p>
        <Button onClick={onRequestProposals} variant="outline">
          <Sparkles className="w-4 h-4 mr-2" />
          Ir al chat
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Selecciona tu audiencia</h3>
        <p className="text-sm text-muted-foreground">
          Elige uno de los segmentos recomendados por el Copiloto IA
        </p>
      </div>

      <div className="grid gap-4">
        {proposals.map((segment, idx) => {
          const isSelected = selectedSegment?.name === segment.name;
          
          return (
            <Card
              key={idx}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                isSelected && 'ring-2 ring-primary bg-primary/5'
              )}
              onClick={() => onSelectSegment(segment)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h4 className="font-semibold text-base">{segment.name}</h4>
                      {segment.recommended && (
                        <Badge variant="default" className="text-xs">
                          <Sparkles className="w-3 h-3 mr-1" />
                          Recomendada por IA
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3">
                      {segment.description}
                    </p>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span className="font-medium text-foreground">
                          ~{segment.estimatedCount.toLocaleString()}
                        </span>
                        contactos
                      </div>
                      <Badge 
                        variant={
                          segment.saturationRisk === 'bajo' ? 'secondary' :
                          segment.saturationRisk === 'medio' ? 'outline' : 'destructive'
                        }
                        className="text-xs"
                      >
                        Riesgo: {segment.saturationRisk}
                      </Badge>
                    </div>

                    {/* Rules preview */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {segment.rules.slice(0, 3).map((rule, ruleIdx) => (
                        <Badge key={ruleIdx} variant="outline" className="text-xs font-normal">
                          {rule.field} {rule.operator} {rule.value}
                        </Badge>
                      ))}
                      {segment.rules.length > 3 && (
                        <Badge variant="outline" className="text-xs font-normal">
                          +{segment.rules.length - 3} más
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Selection indicator */}
                  <div className={cn(
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0',
                    isSelected ? 'bg-primary border-primary' : 'border-border'
                  )}>
                    {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-4 pt-4 border-t">
                    <Button className="w-full" size="sm" disabled>
                      <Check className="w-4 h-4 mr-2" />
                      Audiencia seleccionada
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Manual adjustment hint */}
      <p className="text-xs text-muted-foreground text-center">
        ¿Necesitas ajustar manualmente? Cambia a <span className="font-medium">modo manual</span> desde el encabezado.
      </p>
    </div>
  );
}
