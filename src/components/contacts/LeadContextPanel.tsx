import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, 
  Flame, 
  Thermometer, 
  Snowflake,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Calendar,
  MessageSquare
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface LeadContextPanelProps {
  data: {
    lead_score: number;
    lead_temperature: 'cold' | 'warm' | 'hot';
    engagement_level: 'low' | 'medium' | 'high';
    opt_in_status: 'unknown' | 'opt_in' | 'opt_out';
    next_action_at: string | null;
    last_interaction_at: string | null;
    re_budget_estimated_mxn: number | null;
    re_credit_preapproved: boolean;
    re_credit_type: string | null;
  };
}

export function LeadContextPanel({ data }: LeadContextPanelProps) {
  const getTemperatureDisplay = () => {
    switch (data.lead_temperature) {
      case 'hot':
        return {
          icon: Flame,
          label: 'Caliente',
          color: 'text-red-400',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30'
        };
      case 'warm':
        return {
          icon: Thermometer,
          label: 'Tibio',
          color: 'text-amber-400',
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/30'
        };
      default:
        return {
          icon: Snowflake,
          label: 'Frío',
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/30'
        };
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-muted-foreground';
  };

  const getProgressColor = (score: number) => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-muted-foreground';
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getCreditTypeLabel = (type: string | null) => {
    const labels: Record<string, string> = {
      'INFONAVIT': 'Infonavit',
      'COFINAVIT': 'Cofinavit',
      'BANK': 'Bancario',
      'CASH': 'Contado',
      'MIXED': 'Mixto',
    };
    return type ? labels[type] || type : '—';
  };

  const temp = getTemperatureDisplay();
  const TempIcon = temp.icon;

  return (
    <div className="w-72 shrink-0 border-l border-border bg-muted/20 hidden lg:block">
      <div className="p-4 space-y-4">
        {/* Lead Score */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5" />
              Lead Score
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-end gap-2 mb-2">
              <span className={`text-3xl font-bold ${getScoreColor(data.lead_score)}`}>
                {data.lead_score}
              </span>
              <span className="text-muted-foreground text-sm mb-1">/ 100</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${getProgressColor(data.lead_score)}`}
                style={{ width: `${data.lead_score}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Temperature */}
        <div className={`rounded-lg p-4 ${temp.bgColor} border ${temp.borderColor}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${temp.bgColor}`}>
              <TempIcon className={`h-5 w-5 ${temp.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Temperatura</p>
              <p className={`font-semibold ${temp.color}`}>{temp.label}</p>
            </div>
          </div>
        </div>

        {/* Credit Status */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Crédito preaprobado</span>
              {data.re_credit_preapproved ? (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Sí
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  No
                </Badge>
              )}
            </div>
            
            <Separator className="bg-border/50" />
            
            <div>
              <p className="text-xs text-muted-foreground mb-1">Tipo de crédito</p>
              <p className="font-medium text-sm">{getCreditTypeLabel(data.re_credit_type)}</p>
            </div>
            
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Presupuesto estimado
              </p>
              <p className="font-semibold text-lg text-primary">
                {formatCurrency(data.re_budget_estimated_mxn)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Próxima acción
              </p>
              {data.next_action_at ? (
                <p className="font-medium text-sm">
                  {format(new Date(data.next_action_at), "d 'de' MMM, HH:mm", { locale: es })}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Sin programar</p>
              )}
            </div>
            
            <Separator className="bg-border/50" />
            
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                Última interacción
              </p>
              {data.last_interaction_at ? (
                <p className="font-medium text-sm">
                  {formatDistanceToNow(new Date(data.last_interaction_at), { 
                    addSuffix: true, 
                    locale: es 
                  })}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Sin interacciones</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Opt-in Status */}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground">Estado Opt-in</span>
          {data.opt_in_status === 'opt_in' ? (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              Aceptó
            </Badge>
          ) : data.opt_in_status === 'opt_out' ? (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
              Opt-out
            </Badge>
          ) : (
            <Badge variant="secondary">Desconocido</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
